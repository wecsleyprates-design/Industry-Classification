import { logger } from "#helpers/logger";
import { extractAttributeName } from "#utils";
import { AttributeRepository } from "./attributeRepository";
import type {
	AttributeCatalogItem,
	GetAttributeCatalogResponse,
	GetAttributeCatalogQuery,
	CustomFieldsSummaryResponse
} from "#types/workflow-dtos";
import { CaseService } from "#services/case";
import { ATTRIBUTE_DATA_TYPES, ATTRIBUTE_SOURCES } from "./types";
import {
	ATTRIBUTE_CATALOG_OPERATORS_FILTER,
	buildCatalogOperatorsForDataType,
	type CatalogOperatorTypeFilter
} from "./catalogOperators";

/**
 * Manager responsible for attribute catalog business logic
 * Handles data transformation and orchestration for attribute catalog operations
 */
export class AttributeManager {
	private attributeRepository: AttributeRepository;
	private caseService: CaseService;

	constructor(attributeRepository?: AttributeRepository, caseService?: CaseService) {
		this.attributeRepository = attributeRepository ?? new AttributeRepository();
		this.caseService = caseService ?? new CaseService();
	}

	/**
	 * Maps custom field type from Case Service to internal data type
	 * @param customFieldType - The type from custom fields API
	 * @returns The mapped data type
	 */
	private mapCustomFieldType(customFieldType: string): string {
		const typeMap: Record<string, string> = {
			text: ATTRIBUTE_DATA_TYPES.STRING,
			dropdown: ATTRIBUTE_DATA_TYPES.STRING,
			integer: ATTRIBUTE_DATA_TYPES.NUMBER,
			full_text: ATTRIBUTE_DATA_TYPES.STRING,
			upload: ATTRIBUTE_DATA_TYPES.STRING,
			phone_number: ATTRIBUTE_DATA_TYPES.STRING,
			email: ATTRIBUTE_DATA_TYPES.STRING,
			boolean: ATTRIBUTE_DATA_TYPES.BOOLEAN,
			alphanumeric: ATTRIBUTE_DATA_TYPES.STRING,
			decimal: ATTRIBUTE_DATA_TYPES.NUMBER,
			checkbox: ATTRIBUTE_DATA_TYPES.ARRAY,
			date: ATTRIBUTE_DATA_TYPES.DATE
		};

		return typeMap[customFieldType] ?? ATTRIBUTE_DATA_TYPES.STRING;
	}

	/**
	 * Converts custom fields from Case Service to attribute catalog format
	 * @param customFields - Array of custom field definitions
	 * @returns Array of attribute catalog responses
	 */
	private convertCustomFieldsToAttributes(
		customFields: CustomFieldsSummaryResponse,
		operatorType: CatalogOperatorTypeFilter
	): AttributeCatalogItem[] {
		return customFields.map(field => {
			const dataType = this.mapCustomFieldType(field.type);

			return {
				context: ATTRIBUTE_SOURCES.CUSTOM_FIELDS,
				source: ATTRIBUTE_SOURCES.CUSTOM_FIELDS,
				attribute: {
					name: field.field,
					label: field.label
				},
				operators: buildCatalogOperatorsForDataType(dataType, operatorType),
				data_type: dataType as (typeof ATTRIBUTE_DATA_TYPES)[keyof typeof ATTRIBUTE_DATA_TYPES],
				validation_regex: null,
				description: null
			};
		});
	}

	/**
	 * Determines if custom fields should be included in the catalog
	 * @param customerId - Customer ID
	 * @param source - Optional source filter
	 * @param context - Optional context filter
	 * @returns True if custom fields should be included
	 */
	private shouldIncludeCustomFields(customerId: string, source?: string, context?: string): boolean {
		return (
			Boolean(customerId) &&
			(!source || source === ATTRIBUTE_SOURCES.CUSTOM_FIELDS) &&
			(!context || context === ATTRIBUTE_SOURCES.CUSTOM_FIELDS)
		);
	}

	/**
	 * Determines if attributes should be fetched from the database
	 * @param source - Optional source filter
	 * @returns True if database fetch is needed
	 */
	private shouldFetchFromDB(source?: string): boolean {
		return !source || source !== ATTRIBUTE_SOURCES.CUSTOM_FIELDS;
	}

	/**
	 * Fetches and converts custom fields from Case Service to attribute catalog format
	 * @param customerId - Customer ID
	 * @param grouped - The grouped attribute catalog response to populate
	 */
	private async fetchAndConvertCustomFields(
		customerId: string,
		grouped: GetAttributeCatalogResponse,
		operatorType: CatalogOperatorTypeFilter
	): Promise<void> {
		try {
			const customFields = await this.caseService.getCustomFieldsSummary(customerId);
			const customFieldAttributes = this.convertCustomFieldsToAttributes(customFields, operatorType);

			for (const attribute of customFieldAttributes) {
				if (!grouped[attribute.context]) {
					grouped[attribute.context] = [];
				}
				grouped[attribute.context].push(attribute);
			}
		} catch (error) {
			logger.error({ error }, "AttributeManager: Failed to fetch custom fields");
			throw error;
		}
	}

	/**
	 * Retrieves the attribute catalog grouped by context
	 * @param params - Optional query filters (source, context, active)
	 * @param customerId - Customer ID (required for fetching custom fields)
	 * @param operatorType - Which operator families to include (comparison, variation, or both)
	 * @returns Promise<GetAttributeCatalogResponse> - Attributes grouped by context
	 */
	async getAttributeCatalog(
		params: GetAttributeCatalogQuery,
		customerId: string,
		operatorType: CatalogOperatorTypeFilter = ATTRIBUTE_CATALOG_OPERATORS_FILTER.ALL
	): Promise<GetAttributeCatalogResponse> {
		logger.info("AttributeManager: Retrieving attribute catalog", { ...params, operatorType });

		try {
			const { source, context } = params;
			const shouldIncludeCustomFields = this.shouldIncludeCustomFields(customerId, source, context);
			const shouldFetchFromDB = this.shouldFetchFromDB(source);

			const grouped: GetAttributeCatalogResponse = {};

			if (shouldIncludeCustomFields) {
				await this.fetchAndConvertCustomFields(customerId, grouped, operatorType);
			}

			if (shouldFetchFromDB) {
				const records = await this.attributeRepository.getAttributes(params);

				for (const record of records) {
					const attributeName = extractAttributeName(record.path, record.source);

					const label = record.label ?? attributeName;

					const attributeResponse: AttributeCatalogItem = {
						context: record.context,
						source: record.source,
						attribute: {
							name: attributeName,
							label: label
						},
						operators: buildCatalogOperatorsForDataType(record.data_type, operatorType),
						data_type: record.data_type,
						validation_regex: record.validation_regex,
						description: record.description
					};

					if (!grouped[record.context]) {
						grouped[record.context] = [];
					}

					grouped[record.context].push(attributeResponse);
				}
			}

			const totalAttributes = Object.values(grouped).flat().length;
			logger.info(
				`AttributeManager: Retrieved catalog with ${Object.keys(grouped).length} contexts and ${totalAttributes} total attributes`
			);

			return grouped;
		} catch (error) {
			logger.error({ error }, "AttributeManager: Failed to retrieve attribute catalog");
			throw error;
		}
	}
}

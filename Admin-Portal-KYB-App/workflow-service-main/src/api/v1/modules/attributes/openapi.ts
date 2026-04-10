import type { OpenAPIV3 } from "openapi-types";
import { Workflows } from "@joinworth/types";
import { ATTRIBUTE_SOURCES, ATTRIBUTE_DATA_TYPES } from "#core/attributes/types";
import { COMPARISON_OPERATOR } from "#helpers/workflow";

const comparisonOperators = Object.values(COMPARISON_OPERATOR);
const variationOperators = Object.values(Workflows.Conditions.VARIATION_OPERATOR);
const catalogOperatorUnion = [...comparisonOperators, ...variationOperators];
const attributeSourceValues = Object.values(ATTRIBUTE_SOURCES);
const attributeDataTypeValues = Object.values(ATTRIBUTE_DATA_TYPES);
const catalogOperatorsFilterValues = Object.values(Workflows.Attributes.ATTRIBUTE_CATALOG_OPERATORS_FILTER);

const attributesOpenAPI: OpenAPIV3.PathsObject = {
	"/attributes/customers/{customerId}/catalog": {
		get: {
			tags: ["Attributes"],
			summary: "Get attribute catalog",
			description:
				"Retrieves the attribute catalog grouped by context. Attributes can be filtered by source (facts, case, custom_fields) and/or context (financial, kyb, kyc, etc.). The response is grouped by context to facilitate frontend rendering in query builders. Custom fields are fetched from Case Service when customerId is provided. Use query parameter `operators` to return only comparison operators, only variation (monitoring) operators, or both (default).",
			operationId: "getAttributeCatalog",
			parameters: [
				{
					name: "customerId",
					in: "path",
					description: "Customer ID (required for fetching custom fields)",
					required: true,
					schema: {
						type: "string",
						format: "uuid",
						example: "550e8400-e29b-41d4-a716-446655440000"
					}
				},
				{
					name: "source",
					in: "query",
					description: `Filter attributes by technical source (${attributeSourceValues.join(", ")})`,
					required: false,
					schema: {
						type: "string",
						enum: attributeSourceValues,
						example: ATTRIBUTE_SOURCES.FACTS
					}
				},
				{
					name: "context",
					in: "query",
					description: "Filter attributes by business context (financial, kyb, kyc, etc.)",
					required: false,
					schema: {
						type: "string",
						example: "financial"
					}
				},
				{
					name: "active",
					in: "query",
					description: "Filter attributes by active status (default: true)",
					required: false,
					schema: {
						type: "boolean",
						example: true
					}
				},
				{
					name: "operators",
					in: "query",
					description:
						"Which operator families to include per attribute: `comparison` (workflow / single-state rules), `variation` (monitoring / previous vs current state), or `all` for both. Omitted or invalid values behave as `all`.",
					required: false,
					schema: {
						type: "string",
						enum: catalogOperatorsFilterValues,
						example: Workflows.Attributes.ATTRIBUTE_CATALOG_OPERATORS_FILTER.COMPARISON
					}
				}
			],
			responses: {
				"200": {
					description: "Successfully retrieved attribute catalog",
					content: {
						"application/json": {
							schema: {
								type: "object",
								description: "Attributes grouped by context",
								additionalProperties: {
									type: "array",
									items: {
										type: "object",
										properties: {
											context: {
												type: "string",
												description: "Business category context (e.g., financial, kyb, kyc)",
												example: "financial"
											},
											attribute: {
												type: "object",
												properties: {
													name: {
														type: "string",
														description: "Real attribute name (extracted from path without source prefix)",
														example: "credit_score"
													},
													label: {
														type: "string",
														description: "Human-readable label for UI display",
														example: "Credit Score"
													}
												},
												required: ["name", "label"]
											},
											operators: {
												type: "array",
												description:
													"Allowed operators in DSL format for this attribute. Subset depends on the `operators` query parameter: comparison-only, variation-only, or both.",
												items: {
													type: "string",
													enum: catalogOperatorUnion
												},
												example: [...comparisonOperators.slice(0, 4), ...variationOperators.slice(0, 2)]
											},
											dataType: {
												type: "string",
												description: "Data type of the attribute",
												enum: attributeDataTypeValues,
												example: ATTRIBUTE_DATA_TYPES.NUMBER
											},
											validationRegex: {
												type: "string",
												nullable: true,
												description: "Optional regex pattern for value validation",
												example: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
											},
											description: {
												type: "string",
												nullable: true,
												description: "Optional description of the attribute",
												example: "Credit score from credit bureau"
											}
										},
										required: ["context", "attribute", "operators", "dataType", "validationRegex", "description"]
									}
								},
								example: {
									financial: [
										{
											context: "financial",
											attribute: {
												name: "credit_score",
												label: "Credit Score"
											},
											operators: [">=", "<=", "=", "!=", ">", "<"],
											dataType: "number",
											validationRegex: null,
											description: "Credit score from credit bureau"
										}
									],
									kyc: [
										{
											context: "kyc",
											attribute: {
												name: "status",
												label: "Case Status"
											},
											operators: ["=", "!=", "IN", "NOT_IN"],
											dataType: "enum",
											validationRegex: null,
											description: "Current status of the case"
										}
									]
								}
							}
						}
					}
				},
				"400": {
					description: "Bad request - Invalid query parameters",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										example: "fail"
									},
									message: {
										type: "string",
										example: `source must be one of: ${attributeSourceValues.join(", ")}`
									}
								}
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Missing or invalid authentication"
				},
				"500": {
					description: "Internal server error"
				}
			}
		}
	}
};

export default attributesOpenAPI;

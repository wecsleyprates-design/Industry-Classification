import { Workflows } from "@joinworth/types";
import { ATTRIBUTE_DATA_TYPES } from "./types";

const { COMPARISON_OPERATOR, VARIATION_OPERATOR } = Workflows.Conditions;

export const ATTRIBUTE_CATALOG_OPERATORS_FILTER = Workflows.Attributes.ATTRIBUTE_CATALOG_OPERATORS_FILTER;

export type CatalogOperatorTypeFilter =
	(typeof ATTRIBUTE_CATALOG_OPERATORS_FILTER)[keyof typeof ATTRIBUTE_CATALOG_OPERATORS_FILTER];

export function normalizeCatalogOperatorTypeParam(raw: unknown): CatalogOperatorTypeFilter {
	const { COMPARISON, VARIATION, ALL } = ATTRIBUTE_CATALOG_OPERATORS_FILTER;
	if (raw === COMPARISON || raw === VARIATION || raw === ALL) {
		return raw;
	}
	return ALL;
}

function getComparisonOperatorsForDataType(dataType: string): string[] {
	const {
		GREATER_THAN_OR_EQUAL,
		LESS_THAN_OR_EQUAL,
		EQUALS,
		NOT_EQUALS,
		GREATER_THAN,
		LESS_THAN,
		BETWEEN,
		IS_NULL,
		IS_NOT_NULL,
		CONTAINS,
		NOT_CONTAINS,
		IN,
		NOT_IN,
		ANY_EQUALS,
		ANY_CONTAINS,
		ARRAY_INTERSECTS,
		ARRAY_LENGTH,
		ARRAY_IS_EMPTY,
		ARRAY_IS_NOT_EMPTY
	} = COMPARISON_OPERATOR;

	switch (dataType) {
		case ATTRIBUTE_DATA_TYPES.NUMBER:
			return [
				GREATER_THAN_OR_EQUAL,
				LESS_THAN_OR_EQUAL,
				EQUALS,
				NOT_EQUALS,
				GREATER_THAN,
				LESS_THAN,
				BETWEEN,
				IS_NULL,
				IS_NOT_NULL
			];
		case ATTRIBUTE_DATA_TYPES.STRING:
			return [EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, IN, NOT_IN, IS_NULL, IS_NOT_NULL];
		case ATTRIBUTE_DATA_TYPES.BOOLEAN:
			return [EQUALS, NOT_EQUALS, IS_NULL, IS_NOT_NULL];
		case ATTRIBUTE_DATA_TYPES.DATE:
			return [
				GREATER_THAN_OR_EQUAL,
				LESS_THAN_OR_EQUAL,
				EQUALS,
				NOT_EQUALS,
				GREATER_THAN,
				LESS_THAN,
				BETWEEN,
				IS_NULL,
				IS_NOT_NULL
			];
		case ATTRIBUTE_DATA_TYPES.ENUM:
			return [EQUALS, NOT_EQUALS, IN, NOT_IN, IS_NULL, IS_NOT_NULL];
		case ATTRIBUTE_DATA_TYPES.ARRAY:
			return [
				ANY_EQUALS,
				ANY_CONTAINS,
				ARRAY_INTERSECTS,
				ARRAY_LENGTH,
				ARRAY_IS_EMPTY,
				ARRAY_IS_NOT_EMPTY,
				IS_NULL,
				IS_NOT_NULL
			];
		default:
			return [EQUALS, NOT_EQUALS, IS_NULL, IS_NOT_NULL];
	}
}

function getVariationOperatorsForDataType(dataType: string): string[] {
	const VO = VARIATION_OPERATOR;

	const generic = [VO.CHANGED_FROM_NULL, VO.CHANGED_TO_NULL, VO.CHANGED, VO.UNCHANGED];

	switch (dataType) {
		case ATTRIBUTE_DATA_TYPES.NUMBER:
			return [
				VO.INCREASED_BY,
				VO.DECREASED_BY,
				VO.INCREASED_BY_AT_LEAST,
				VO.DECREASED_BY_AT_LEAST,
				VO.INCREASED_BY_PERCENT,
				VO.DECREASED_BY_PERCENT,
				VO.CROSSED_ABOVE,
				VO.CROSSED_BELOW,
				VO.PERCENT_CHANGE_AT_LEAST,
				...generic
			];
		case ATTRIBUTE_DATA_TYPES.BOOLEAN:
			return [VO.BECAME_TRUE, VO.BECAME_FALSE, ...generic];
		case ATTRIBUTE_DATA_TYPES.STRING:
		case ATTRIBUTE_DATA_TYPES.DATE:
		case ATTRIBUTE_DATA_TYPES.ENUM:
		case ATTRIBUTE_DATA_TYPES.ARRAY:
			return generic;
		default:
			return generic;
	}
}

/**
 * Operators listed in the attribute catalog for a data type, filtered by comparison vs variation vs both.
 */
export function buildCatalogOperatorsForDataType(dataType: string, operatorType: CatalogOperatorTypeFilter): string[] {
	const comparison = getComparisonOperatorsForDataType(dataType);
	const variation = getVariationOperatorsForDataType(dataType);
	switch (operatorType) {
		case ATTRIBUTE_CATALOG_OPERATORS_FILTER.COMPARISON:
			return comparison;
		case ATTRIBUTE_CATALOG_OPERATORS_FILTER.VARIATION:
			return variation;
		case ATTRIBUTE_CATALOG_OPERATORS_FILTER.ALL:
			return [...comparison, ...variation];
	}
}

/**
 * Simple DSL to JSON Logic converter
 * Converts the custom DSL format to JSON Logic for rule evaluation
 */

import { RulesLogic } from "json-logic-js";
import { Workflows } from "@joinworth/types";
import { DSLCondition } from "./types";
import { isValidStringField } from "#utils/validation";
import { normalizeValue, normalizeDatesInObject } from "#helpers/dates";

export const { LOGICAL_OPERATOR, COMPARISON_OPERATOR } = Workflows.Conditions;

/**
 * Converts DSL rule to JSON Logic format
 * @param dsl - The DSL rule object
 * @returns JSON Logic rule object
 */
export function convertDSLToJSONLogic(dsl: unknown): RulesLogic {
	if (!dsl || typeof dsl !== "object") {
		throw new Error("Invalid DSL structure");
	}

	const dslObj = dsl as Record<string, unknown>;
	if (!dslObj.operator || !dslObj.conditions) {
		throw new Error("Invalid DSL structure");
	}

	if (dslObj.operator === LOGICAL_OPERATOR.AND) {
		return {
			and: (dslObj.conditions as unknown[]).map(convertCondition)
		};
	}

	throw new Error(`Root operator must be ${LOGICAL_OPERATOR.AND}`);
}

/**
 * Converts a single condition (simple or nested) to JSON Logic
 */
function convertCondition(condition: unknown): RulesLogic {
	if (!condition || typeof condition !== "object") {
		throw new Error("Invalid condition structure");
	}

	const cond = condition as Record<string, unknown>;

	if ("field" in cond) {
		return convertSimpleCondition(cond as unknown as DSLCondition);
	}

	if (cond.operator === LOGICAL_OPERATOR.OR) {
		return {
			or: (cond.conditions as unknown[]).map(convertCondition)
		};
	}

	throw new Error("Invalid condition structure");
}

/**
 * Converts a simple DSL condition to JSON Logic format
 * @param condition - The DSL condition with field, operator, and value
 * @returns JSON Logic expression for the condition
 */
export function convertSimpleCondition(condition: DSLCondition): RulesLogic {
	const field = { var: condition.field };
	const normalizedValue = normalizeDatesInObject(condition.value);
	const value: RulesLogic = normalizedValue as RulesLogic;

	switch (condition.operator) {
		case COMPARISON_OPERATOR.EQUALS:
			return { "==": [field, value] };
		case COMPARISON_OPERATOR.NOT_EQUALS:
			return { "!=": [field, value] };
		case COMPARISON_OPERATOR.GREATER_THAN:
			return { ">": [field, value] };
		case COMPARISON_OPERATOR.LESS_THAN:
			return { "<": [field, value] };
		case COMPARISON_OPERATOR.GREATER_THAN_OR_EQUAL:
			return { ">=": [field, value] };
		case COMPARISON_OPERATOR.LESS_THAN_OR_EQUAL:
			return { "<=": [field, value] };
		case COMPARISON_OPERATOR.IN:
			return { in: [field, value] };
		case COMPARISON_OPERATOR.NOT_IN:
			return { "!": { in: [field, value] } } as RulesLogic;
		case COMPARISON_OPERATOR.BETWEEN:
			if (!Array.isArray(condition.value) || condition.value.length !== 2) {
				throw new Error("BETWEEN operator requires an array with exactly 2 elements [min, max]");
			}
			const min = normalizeValue(condition.value[0]);
			const max = normalizeValue(condition.value[1]);
			return { "<=": [min, field, max] } as RulesLogic;
		case COMPARISON_OPERATOR.IS_NULL:
			return { "==": [field, null] } as RulesLogic;
		case COMPARISON_OPERATOR.IS_NOT_NULL:
			return { "!=": [field, null] } as RulesLogic;
		case COMPARISON_OPERATOR.CONTAINS:
			return { contains: [field, value] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.NOT_CONTAINS:
			return { "!": { contains: [field, value] } as unknown as RulesLogic } as RulesLogic;
		case COMPARISON_OPERATOR.ANY_EQUALS:
			return { any_equals: [field, value] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.ANY_CONTAINS:
			return { any_contains: [field, value] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.ARRAY_INTERSECTS:
			if (!Array.isArray(condition.value)) {
				throw new Error("ARRAY_INTERSECTS operator requires an array value");
			}
			return { array_intersects: [field, value] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.ARRAY_LENGTH:
			if (typeof condition.value !== "number") {
				throw new Error("ARRAY_LENGTH operator requires a number value");
			}
			return { array_length: [field, value] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.ARRAY_IS_EMPTY:
			return { array_is_empty: [field] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.ARRAY_IS_NOT_EMPTY:
			return { array_is_not_empty: [field] } as unknown as RulesLogic;
		case COMPARISON_OPERATOR.REGEX_MATCH:
			if (typeof condition.value !== "string") {
				throw new Error("REGEX_MATCH operator requires a string value");
			}
			return { regex_match: [field, condition.value] } as unknown as RulesLogic;
		default:
			throw new Error(`Unsupported operator: ${condition.operator}`);
	}
}

/**
 * Validates if a DSL rule has the correct structure
 * @param dsl - The DSL rule object to validate
 * @returns true if valid, false otherwise
 */
export function isValidDSL(dsl: unknown): boolean {
	try {
		if (!dsl || typeof dsl !== "object") return false;
		const dslObj = dsl as Record<string, unknown>;
		if (dslObj.operator !== LOGICAL_OPERATOR.AND) return false;
		if (!Array.isArray(dslObj.conditions) || dslObj.conditions.length === 0) return false;

		// Validate each condition
		for (const condition of dslObj.conditions) {
			if (!isValidCondition(condition)) return false;
		}

		return true;
	} catch {
		return false;
	}
}

const NULL_CHECK_OPERATORS = [
	COMPARISON_OPERATOR.IS_NULL,
	COMPARISON_OPERATOR.IS_NOT_NULL,
	COMPARISON_OPERATOR.ARRAY_IS_EMPTY,
	COMPARISON_OPERATOR.ARRAY_IS_NOT_EMPTY
];

/**
 * Validates a single condition
 */
function isValidCondition(condition: unknown): boolean {
	if (!condition || typeof condition !== "object") return false;
	const cond = condition as Record<string, unknown>;

	if ("field" in cond) {
		const hasValidField = isValidStringField(cond.field);
		const hasValidOperator = isValidStringField(cond.operator);

		const isNullCheckOperator = (NULL_CHECK_OPERATORS as readonly string[]).includes(cond.operator as string);
		const hasValidValue = isNullCheckOperator || cond.value !== undefined;

		return hasValidField && hasValidOperator && hasValidValue;
	}

	if (cond.operator === LOGICAL_OPERATOR.OR) {
		return Array.isArray(cond.conditions) && cond.conditions.length > 0 && cond.conditions.every(isValidCondition);
	}

	return false;
}

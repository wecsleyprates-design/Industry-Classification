import type {
	ConditionFormData,
	ConditionGroupFormData,
	ConditionOperator,
	RuleConditionItem,
} from "@/types/workflows";
import {
	ARRAY_EMPTY_OPERATORS,
	ARRAY_MULTI_VALUE_OPERATORS,
	ARRAY_NUMBER_OPERATORS,
	ARRAY_STRING_OPERATORS,
	MULTI_VALUE_OPERATORS,
	NULL_OPERATORS,
	PARTIAL_MATCH_OPERATORS,
	RANGE_OPERATORS,
} from "./constants";

export interface ConditionError {
	field: "context" | "attribute" | "operator" | "value";
	message: string;
}

export interface RuleValidationError {
	ruleIndex: number;
	ruleName: string;
	errors: string[];
}

export const isConditionGroup = (
	item: RuleConditionItem,
): item is ConditionGroupFormData => {
	return "operator" in item && item.operator === "OR";
};

export const isMultiValueOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return MULTI_VALUE_OPERATORS.includes(operator as ConditionOperator);
};

export const isRangeOperator = (operator: ConditionOperator | ""): boolean => {
	return RANGE_OPERATORS.includes(operator as ConditionOperator);
};

export const isPartialMatchOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return PARTIAL_MATCH_OPERATORS.includes(operator as ConditionOperator);
};

export const isNullOperator = (operator: ConditionOperator | ""): boolean => {
	return NULL_OPERATORS.includes(operator as ConditionOperator);
};

export const isArrayStringOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return ARRAY_STRING_OPERATORS.includes(operator as ConditionOperator);
};

export const isArrayMultiValueOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return ARRAY_MULTI_VALUE_OPERATORS.includes(operator as ConditionOperator);
};

export const isArrayNumberOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return ARRAY_NUMBER_OPERATORS.includes(operator as ConditionOperator);
};

export const isArrayEmptyOperator = (
	operator: ConditionOperator | "",
): boolean => {
	return ARRAY_EMPTY_OPERATORS.includes(operator as ConditionOperator);
};

export const isSimpleCondition = (
	item: RuleConditionItem,
): item is ConditionFormData => {
	return !isConditionGroup(item);
};

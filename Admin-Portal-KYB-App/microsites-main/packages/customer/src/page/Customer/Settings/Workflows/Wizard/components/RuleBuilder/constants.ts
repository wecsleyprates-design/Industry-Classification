import type { ConditionOperator, DecisionValue } from "@/types/workflows";

export const DECISION_OPTIONS: Array<{
	value: DecisionValue;
	label: string;
}> = [
	{ value: "AUTO_APPROVED", label: "Approve" },
	{ value: "AUTO_REJECTED", label: "Reject" },
	{ value: "UNDER_MANUAL_REVIEW", label: "Manual Review" },
];

export const VALID_DECISION_VALUES: DecisionValue[] = DECISION_OPTIONS.map(
	(option) => option.value,
);

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
	"=": "Equals",
	"!=": "Not Equals",
	">": "Greater Than",
	"<": "Less Than",
	">=": "Greater Than or Equal",
	"<=": "Less Than or Equal",
	IN: "In",
	NOT_IN: "Not In",
	BETWEEN: "Between",
	CONTAINS: "Contains",
	NOT_CONTAINS: "Not Contains",
	IS_NULL: "Is Null",
	IS_NOT_NULL: "Is Not Null",
	ANY_EQUALS: "Any Equals",
	ANY_CONTAINS: "Any Contains",
	ARRAY_INTERSECTS: "List Intersects",
	ARRAY_LENGTH: "List Length",
	ARRAY_IS_EMPTY: "List Is Empty",
	ARRAY_IS_NOT_EMPTY: "List Is Not Empty",
};

export const MULTI_VALUE_OPERATORS: ConditionOperator[] = ["IN", "NOT_IN"];

export const NULL_OPERATORS: ConditionOperator[] = ["IS_NULL", "IS_NOT_NULL"];

export const RANGE_OPERATORS: ConditionOperator[] = ["BETWEEN"];

export const ARRAY_STRING_OPERATORS: ConditionOperator[] = [
	"ANY_EQUALS",
	"ANY_CONTAINS",
];

export const ARRAY_MULTI_VALUE_OPERATORS: ConditionOperator[] = [
	"ARRAY_INTERSECTS",
];

export const ARRAY_NUMBER_OPERATORS: ConditionOperator[] = ["ARRAY_LENGTH"];

export const ARRAY_EMPTY_OPERATORS: ConditionOperator[] = [
	"ARRAY_IS_EMPTY",
	"ARRAY_IS_NOT_EMPTY",
];

export const PARTIAL_MATCH_OPERATORS: ConditionOperator[] = [
	"CONTAINS",
	"NOT_CONTAINS",
];

export const DEFAULT_DECISION: DecisionValue = "UNDER_MANUAL_REVIEW";

export const ACTION_TYPE = "set_field" as const;

export const ACTION_FIELD = "case.status" as const;

export const isValidDecisionValue = (
	value: unknown,
): value is DecisionValue => {
	return (
		typeof value === "string" &&
		VALID_DECISION_VALUES.includes(value as DecisionValue)
	);
};

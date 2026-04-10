import { COMPARISON_OPERATOR } from "#helpers/workflow";
import { Workflows } from "@joinworth/types";

export const DECISION_TYPES = Workflows.Audits.DECISION_TYPES;

export type DecisionType = Workflows.Audits.DecisionType;

export type ComparisonOperatorValue = (typeof COMPARISON_OPERATOR)[keyof typeof COMPARISON_OPERATOR];

export const OPERATOR_LABELS: Record<ComparisonOperatorValue, string> = {
	[COMPARISON_OPERATOR.EQUALS]: "equals",
	[COMPARISON_OPERATOR.NOT_EQUALS]: "not equals",
	[COMPARISON_OPERATOR.GREATER_THAN]: "greater than",
	[COMPARISON_OPERATOR.LESS_THAN]: "less than",
	[COMPARISON_OPERATOR.GREATER_THAN_OR_EQUAL]: "greater than or equal to",
	[COMPARISON_OPERATOR.LESS_THAN_OR_EQUAL]: "less than or equal to",
	[COMPARISON_OPERATOR.IN]: "in list",
	[COMPARISON_OPERATOR.NOT_IN]: "not in list",
	[COMPARISON_OPERATOR.CONTAINS]: "contains",
	[COMPARISON_OPERATOR.NOT_CONTAINS]: "does not contain",
	[COMPARISON_OPERATOR.BETWEEN]: "between",
	[COMPARISON_OPERATOR.IS_NULL]: "is null",
	[COMPARISON_OPERATOR.IS_NOT_NULL]: "is not null",
	[COMPARISON_OPERATOR.ANY_EQUALS]: "any equals",
	[COMPARISON_OPERATOR.ANY_CONTAINS]: "any contains",
	[COMPARISON_OPERATOR.ARRAY_INTERSECTS]: "list intersects",
	[COMPARISON_OPERATOR.ARRAY_LENGTH]: "list length",
	[COMPARISON_OPERATOR.ARRAY_IS_EMPTY]: "list is empty",
	[COMPARISON_OPERATOR.ARRAY_IS_NOT_EMPTY]: "list is not empty",
	[COMPARISON_OPERATOR.REGEX_MATCH]: "matches regex"
};

export const CONDITION_RESULT_LABELS = {
	PASSED: {
		SYMBOL: "✓",
		TEXT: "and it was"
	},
	FAILED: {
		SYMBOL: "✗",
		TEXT: "but it was"
	}
} as const;

export const VALUE_LABELS = {
	NULL: "null",
	UNDEFINED: "(not set)"
} as const;

export const BOOLEAN_LABELS = {
	YES: "Yes",
	NO: "No"
} as const;

export const BETWEEN_SEPARATOR = "AND";

export const CONDITION_PREFIX = "The condition checked if";

/**
 * Types specific to workflow DSL (Domain Specific Language)
 * Used for conditions in data_workflow_rules and data_workflow_triggers tables
 */

export interface DSLRule {
	operator: "AND";
	conditions: (DSLCondition | DSLNestedCondition)[];
}

export interface DSLCondition {
	field: string;
	operator: string;
	value: unknown;
}

export interface DSLNestedCondition {
	operator: "OR";
	conditions: DSLCondition[];
}

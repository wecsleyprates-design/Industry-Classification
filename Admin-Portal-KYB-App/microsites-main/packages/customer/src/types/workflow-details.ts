export type OperatorType =
	| "AND"
	| "OR"
	| "="
	| "!="
	| ">"
	| "<"
	| ">="
	| "<="
	| "IN"
	| "NOT_IN"
	| "NOT IN"
	| "BETWEEN"
	| "CONTAINS"
	| "NOT_CONTAINS";

export interface WorkflowCondition {
	field?: string;
	display_label?: string;
	operator: OperatorType | string;
	value?: string | number | boolean | null | Array<string | number>;
	conditions?: WorkflowCondition[];
}

export interface WorkflowActionParameter {
	field: string;
	value: string | number | boolean | null;
	[key: string]: unknown;
}

export interface WorkflowAction {
	type: string;
	parameters: WorkflowActionParameter;
}

export interface WorkflowRule {
	id?: string;
	name: string;
	priority?: number;
	conditions?: WorkflowCondition;
	actions: WorkflowAction[];
}

export interface WorkflowVersionSnapshot {
	rules: WorkflowRule[];
	default_action?: WorkflowAction;
}

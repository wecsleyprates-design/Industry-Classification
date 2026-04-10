import type { WorkflowAction } from "#core/actions/types";
import type { ConditionEvaluationDetail } from "#core/evaluators/types";

export interface WorkflowRule {
	id: string;
	workflow_version_id: string;
	name: string;
	priority: number;
	conditions: Record<string, unknown>;
	actions: WorkflowAction | WorkflowAction[];
	created_by: string;
	created_at: Date;
	updated_by: string;
	updated_at: Date;
}

export interface RuleEvaluationResult {
	rule_id: string;
	matched: boolean;
	error?: string;
	true_conditions?: ConditionEvaluationDetail[];
	false_conditions?: ConditionEvaluationDetail[];
}

export interface RuleEvaluationLog {
	workflow_id: string;
	workflow_version_id?: string;
	rule_id: string;
	rule_name: string;
	matched: boolean;
	error?: string;
	conditions?: Record<string, unknown>;
	true_conditions?: ConditionEvaluationDetail[];
	false_conditions?: ConditionEvaluationDetail[];
}

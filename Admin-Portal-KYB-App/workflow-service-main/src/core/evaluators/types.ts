import type { WorkflowAction } from "#core/actions/types";
import type { RuleEvaluationLog } from "#core/rule/types";
import type { TriggerEvaluationLog } from "#core/trigger/types";
import type { WorkflowAnnotations } from "#core/types";

export interface ConditionEvaluationDetail {
	field: string;
	operator: string;
	expected_value: unknown;
	actual_value: unknown;
	result: boolean;
}

export interface DetailedEvaluationResult {
	result: boolean;
	true_conditions: ConditionEvaluationDetail[];
	false_conditions: ConditionEvaluationDetail[];
}

export interface WorkflowEvaluationLog {
	workflow_id: string;
	workflow_version_id?: string;
	trigger_matched: boolean;
	rules_evaluated: number;
	matched_rule_id?: string | null;
	default_action_applied?: boolean;
	reason?: string;
}

export interface EvaluationLog {
	workflows_evaluated: WorkflowEvaluationLog[];
	trigger_evaluations: TriggerEvaluationLog[];
	rule_evaluations: RuleEvaluationLog[];
	default_action_applied?: boolean;
}

export interface WorkflowExecutionResult {
	workflow_id: string;
	applied_action: WorkflowAction | WorkflowAction[];
	default_applied: boolean;
	case_id: string;
	workflow_version_id: string;
	matched_rule_id?: string;
	input_attr: Record<string, unknown>;
	evaluation_log: EvaluationLog;
	latency_ms: number;
	customer_id?: string;
	annotations?: WorkflowAnnotations;
}

export interface TypedWorkflowExecutionResult {
	workflow_id: string;
	matched_rule_id?: string;
	applied_action: WorkflowAction;
	default_applied: boolean;
	evaluation_log: EvaluationLog;
}

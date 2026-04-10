export interface BusinessSearchResult {
	id: string;
	business_id: string;
	name: string;
	location: string;
	case_id?: string;
}

export type SelectedBusiness = BusinessSearchResult;

export interface BusinessSearchResponse {
	status: string;
	message: string;
	data: {
		records: BusinessSearchResult[];
		total: number;
	};
}

export interface BusinessSearchParams {
	customer_id: string;
	query: string;
	limit?: number;
}

export interface RuleEvaluationResult {
	name: string;
	description: string;
	passed: boolean;
}

export interface WorkflowTestResult {
	business_id: string;
	business_name: string;
	workflow_name: string;
	rules_passed: RuleEvaluationResult[];
	rules_failed: RuleEvaluationResult[];
}

export interface WorkflowTestRequest {
	workflow_id?: string;
	business_ids: string[];
}

export interface WorkflowTestResponse {
	status: string;
	message: string;
	data: {
		results: WorkflowTestResult[];
	};
}

export interface PreviewRuleEvaluation {
	workflow_id: string;
	rule_id: string;
	rule_name: string;
	matched: boolean;
	error?: string;
	conditions: Record<string, unknown>;
}

export interface PreviewEvaluationLog {
	trigger_evaluations: Array<{
		workflow_id: string;
		matched: boolean;
		error?: string;
	}>;
	rule_evaluations: PreviewRuleEvaluation[];
	workflows_evaluated: Array<{
		workflow_id: string;
		trigger_matched: boolean;
		rules_evaluated: number;
		matched_rule_id?: string;
	}>;
}

export interface PreviewEvaluationResult {
	workflow_id: string;
	workflow_name: string;
	trigger_matched: boolean;
	matched_rule_id?: string;
	matched_rule_name?: string;
	applied_action?: Array<{
		type: string;
		parameters?: Record<string, unknown>;
	}>;
	default_applied: boolean;
	evaluation_log: PreviewEvaluationLog;
	latency_ms: number;
	evaluated_at: string;
}

export interface PreviewBusinessResult {
	business_id: string;
	evaluation_result: PreviewEvaluationResult;
	sampled_cases?: Array<{
		case_id: string;
		business_id: string;
		result: PreviewEvaluationResult;
	}>;
}

export interface PreviewEvaluationResponse {
	evaluation_id: string;
	case_id?: string;
	business_id?: string | string[];
	evaluation_result: PreviewEvaluationResult;
	sampled_cases?: Array<{
		case_id: string;
		business_id: string;
		result: PreviewEvaluationResult;
	}>;
	business_results?: PreviewBusinessResult[];
}

export type TestWorkflowModalStep = "search" | "results";

export interface TestWorkflowOptions {
	businessNames?: Map<string, string>;
}

export interface TestWorkflowMutationParams {
	request: WorkflowTestRequest;
	options?: TestWorkflowOptions;
}

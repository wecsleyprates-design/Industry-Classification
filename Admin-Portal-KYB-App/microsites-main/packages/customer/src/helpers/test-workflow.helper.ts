import type {
	PreviewEvaluationResult,
	RuleEvaluationResult,
	WorkflowTestResult,
} from "@/types/test-workflow";

function extractPassedRules(
	ruleEvaluations: PreviewEvaluationResult["evaluation_log"]["rule_evaluations"],
): RuleEvaluationResult[] {
	return ruleEvaluations
		.filter((rule) => rule.matched)
		.map((rule) => ({
			name: rule.rule_name,
			description: `Rule ${rule.rule_name} matched`,
			passed: true,
		}));
}

function extractFailedRules(
	ruleEvaluations: PreviewEvaluationResult["evaluation_log"]["rule_evaluations"],
): RuleEvaluationResult[] {
	return ruleEvaluations
		.filter((rule) => !rule.matched)
		.map((rule) => ({
			name: rule.rule_name,
			description: rule.error ?? `Rule ${rule.rule_name} did not match`,
			passed: false,
		}));
}

export interface TransformOptions {
	businessName?: string;
}

export function transformPreviewToTestResult(
	businessId: string,
	evaluationResult: PreviewEvaluationResult,
	options: TransformOptions = {},
): WorkflowTestResult {
	const ruleEvaluations =
		evaluationResult.evaluation_log?.rule_evaluations ?? [];
	const { businessName = "" } = options;

	return {
		business_id: businessId,
		business_name: businessName,
		workflow_name: evaluationResult.workflow_name,
		rules_passed: extractPassedRules(ruleEvaluations),
		rules_failed: extractFailedRules(ruleEvaluations),
	};
}

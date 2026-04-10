import { logger } from "#helpers/logger";
import type { CaseData } from "#core/types";
import type { WorkflowRule, RuleEvaluationResult } from "#core/rule/types";
import { BaseEvaluator } from "./baseEvaluator";

export class RuleEvaluator extends BaseEvaluator {
	/**
	 * Evaluates a workflow rule against case data and facts using JSON Logic format
	 * @param rule - The rule to evaluate
	 * @param caseData - The case data to evaluate against
	 * @param facts - The facts data from warehouse service
	 * @returns RuleEvaluationResult with matched status and condition details
	 */
	static evaluateRule(rule: WorkflowRule, caseData: CaseData, facts: Record<string, unknown>): RuleEvaluationResult {
		try {
			logger.debug(`Evaluating rule ${rule.id} (${rule.name}) against case ${caseData.id}`);

			const detailedResult = this.evaluateWithDetails(rule.conditions, caseData, facts, "rule conditions");

			logger.debug(`Rule evaluation result for rule ${rule.id}: ${detailedResult.result}`);

			return {
				rule_id: rule.id,
				matched: detailedResult.result,
				true_conditions: detailedResult.true_conditions,
				false_conditions: detailedResult.false_conditions
			};
		} catch (error) {
			logger.error({ error }, `Error evaluating rule ${rule.id}`);
			return {
				rule_id: rule.id,
				matched: false,
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}
}

/**
 * Orchestrates monitoring rule evaluation (variation or static) for the HTTP endpoint.
 * Fetches shared (monitoring) rules by IDs, validates variation vs static mode, and runs
 * the same evaluation logic used by the workflow engine (evaluateVariationDSL / evaluateDSLWithTracking).
 */

import type { SharedRuleManager } from "#core/shared/sharedRuleManager";
import type { DetailedEvaluationResult } from "#core/evaluators/types";
import type { EvaluateRulesInput, EvaluateRulesResponse, RuleEvaluationResultItem } from "#types/workflow-dtos";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { evaluateVariationDSL, evaluateDSLWithTracking, ruleHasVariationCondition } from "#helpers/workflow";
import type { DSLRule } from "#helpers/workflow";

export class MonitoringEvaluationManager {
	constructor(private readonly sharedRuleManager: SharedRuleManager) {}

	async evaluateRules(input: EvaluateRulesInput): Promise<EvaluateRulesResponse> {
		const { currentState, previousState, ruleIds, evaluationId } = input;

		if (ruleIds?.length === 0) {
			throw new ApiError("ruleIds must be a non-empty array", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const rules = await this.sharedRuleManager.getMonitoringRulesByIds(ruleIds);

		const hasPreviousState = previousState != null;
		for (const rule of rules) {
			const dsl = rule.conditions as unknown as DSLRule;
			if (!hasPreviousState && ruleHasVariationCondition(dsl)) {
				throw new ApiError(
					`Rule ${rule.id} has variation conditions but previousState was not provided`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}

		const results: RuleEvaluationResultItem[] = rules.map(rule => {
			const dsl = rule.conditions as unknown as DSLRule;
			let detail: DetailedEvaluationResult;
			if (hasPreviousState) {
				detail = evaluateVariationDSL(dsl, previousState as Record<string, unknown>, currentState);
			} else {
				detail = evaluateDSLWithTracking(dsl, currentState);
			}
			return {
				rule_id: rule.id,
				rule_name: rule.name,
				matched: detail.result,
				conditions: rule.conditions,
				true_conditions: detail.true_conditions,
				false_conditions: detail.false_conditions
			};
		});

		return {
			results,
			...(evaluationId !== undefined && { evaluation_id: evaluationId })
		};
	}
}

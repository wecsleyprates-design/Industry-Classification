/**
 * Monitoring (variation) DSL evaluator.
 * Evaluates DSL rules against two state payloads (previousState, currentState).
 * - Variation operators: use both states; missing path treated as undefined (no throw).
 * - Current-only operators: evaluate only against currentState (reuses single-state evaluator).
 * Returns DetailedEvaluationResult (result, true_conditions, false_conditions).
 * Scope: same path convention as existing evaluator; monitoring scope is paths under facts.
 */

import { Workflows } from "@joinworth/types";
import type { DSLRule, DSLCondition, DSLNestedCondition } from "../types";
import type { DetailedEvaluationResult, ConditionEvaluationDetail } from "#core/evaluators/types";
import { evaluateDSLWithTracking } from "../singleState/evaluator";
import { evaluateVariationOperator } from "./operators";

const LOGICAL_OPERATOR = Workflows.Conditions.LOGICAL_OPERATOR;
const { isVariationOperator } = Workflows.Conditions;

/** Returns true if the rule has at least one condition using a variation operator (requires previousState). */
export function ruleHasVariationCondition(dsl: DSLRule): boolean {
	function hasVariation(condition: DSLCondition | DSLNestedCondition): boolean {
		if ("field" in condition) {
			return isVariationOperator(condition.operator);
		}
		return condition.conditions.some(c => hasVariation(c));
	}
	return dsl.conditions.some(c => hasVariation(c));
}

/** Get value at dot-separated path; missing path returns undefined (no throw). */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
	if (!path) return undefined;
	return path.split(".").reduce((acc: unknown, key) => {
		if (acc == null || typeof acc !== "object") return undefined;
		return (acc as Record<string, unknown>)[key];
	}, obj);
}

function isSimpleCondition(condition: DSLCondition | DSLNestedCondition): condition is DSLCondition {
	return "field" in condition;
}

/**
 * Evaluates a DSL rule against previousState and currentState.
 * Variation conditions use both values; current-only conditions use only currentState.
 */
export function evaluateVariationDSL(
	dsl: DSLRule,
	previousState: Record<string, unknown>,
	currentState: Record<string, unknown>
): DetailedEvaluationResult {
	const trueConditions: ConditionEvaluationDetail[] = [];
	const falseConditions: ConditionEvaluationDetail[] = [];

	function evaluateSimpleConditionWithTracking(condition: DSLCondition): {
		result: boolean;
		detail: ConditionEvaluationDetail;
	} {
		if (isVariationOperator(condition.operator)) {
			const prev = getValueByPath(previousState, condition.field);
			const curr = getValueByPath(currentState, condition.field);
			const result = evaluateVariationOperator(condition.operator, prev, curr, condition.value);
			const detail: ConditionEvaluationDetail = {
				field: condition.field,
				operator: condition.operator,
				expected_value: condition.value,
				actual_value: { previous: prev, current: curr },
				result
			};
			if (result) trueConditions.push(detail);
			else falseConditions.push(detail);
			return { result, detail };
		}

		// Current-only: reuse single-state evaluator
		const singleConditionDSL: DSLRule = {
			operator: LOGICAL_OPERATOR.AND,
			conditions: [condition]
		};
		const singleResult = evaluateDSLWithTracking(singleConditionDSL, currentState);
		trueConditions.push(...(singleResult.true_conditions ?? []));
		falseConditions.push(...(singleResult.false_conditions ?? []));
		const detail = [...(singleResult.true_conditions ?? []), ...(singleResult.false_conditions ?? [])][0];
		const result = singleResult.result;
		return {
			result,
			detail:
				detail ??
				({
					field: condition.field,
					operator: condition.operator,
					expected_value: condition.value,
					actual_value: getValueByPath(currentState, condition.field),
					result
				} as ConditionEvaluationDetail)
		};
	}

	function evaluateCondition(condition: DSLCondition | DSLNestedCondition): boolean {
		if (isSimpleCondition(condition)) {
			const { result } = evaluateSimpleConditionWithTracking(condition);
			return result;
		}
		if (condition.operator === LOGICAL_OPERATOR.OR) {
			const results = condition.conditions.map(c => evaluateSimpleConditionWithTracking(c).result);
			return results.some(Boolean);
		}
		return false;
	}

	const allResults = dsl.conditions.map(c => evaluateCondition(c));
	const finalResult = allResults.every(Boolean);

	return {
		result: finalResult,
		true_conditions: trueConditions,
		false_conditions: falseConditions
	};
}

/**
 * Single-state DSL evaluator.
 * Evaluates DSL rules against one data payload (case + facts).
 * Used by the workflow engine for triggers and rule conditions.
 */

import jsonLogic from "json-logic-js";
import type { DSLRule, DSLCondition, DSLNestedCondition } from "../types";
import type { DetailedEvaluationResult, ConditionEvaluationDetail } from "#core/evaluators/types";
import { convertSimpleCondition } from "../dslConverter";
import { getValueByPathSupportingArray, pathIsArray } from "../pathResolver";
import { Workflows } from "@joinworth/types";

const LOGICAL_OPERATOR = Workflows.Conditions.LOGICAL_OPERATOR;

/** Reserved key for array-path evaluation; synthetic fields live under this to avoid collisions with user data. */
const EVAL_NAMESPACE = "__workflow_eval__";

/**
 * Type guard to check if a condition is a simple DSL condition (has field property)
 */
function isSimpleCondition(condition: DSLCondition | DSLNestedCondition): condition is DSLCondition {
	return "field" in condition;
}

/**
 * Evaluates a DSL rule and returns detailed result with condition tracking
 * @param dsl - The DSL rule to evaluate
 * @param data - The data object containing case and facts
 * @returns DetailedEvaluationResult with result and classified conditions
 */
export function evaluateDSLWithTracking(dsl: DSLRule, data: Record<string, unknown>): DetailedEvaluationResult {
	const trueConditions: ConditionEvaluationDetail[] = [];
	const falseConditions: ConditionEvaluationDetail[] = [];

	function evaluateSimpleConditionWithTracking(condition: DSLCondition): {
		result: boolean;
		detail: ConditionEvaluationDetail;
	} {
		const fieldValue = getValueByPathSupportingArray(data, condition.field);

		let result: boolean;
		// Only expand to AND-per-element when path contains [*] (e.g. owner_verification[*].…). Plain array fields (e.g. custom_fields.currency) use normal ops (ANY_EQUALS, ARRAY_LENGTH, etc.).
		if (pathIsArray(condition.field) && Array.isArray(fieldValue)) {
			if (fieldValue.length === 0) {
				result = false;
			} else {
				const evalScope: Record<string, unknown> = {};
				fieldValue.forEach((val, i) => {
					evalScope[String(i)] = val;
				});
				const dataWithFields = Object.create(data) as Record<string, unknown>;
				dataWithFields[EVAL_NAMESPACE] = evalScope;
				const comparisons = fieldValue.map((_, i) =>
					convertSimpleCondition({ ...condition, field: `${EVAL_NAMESPACE}.${i}` })
				);
				result = Boolean(jsonLogic.apply({ and: comparisons }, dataWithFields));
			}
		} else {
			const jsonLogicExpr = convertSimpleCondition(condition);
			result = Boolean(jsonLogic.apply(jsonLogicExpr, data));
		}

		const detail: ConditionEvaluationDetail = {
			field: condition.field,
			operator: condition.operator,
			expected_value: condition.value,
			actual_value: fieldValue,
			result
		};

		if (result) {
			trueConditions.push(detail);
		} else {
			falseConditions.push(detail);
		}

		return { result, detail };
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

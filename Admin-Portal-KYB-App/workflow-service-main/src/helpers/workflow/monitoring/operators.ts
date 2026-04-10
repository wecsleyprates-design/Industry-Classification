/**
 * Variation operator evaluation.
 * Each function evaluates (previousValue, currentValue, conditionValue) and returns boolean.
 * Missing path in state is treated as undefined; no throw.
 */

import { Workflows } from "@joinworth/types";
import { isEqual } from "lodash";

const { VARIATION_OPERATOR } = Workflows.Conditions;

function isNumber(x: unknown): x is number {
	return typeof x === "number" && Number.isFinite(x);
}

export function evaluateVariationOperator<V = unknown, C = unknown>(
	operator: string,
	previousValue: V | null | undefined,
	currentValue: V | null | undefined,
	conditionValue: C | null | undefined
): boolean {
	const prev = previousValue;
	const curr = currentValue;
	const val = conditionValue;

	switch (operator) {
		case VARIATION_OPERATOR.INCREASED_BY:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && curr - prev === val;

		case VARIATION_OPERATOR.DECREASED_BY:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev - curr === val;

		case VARIATION_OPERATOR.INCREASED_BY_AT_LEAST:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && curr - prev >= val;

		case VARIATION_OPERATOR.DECREASED_BY_AT_LEAST:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev - curr >= val;

		case VARIATION_OPERATOR.INCREASED_BY_PERCENT:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev !== 0 && ((curr - prev) / prev) * 100 === val;

		case VARIATION_OPERATOR.DECREASED_BY_PERCENT:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev !== 0 && ((prev - curr) / prev) * 100 === val;

		case VARIATION_OPERATOR.CHANGED_FROM_NULL:
			return prev == null && curr != null;

		case VARIATION_OPERATOR.CHANGED_TO_NULL:
			return prev != null && curr == null;

		case VARIATION_OPERATOR.CHANGED:
			return !isEqual(prev, curr);

		case VARIATION_OPERATOR.CROSSED_ABOVE:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev < val && curr >= val;

		case VARIATION_OPERATOR.CROSSED_BELOW:
			return isNumber(prev) && isNumber(curr) && isNumber(val) && prev > val && curr <= val;

		case VARIATION_OPERATOR.BECAME_TRUE:
			return prev === false && curr === true;

		case VARIATION_OPERATOR.BECAME_FALSE:
			return prev === true && curr === false;

		case VARIATION_OPERATOR.UNCHANGED:
			return isEqual(prev, curr);

		case VARIATION_OPERATOR.PERCENT_CHANGE_AT_LEAST:
			return (
				isNumber(prev) && isNumber(curr) && isNumber(val) && prev !== 0 && Math.abs((curr - prev) / prev) * 100 >= val
			);

		default:
			return false;
	}
}

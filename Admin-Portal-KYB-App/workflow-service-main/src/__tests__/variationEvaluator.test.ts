import { initializeJsonLogic } from "#helpers";
import { evaluateVariationDSL } from "#helpers/workflow";
import type { DSLRule } from "#helpers/workflow";
import { Workflows } from "@joinworth/types";

const { VARIATION_OPERATOR } = Workflows.Conditions;

initializeJsonLogic();

describe("evaluateVariationDSL", () => {
	describe("variation operators", () => {
		it("INCREASED_BY: true when current - previous === value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.INCREASED_BY, value: 10 }]
			};
			const prev = { facts: { score: 80 } };
			const curr = { facts: { score: 90 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].actual_value).toEqual({ previous: 80, current: 90 });
		});

		it("INCREASED_BY: false when difference !== value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.INCREASED_BY, value: 10 }]
			};
			const prev = { facts: { score: 80 } };
			const curr = { facts: { score: 95 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(false);
			expect(result.false_conditions).toHaveLength(1);
		});

		it("DECREASED_BY: true when previous - current === value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.DECREASED_BY, value: 10 }]
			};
			const prev = { facts: { score: 90 } };
			const curr = { facts: { score: 80 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("INCREASED_BY_AT_LEAST: true when current - previous >= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.INCREASED_BY_AT_LEAST, value: 10 }]
			};
			const prev = { facts: { score: 80 } };
			const curr = { facts: { score: 95 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("DECREASED_BY_AT_LEAST: true when previous - current >= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.DECREASED_BY_AT_LEAST, value: 10 }]
			};
			const prev = { facts: { score: 95 } };
			const curr = { facts: { score: 80 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("INCREASED_BY_PERCENT: true when percent increase === value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.amount", operator: VARIATION_OPERATOR.INCREASED_BY_PERCENT, value: 20 }]
			};
			const prev = { facts: { amount: 100 } };
			const curr = { facts: { amount: 120 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("DECREASED_BY_PERCENT: true when percent decrease === value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.amount", operator: VARIATION_OPERATOR.DECREASED_BY_PERCENT, value: 20 }]
			};
			const prev = { facts: { amount: 100 } };
			const curr = { facts: { amount: 80 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("CHANGED_FROM_NULL: true when previous null and current has value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.risk_score", operator: VARIATION_OPERATOR.CHANGED_FROM_NULL, value: null }]
			};
			const prev = { facts: { risk_score: null } };
			const curr = { facts: { risk_score: 42 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("CHANGED_TO_NULL: true when previous had value and current null", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.risk_score", operator: VARIATION_OPERATOR.CHANGED_TO_NULL, value: null }]
			};
			const prev = { facts: { risk_score: 42 } };
			const curr = { facts: { risk_score: null } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("CHANGED: true when previous !== current", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.status", operator: VARIATION_OPERATOR.CHANGED, value: null }]
			};
			const prev = { facts: { status: "pending" } };
			const curr = { facts: { status: "active" } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("CROSSED_ABOVE: true when previous < value && current >= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.CROSSED_ABOVE, value: 100 }]
			};
			const prev = { facts: { score: 99 } };
			const curr = { facts: { score: 101 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("CROSSED_BELOW: true when previous > value && current <= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: VARIATION_OPERATOR.CROSSED_BELOW, value: 100 }]
			};
			const prev = { facts: { score: 101 } };
			const curr = { facts: { score: 99 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("BECAME_TRUE: true when previous false and current true", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.flagged", operator: VARIATION_OPERATOR.BECAME_TRUE, value: true }]
			};
			const prev = { facts: { flagged: false } };
			const curr = { facts: { flagged: true } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("BECAME_FALSE: true when previous true and current false", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.flagged", operator: VARIATION_OPERATOR.BECAME_FALSE, value: false }]
			};
			const prev = { facts: { flagged: true } };
			const curr = { facts: { flagged: false } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("UNCHANGED: true when previous === current", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.level", operator: VARIATION_OPERATOR.UNCHANGED, value: 5 }]
			};
			const prev = { facts: { level: 5 } };
			const curr = { facts: { level: 5 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("PERCENT_CHANGE_AT_LEAST: true when |percent change| >= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						field: "facts.amount",
						operator: VARIATION_OPERATOR.PERCENT_CHANGE_AT_LEAST,
						value: 15
					}
				]
			};
			const prev = { facts: { amount: 100 } };
			const curr = { facts: { amount: 85 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});

		it("PERCENT_CHANGE_AT_LEAST: true for increase >= value", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						field: "facts.amount",
						operator: VARIATION_OPERATOR.PERCENT_CHANGE_AT_LEAST,
						value: 15
					}
				]
			};
			const prev = { facts: { amount: 100 } };
			const curr = { facts: { amount: 115 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
		});
	});

	describe("current-only branch", () => {
		it("evaluates non-variation conditions only against currentState", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: ">=", value: 700 }]
			};
			const prev = { facts: { score: 100 } };
			const curr = { facts: { score: 750 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].actual_value).toBe(750);
		});
	});

	describe("mixed rule (variation + current-only)", () => {
		it("evaluates variation and current-only conditions together", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.score", operator: VARIATION_OPERATOR.INCREASED_BY, value: 10 },
					{ field: "facts.country", operator: "=", value: "US" }
				]
			};
			const prev = { facts: { score: 80, country: "US" } };
			const curr = { facts: { score: 90, country: "US" } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(2);
		});

		it("returns false when variation passes but current-only fails", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.score", operator: VARIATION_OPERATOR.INCREASED_BY, value: 10 },
					{ field: "facts.country", operator: "=", value: "CA" }
				]
			};
			const prev = { facts: { score: 80, country: "US" } };
			const curr = { facts: { score: 90, country: "US" } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].field).toBe("facts.country");
		});
	});

	describe("missing path (no throw)", () => {
		it("treats missing path in previousState as undefined", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.risk_score", operator: VARIATION_OPERATOR.CHANGED_FROM_NULL, value: null }]
			};
			const prev = {} as Record<string, unknown>;
			const curr = { facts: { risk_score: 50 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions[0].actual_value).toEqual({ previous: undefined, current: 50 });
		});

		it("treats missing path in currentState as undefined", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.risk_score", operator: VARIATION_OPERATOR.CHANGED_TO_NULL, value: null }]
			};
			const prev = { facts: { risk_score: 50 } };
			const curr = { facts: {} };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions[0].actual_value).toEqual({ previous: 50, current: undefined });
		});
	});

	describe("OR within AND", () => {
		it("evaluates OR group with variation conditions", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						operator: "OR",
						conditions: [
							{ field: "facts.a", operator: VARIATION_OPERATOR.CHANGED, value: null },
							{ field: "facts.b", operator: VARIATION_OPERATOR.UNCHANGED, value: 1 }
						]
					}
				]
			};
			const prev = { facts: { a: 1, b: 1 } };
			const curr = { facts: { a: 1, b: 1 } };
			const result = evaluateVariationDSL(dsl, prev, curr);
			expect(result.result).toBe(true);
			expect(result.true_conditions.some(c => c.operator === VARIATION_OPERATOR.UNCHANGED)).toBe(true);
		});
	});
});

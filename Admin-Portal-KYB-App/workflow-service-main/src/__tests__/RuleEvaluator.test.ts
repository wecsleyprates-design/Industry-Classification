import { RuleEvaluator } from "../core/evaluators/ruleEvaluator";
import type { CaseData } from "../core/types";
import type { WorkflowRule } from "../core/rule/types";
import { ACTION_TYPES, CASE_STATUS } from "../constants";

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn()
	}
}));

import { logger as mockLogger } from "#helpers/logger";

describe("RuleEvaluator", () => {
	const mockCaseData: CaseData = {
		id: "case-123",
		customer_id: "customer-456",
		status: { id: "SUBMITTED", code: "12", label: "SUBMITTED" },
		business_id: "business-789",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockFacts = {
		credit_score: 750,
		annual_income: 50000,
		employment_status: "employed"
	};

	const createMockRule = (conditions: Record<string, unknown>, id = "rule-1", name = "Test Rule"): WorkflowRule => ({
		id,
		workflow_version_id: "version-1",
		name,
		priority: 1,
		conditions,
		actions: {
			type: ACTION_TYPES.SET_FIELD,
			parameters: { field: "case.status", value: CASE_STATUS.AUTO_APPROVED }
		},
		created_by: "user-1",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-1",
		updated_at: new Date("2024-01-01T00:00:00Z")
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("evaluateRule", () => {
		it("should evaluate a simple DSL rule successfully", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.true_conditions).toHaveLength(1);
			expect(result.false_conditions).toHaveLength(0);
			expect(mockLogger.debug).toHaveBeenCalledWith("Evaluating rule rule-1 (Test Rule) against case case-123");
		});

		it("should evaluate a rule with facts data", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
					{ field: "facts.credit_score", operator: ">=", value: 700 }
				]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.true_conditions).toHaveLength(2);
			expect(result.false_conditions).toHaveLength(0);
		});

		it("should return false for non-matching conditions", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [{ field: "case.status.id", operator: "=", value: "REJECTED" }]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
			expect(result.true_conditions).toHaveLength(0);
			expect(result.false_conditions).toHaveLength(1);
		});

		it("should handle complex DSL conditions", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
					{ field: "facts.credit_score", operator: ">=", value: 700 },
					{ field: "facts.annual_income", operator: ">=", value: 30000 },
					{ field: "facts.employment_status", operator: "=", value: "employed" }
				]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.true_conditions).toHaveLength(4);
		});

		it("should handle OR conditions within AND", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.credit_score", operator: ">=", value: 800 },
							{ field: "facts.annual_income", operator: ">=", value: 40000 }
						]
					}
				]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle invalid rule conditions format - array", () => {
			const rule = createMockRule([] as unknown as Record<string, unknown>);

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe("Invalid rule conditions format. Expected DSL format with operator and conditions.");
		});

		it("should handle invalid rule conditions format - null", () => {
			const rule = createMockRule(null as unknown as Record<string, unknown>);

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe("Invalid rule conditions format. Expected DSL object, got: object");
		});

		it("should handle non-DSL format conditions", () => {
			const rule = createMockRule({ "==": [{ var: "case.status" }, "SUBMITTED"] });

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe("Invalid rule conditions format. Expected DSL format with operator and conditions.");
		});

		it("should track condition details with actual values", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [
					{ field: "facts.credit_score", operator: ">=", value: 700 },
					{ field: "facts.annual_income", operator: ">=", value: 100000 }
				]
			});

			const result = RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(result.matched).toBe(false);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.false_conditions).toHaveLength(1);

			const trueCondition = result.true_conditions?.[0];
			expect(trueCondition?.field).toBe("facts.credit_score");
			expect(trueCondition?.actual_value).toBe(750);
			expect(trueCondition?.expected_value).toBe(700);
			expect(trueCondition?.result).toBe(true);

			const falseCondition = result.false_conditions?.[0];
			expect(falseCondition?.field).toBe("facts.annual_income");
			expect(falseCondition?.actual_value).toBe(50000);
			expect(falseCondition?.expected_value).toBe(100000);
			expect(falseCondition?.result).toBe(false);
		});

		it("should log debug information correctly", () => {
			const rule = createMockRule({
				operator: "AND",
				conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
			});

			RuleEvaluator.evaluateRule(rule, mockCaseData, mockFacts);

			expect(mockLogger.debug).toHaveBeenCalledWith("Evaluating rule rule-1 (Test Rule) against case case-123");
			expect(mockLogger.debug).toHaveBeenCalledWith("Rule evaluation result for rule rule-1: true");
		});
	});
});

import { RuleEvaluator } from "#core/evaluators/ruleEvaluator";
import { TriggerEvaluator } from "#core/evaluators/triggerEvaluator";
import type { CaseData } from "#core/types";
import type { Workflow } from "#core/workflow/types";
import type { WorkflowRule } from "#core/rule/types";
import type { WorkflowTriggerCarrier } from "#core/trigger/types";
import { ACTION_TYPES } from "#constants";

describe("DSL Integration", () => {
	const mockCaseData: CaseData = {
		id: "case-123",
		customer_id: "customer-456",
		status: { id: "SUBMITTED", code: "12", label: "SUBMITTED" },
		business_id: "business-789",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockFacts = {
		mcc_code: true,
		naics_code: null
	};

	describe("RuleEvaluator with DSL", () => {
		it("should evaluate DSL rule conditions successfully", () => {
			const dslRule: WorkflowRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "DSL Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{ field: "facts.mcc_code", operator: "=", value: true },
						{ field: "facts.naics_code", operator: "=", value: null }
					]
				},
				actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should evaluate DSL rule with nested OR conditions", () => {
			const dslRule: WorkflowRule = {
				id: "rule-2",
				workflow_version_id: "version-1",
				name: "DSL Nested Rule",
				priority: 2,
				conditions: {
					operator: "AND",
					conditions: [
						{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
						{
							operator: "OR",
							conditions: [
								{ field: "facts.mcc_code", operator: "=", value: true },
								{ field: "facts.naics_code", operator: "!=", value: null }
							]
						}
					]
				},
				actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-2");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return false for non-matching DSL conditions", () => {
			const dslRule: WorkflowRule = {
				id: "rule-3",
				workflow_version_id: "version-1",
				name: "DSL Non-matching Rule",
				priority: 3,
				conditions: {
					operator: "AND",
					conditions: [
						{ field: "case.status.id", operator: "=", value: "APPROVED" }, // This won't match
						{ field: "facts.mcc_code", operator: "=", value: true }
					]
				},
				actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, mockFacts);

			expect(result.rule_id).toBe("rule-3");
			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});
	});

	describe("TriggerEvaluator with DSL", () => {
		it("should evaluate DSL trigger successfully", () => {
			const dslWorkflow: Workflow = {
				id: "workflow-1",
				customer_id: "customer-456",
				name: "DSL Test Workflow",
				description: "Test workflow with DSL trigger",
				active: true,
				priority: 1,
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};
			const carrier: WorkflowTriggerCarrier = {
				id: dslWorkflow.id,
				trigger: {
					operator: "AND",
					conditions: [
						{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
						{ field: "case.customer_id", operator: "=", value: "customer-456" }
					]
				}
			};

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, carrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return false for non-matching DSL trigger", () => {
			const dslWorkflow: Workflow = {
				id: "workflow-2",
				customer_id: "customer-456",
				name: "DSL Non-matching Workflow",
				description: "Test workflow with non-matching DSL trigger",
				active: true,
				priority: 1,
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};
			const carrier: WorkflowTriggerCarrier = {
				id: dslWorkflow.id,
				trigger: {
					operator: "AND",
					conditions: [
						{ field: "case.status.id", operator: "=", value: "APPROVED" },
						{ field: "case.customer_id", operator: "=", value: "customer-456" }
					]
				}
			};

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, carrier);

			expect(result.workflow_id).toBe("workflow-2");
			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});
	});

	describe("DSL format validation", () => {
		it("should reject non-DSL format conditions", () => {
			const jsonLogicRule: WorkflowRule = {
				id: "rule-json",
				workflow_version_id: "version-1",
				name: "JSON Logic Rule",
				priority: 1,
				conditions: {
					and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }, { "==": [{ var: "facts.mcc_code" }, true] }]
				},
				actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const result = RuleEvaluator.evaluateRule(jsonLogicRule, mockCaseData, mockFacts);

			expect(result.matched).toBe(false);
			expect(result.error).toBe("Invalid rule conditions format. Expected DSL format with operator and conditions.");
		});

		it("should accept valid DSL format conditions", () => {
			const dslRule: WorkflowRule = {
				id: "rule-dsl",
				workflow_version_id: "version-1",
				name: "DSL Rule",
				priority: 2,
				conditions: {
					operator: "AND",
					conditions: [
						{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
						{ field: "facts.mcc_code", operator: "=", value: true }
					]
				},
				actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, mockFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe("Nested Facts Properties", () => {
		const createRule = (conditions: Record<string, unknown>, id = "rule-nested"): WorkflowRule => ({
			id,
			workflow_version_id: "version-1",
			name: "Nested Facts Rule",
			priority: 1,
			conditions,
			actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
			created_by: "user-1",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_by: "user-1",
			updated_at: new Date("2024-01-01T00:00:00Z")
		});

		it("should evaluate simple facts property", () => {
			const simpleFacts = {
				credit_score: 750
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: ">=", value: 700 }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, simpleFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should evaluate nested facts property - single level", () => {
			const nestedFacts = {
				primary_address: {
					city: "Winder",
					state: "GA",
					postal_code: "30680"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.primary_address.city", operator: "=", value: "Winder" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should evaluate nested facts property - non-matching value", () => {
			const nestedFacts = {
				primary_address: {
					city: "Atlanta",
					state: "GA"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.primary_address.city", operator: "=", value: "Winder" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should evaluate deeply nested facts property", () => {
			const deeplyNestedFacts = {
				company: {
					address: {
						coordinates: {
							latitude: 33.95,
							longitude: -83.72
						}
					}
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.company.address.coordinates.latitude", operator: ">", value: 33.0 }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, deeplyNestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle multiple nested properties from same base fact", () => {
			const nestedFacts = {
				primary_address: {
					city: "Winder",
					state: "GA",
					postal_code: "30680"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.primary_address.city", operator: "=", value: "Winder" },
					{ field: "facts.primary_address.state", operator: "=", value: "GA" }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle mix of simple and nested facts in same rule", () => {
			const mixedFacts = {
				credit_score: 750,
				primary_address: {
					city: "Winder",
					state: "GA"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.credit_score", operator: ">=", value: 700 },
					{ field: "facts.primary_address.city", operator: "=", value: "Winder" }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, mixedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle nested facts with OR conditions", () => {
			const nestedFacts = {
				primary_address: {
					city: "Marietta",
					state: "GA"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{
						operator: "OR",
						conditions: [
							{ field: "facts.primary_address.city", operator: "=", value: "Atlanta" },
							{ field: "facts.primary_address.city", operator: "=", value: "Marietta" }
						]
					}
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle nested facts with numeric comparisons", () => {
			const nestedFacts = {
				business_info: {
					annual_revenue: 150000,
					employee_count: 25
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.business_info.annual_revenue", operator: ">=", value: 100000 },
					{ field: "facts.business_info.employee_count", operator: "<", value: 50 }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle nested facts with boolean values", () => {
			const nestedFacts = {
				primary_address: {
					city: "Winder",
					is_primary: true,
					is_verified: false
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.primary_address.is_primary", operator: "=", value: true },
					{ field: "facts.primary_address.is_verified", operator: "=", value: false }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle missing nested property gracefully", () => {
			const nestedFacts = {
				primary_address: {
					city: "Winder"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.primary_address.postal_code", operator: "=", value: "30680" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, nestedFacts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});
	});

	describe("IS_NULL and IS_NOT_NULL Operators", () => {
		const createRule = (conditions: Record<string, unknown>, id = "rule-null"): WorkflowRule => ({
			id,
			workflow_version_id: "version-1",
			name: "Null Check Rule",
			priority: 1,
			conditions,
			actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
			created_by: "user-1",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_by: "user-1",
			updated_at: new Date("2024-01-01T00:00:00Z")
		});

		it("should match IS_NULL when value is null", () => {
			const facts = {
				count_of_complaints: null
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.count_of_complaints", operator: "IS_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should not match IS_NULL when value exists", () => {
			const facts = {
				count_of_complaints: 5
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.count_of_complaints", operator: "IS_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should match IS_NULL when value is 0 (zero is not null)", () => {
			const facts = {
				count_of_complaints: 0
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.count_of_complaints", operator: "IS_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should match IS_NOT_NULL when value exists", () => {
			const facts = {
				review_rating: 4.5
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.review_rating", operator: "IS_NOT_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should not match IS_NOT_NULL when value is null", () => {
			const facts = {
				review_rating: null
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.review_rating", operator: "IS_NOT_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should match IS_NOT_NULL when value is 0", () => {
			const facts = {
				count_of_complaints: 0
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.count_of_complaints", operator: "IS_NOT_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should match IS_NOT_NULL when value is empty string", () => {
			const facts = {
				business_name: ""
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.business_name", operator: "IS_NOT_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should combine IS_NULL with other conditions", () => {
			const facts = {
				credit_score: 750,
				watchlist_hits: null
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.credit_score", operator: ">=", value: 700 },
					{ field: "facts.watchlist_hits", operator: "IS_NULL" }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should work with IS_NOT_NULL in OR conditions", () => {
			const facts = {
				tin: "123456789",
				ein: null
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{
						operator: "OR",
						conditions: [
							{ field: "facts.tin", operator: "IS_NOT_NULL" },
							{ field: "facts.ein", operator: "IS_NOT_NULL" }
						]
					}
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe("Date Normalization", () => {
		const createRule = (conditions: Record<string, unknown>, id = "rule-date"): WorkflowRule => ({
			id,
			workflow_version_id: "version-1",
			name: "Date Rule",
			priority: 1,
			conditions,
			actions: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
			created_by: "user-1",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_by: "user-1",
			updated_at: new Date("2024-01-01T00:00:00Z")
		});

		it("should compare dates with same ISO format (full)", () => {
			const facts = {
				filing_date: "2024-06-24T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.filing_date", operator: ">", value: "2024-01-01T00:00:00.000Z" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should compare dates with mixed formats (warehouse ISO full vs rule short)", () => {
			const facts = {
				filing_date: "2024-06-24T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.filing_date", operator: ">", value: "2024-01-01" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle BETWEEN with dates (ISO full vs short range)", () => {
			const facts = {
				filing_date: "2024-06-15T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.filing_date", operator: "BETWEEN", value: ["2024-01-01", "2024-12-31"] }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return false for BETWEEN when date is outside range", () => {
			const facts = {
				filing_date: "2025-06-15T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.filing_date", operator: "BETWEEN", value: ["2024-01-01", "2024-12-31"] }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should handle dates in nested objects", () => {
			const facts = {
				sos_filing: {
					filing_date: "2024-06-24T00:00:00.000Z",
					registration_date: "2020-02-24T00:00:00.000Z"
				}
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.sos_filing.filing_date", operator: ">", value: "2023-01-01" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should compare exact date equality", () => {
			const facts = {
				birth_date: "1990-05-15T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.birth_date", operator: "=", value: "1990-05-15" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle less than date comparison", () => {
			const facts = {
				expiry_date: "2024-06-24T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.expiry_date", operator: "<", value: "2025-01-01" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle multiple date conditions", () => {
			const facts = {
				start_date: "2024-01-15T00:00:00.000Z",
				end_date: "2024-12-15T00:00:00.000Z"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.start_date", operator: ">=", value: "2024-01-01" },
					{ field: "facts.end_date", operator: "<=", value: "2024-12-31" }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should not affect non-date string comparisons", () => {
			const facts = {
				status: "active",
				code: "ABC-123"
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "active" },
					{ field: "facts.code", operator: "=", value: "ABC-123" }
				]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle null date values", () => {
			const facts = {
				dissolution_date: null
			};

			const dslRule = createRule({
				operator: "AND",
				conditions: [{ field: "facts.dissolution_date", operator: "IS_NULL" }]
			});

			const result = RuleEvaluator.evaluateRule(dslRule, mockCaseData, facts);

			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});
});

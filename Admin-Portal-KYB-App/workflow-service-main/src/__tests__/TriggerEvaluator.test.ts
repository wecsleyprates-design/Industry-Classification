import { TriggerEvaluator } from "../core/evaluators/triggerEvaluator";
import type { CaseData } from "../core/types";
import type { Workflow } from "../core/workflow/types";
import type { JsonLogicTrigger } from "../core/trigger/types";
import type { WorkflowTriggerCarrier } from "../core/trigger/types";

// Test utility functions for creating sample triggers
const createSampleTrigger = (): JsonLogicTrigger => {
	return {
		and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }]
	};
};

const createComplexSampleTrigger = (): JsonLogicTrigger => {
	return {
		and: [
			{ "==": [{ var: "case.status.id" }, "SUBMITTED"] },
			{ "!=": [{ var: "case.customer_id" }, null] },
			{
				or: [
					{ "!=": [{ var: "case.business_id" }, null] },
					{ in: [{ var: "case.status.id" }, ["SUBMITTED", "PENDING"]] }
				]
			}
		]
	};
};

describe("TriggerEvaluator", () => {
	const mockCaseData: CaseData = {
		id: "case-123",
		customer_id: "customer-456",
		status: { id: "SUBMITTED", code: "12", label: "SUBMITTED" },
		business_id: "business-789",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockWorkflow: Workflow = {
		id: "workflow-1",
		customer_id: "customer-456",
		name: "Test Workflow",
		description: "Test workflow for case submission",
		active: true,
		created_by: "user-1",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-1",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};
	const baseCarrier: WorkflowTriggerCarrier = {
		id: mockWorkflow.id,
		trigger: {
			and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }]
		}
	};

	describe("evaluateTrigger", () => {
		it("should return true when case status matches JSON Logic trigger condition", () => {
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, baseCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return false when case status does not match JSON Logic trigger condition", () => {
			const caseDataWithDifferentStatus: CaseData = {
				...mockCaseData,
				status: { id: "DRAFT", code: "DRAFT", label: "DRAFT" }
			};

			const result = TriggerEvaluator.evaluateTrigger(caseDataWithDifferentStatus, baseCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should handle complex JSON Logic trigger conditions", () => {
			const complexCarrier: WorkflowTriggerCarrier = {
				id: mockWorkflow.id,
				trigger: {
					and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }, { "!=": [{ var: "case.business_id" }, null] }]
				}
			};

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, complexCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(true);
		});

		it("should handle invalid JSON Logic trigger expressions gracefully", () => {
			const invalidCarrier: WorkflowTriggerCarrier = {
				id: mockWorkflow.id,
				trigger: null as unknown as JsonLogicTrigger
			};

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, invalidCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe("No trigger defined for workflow");
		});

		it("should reject array format triggers", () => {
			const formatCarrier: WorkflowTriggerCarrier = {
				id: mockWorkflow.id,
				trigger: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }] as unknown as JsonLogicTrigger
			};

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, formatCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe(
				"Invalid trigger format. No valid JSON Logic operators found. Expected valid JSON Logic or DSL format."
			);
		});

		it("should reject null triggers", () => {
			const nullTriggerCarrier: WorkflowTriggerCarrier = { id: mockWorkflow.id, trigger: undefined };

			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, nullTriggerCarrier);

			expect(result.workflow_id).toBe("workflow-1");
			expect(result.matched).toBe(false);
			expect(result.error).toBe("No trigger defined for workflow");
		});
	});

	describe("validateTrigger", () => {
		it("should return true for valid JSON Logic trigger expressions", () => {
			const validTrigger = {
				and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }]
			};

			const testCarrier = { id: mockWorkflow.id, trigger: validTrigger };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(true);
		});

		it("should return false for invalid JSON Logic trigger expressions", () => {
			const invalidTrigger = {
				invalid_operator: ["invalid", "expression"]
			};

			const testCarrier = { id: mockWorkflow.id, trigger: invalidTrigger };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(false);
		});

		it("should return false for array format triggers", () => {
			const trigger = [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }] as unknown as JsonLogicTrigger;

			const testCarrier = { id: mockWorkflow.id, trigger };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(false);
		});

		it("should return false for null triggers", () => {
			const testCarrier = { id: mockWorkflow.id, trigger: undefined };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(false);
		});
	});

	describe("createSampleTrigger", () => {
		it("should return a valid JSON Logic sample trigger expression", () => {
			const sampleTrigger = createSampleTrigger();

			expect(sampleTrigger).toBeDefined();
			expect(typeof sampleTrigger).toBe("object");
			expect(Array.isArray(sampleTrigger)).toBe(false);
			expect(sampleTrigger).toEqual({
				and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }]
			});

			// Validate that the sample trigger is actually valid
			const testCarrier = { id: mockWorkflow.id, trigger: sampleTrigger };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(true);
		});
	});

	describe("createComplexSampleTrigger", () => {
		it("should return a valid complex JSON Logic sample trigger expression", () => {
			const complexTrigger = createComplexSampleTrigger();

			expect(complexTrigger).toBeDefined();
			expect(typeof complexTrigger).toBe("object");
			expect(Array.isArray(complexTrigger)).toBe(false);
			expect(complexTrigger).toEqual({
				and: [
					{ "==": [{ var: "case.status.id" }, "SUBMITTED"] },
					{ "!=": [{ var: "case.customer_id" }, null] },
					{
						or: [
							{ "!=": [{ var: "case.business_id" }, null] },
							{ in: [{ var: "case.status.id" }, ["SUBMITTED", "PENDING"]] }
						]
					}
				]
			});

			// Validate that the complex sample trigger is actually valid
			const testCarrier = { id: mockWorkflow.id, trigger: complexTrigger };
			const result = TriggerEvaluator.evaluateTrigger(mockCaseData, testCarrier);
			expect(result.matched).toBe(true);
		});
	});
});

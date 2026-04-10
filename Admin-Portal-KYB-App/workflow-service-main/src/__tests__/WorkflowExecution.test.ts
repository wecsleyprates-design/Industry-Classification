import type { WorkflowExecutionResult, EvaluationLog } from "../core/evaluators/types";
import { ACTION_TYPES } from "../constants/workflow.constants";

describe("WorkflowExecutionResult", () => {
	describe("type validation", () => {
		it("should accept both single action and array of actions", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			const singleAction: WorkflowExecutionResult = {
				workflow_id: "workflow-123",
				applied_action: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				default_applied: false,
				case_id: "case-456",
				workflow_version_id: "version-789",
				matched_rule_id: "rule-101",
				input_attr: {},
				evaluation_log: evaluationLog,
				latency_ms: 150
			};

			const multipleActions: WorkflowExecutionResult = {
				workflow_id: "workflow-123",
				applied_action: [
					{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
					{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.priority", value: "HIGH" } }
				],
				default_applied: false,
				case_id: "case-456",
				workflow_version_id: "version-789",
				matched_rule_id: "rule-101",
				input_attr: {},
				evaluation_log: evaluationLog,
				latency_ms: 150
			};

			// Both should be valid TypeScript types
			expect(typeof singleAction.applied_action).toBe("object");
			expect(Array.isArray(multipleActions.applied_action)).toBe(true);
		});

		it("should handle optional matched_rule_id field", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			// Test with matched_rule_id
			const withRule: WorkflowExecutionResult = {
				workflow_id: "workflow-123",
				applied_action: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				default_applied: false,
				case_id: "case-456",
				workflow_version_id: "version-789",
				matched_rule_id: "rule-101",
				input_attr: {},
				evaluation_log: evaluationLog,
				latency_ms: 150
			};

			// Test without matched_rule_id
			const withoutRule: WorkflowExecutionResult = {
				workflow_id: "workflow-123",
				applied_action: { type: ACTION_TYPES.SET_FIELD, parameters: { field: "case.status", value: "APPROVED" } },
				default_applied: false,
				case_id: "case-456",
				workflow_version_id: "version-789",
				matched_rule_id: undefined,
				input_attr: {},
				evaluation_log: evaluationLog,
				latency_ms: 150
			};

			expect(withRule.matched_rule_id).toBe("rule-101");
			expect(withoutRule.matched_rule_id).toBeUndefined();
		});
	});
});

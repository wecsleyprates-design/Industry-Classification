import { DefaultActionChangeDetector } from "#core/versioning/detectors/defaultAction/defaultActionChangeDetector";
import { WorkflowVersionWithRulesAndTriggerConditions, UpdateWorkflowRequest } from "#core/versioning/types";
import { ACTION_TYPES, VERSION_CHANGE_TYPES } from "#constants";

describe("DefaultActionChangeDetector", () => {
	let detector: DefaultActionChangeDetector;
	let mockWorkflowVersion: WorkflowVersionWithRulesAndTriggerConditions;
	let mockUpdateRequest: UpdateWorkflowRequest;

	beforeEach(() => {
		detector = new DefaultActionChangeDetector();
		mockWorkflowVersion = {
			id: "version-123",
			workflow_id: "workflow-123",
			trigger_id: "trigger-123",
			version_number: 1,
			status: "published",
			is_current: true,
			created_by: "user-123",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_by: "user-123",
			updated_at: new Date("2024-01-01T00:00:00Z"),
			default_action: {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			},
			rules: []
		};
		mockUpdateRequest = {
			default_action: {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "rejected" }
			}
		};
	});

	describe("getFieldPath", () => {
		it("should return default_action field path", () => {
			const result = detector.getFieldPath();
			expect(result).toBe("default_action");
		});
	});

	describe("hasChanged", () => {
		it("should return true when default_action has changed", () => {
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});

		it("should return false when default_action is the same", () => {
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			};
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return false when default_action is undefined", () => {
			mockUpdateRequest.default_action = undefined;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return false when default_action is not provided", () => {
			delete mockUpdateRequest.default_action;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return true when old default_action is undefined and new one is provided", () => {
			mockWorkflowVersion.default_action = undefined;
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			};
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});

		it("should return true when old default_action is null and new one is provided", () => {
			mockWorkflowVersion.default_action = null as any;
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			};
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});

		it("should return false when both default_actions are null", () => {
			mockWorkflowVersion.default_action = null as any;
			mockUpdateRequest.default_action = null as any;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return false when both default_actions are undefined", () => {
			mockWorkflowVersion.default_action = undefined;
			mockUpdateRequest.default_action = undefined;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});
	});

	describe("detectChanges", () => {
		it("should detect default action changes", () => {
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "default_action",
				old_value: '{"type":"set_field","parameters":{"field":"status","value":"approved"}}',
				new_value: '{"type":"set_field","parameters":{"field":"status","value":"rejected"}}',
				change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
			});
		});

		it("should return empty array when default_action is undefined", () => {
			mockUpdateRequest.default_action = undefined;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should return empty array when default_action is not provided", () => {
			delete mockUpdateRequest.default_action;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should handle undefined old default_action", () => {
			mockWorkflowVersion.default_action = undefined;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "default_action",
				old_value: "undefined",
				new_value: '{"type":"set_field","parameters":{"field":"status","value":"rejected"}}',
				change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
			});
		});

		it("should handle null old default_action", () => {
			mockWorkflowVersion.default_action = null as any;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "default_action",
				old_value: "null",
				new_value: '{"type":"set_field","parameters":{"field":"status","value":"rejected"}}',
				change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
			});
		});

		it("should detect changes when default_action parameters change", () => {
			// Test with different field parameter
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "case.priority", value: "HIGH" }
			};

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "default_action",
				old_value: '{"type":"set_field","parameters":{"field":"status","value":"approved"}}',
				new_value: '{"type":"set_field","parameters":{"field":"case.priority","value":"HIGH"}}',
				change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
			});
		});

		it("should handle array default_actions", () => {
			mockWorkflowVersion.default_action = [
				{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "status", value: "approved" } },
				{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "priority", value: "HIGH" } }
			];
			(mockUpdateRequest as any).default_action = [
				{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "status", value: "rejected" } },
				{ type: ACTION_TYPES.SET_FIELD, parameters: { field: "priority", value: "LOW" } }
			];

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
			expect(result[0].old_value).toContain("approved");
			expect(result[0].new_value).toContain("rejected");
		});

		it("should handle complex nested default_actions", () => {
			mockWorkflowVersion.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "priority",
					value: "HIGH",
					condition: { field: "amount", operator: ">", value: 1000 }
				}
			};
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "priority",
					value: "CRITICAL",
					condition: { field: "amount", operator: ">", value: 5000 }
				}
			};

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
			expect(result[0].old_value).toContain("1000");
			expect(result[0].new_value).toContain("5000");
		});

		it("should return empty array when default_actions are the same", () => {
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			};
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toEqual([]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty object default_actions", () => {
			(mockWorkflowVersion as any).default_action = {};
			mockUpdateRequest.default_action = { type: ACTION_TYPES.SET_FIELD, parameters: {} };

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
		});

		it("should handle default_actions with circular references", () => {
			const circularAction: any = { type: ACTION_TYPES.SET_FIELD, parameters: {} };
			circularAction.self = circularAction;

			mockWorkflowVersion.default_action = circularAction;
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "approved" }
			};

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
		});

		it("should handle default_actions with functions", () => {
			(mockWorkflowVersion as any).default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "test", callback: () => "test" }
			};
			(mockUpdateRequest as any).default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "updated", callback: () => "updated" }
			};

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
		});

		it("should handle very deep nested default_actions", () => {
			let deepAction: any = { type: ACTION_TYPES.SET_FIELD, parameters: { field: "status", value: "approved" } };
			for (let i = 0; i < 10; i++) {
				deepAction = { nested: deepAction };
			}

			mockWorkflowVersion.default_action = deepAction;
			mockUpdateRequest.default_action = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "status", value: "rejected" }
			};

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].change_type).toBe("default_action_changed");
		});
	});
});

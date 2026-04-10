import { TriggerChangeDetector } from "#core/versioning/detectors/trigger/triggerChangeDetector";
import { WorkflowVersionWithRulesAndTriggerConditions, UpdateWorkflowRequest } from "#core/versioning/types";
import { VERSION_CHANGE_TYPES } from "#constants";

describe("TriggerChangeDetector", () => {
	let detector: TriggerChangeDetector;
	let mockWorkflowVersion: WorkflowVersionWithRulesAndTriggerConditions;
	let mockUpdateRequest: UpdateWorkflowRequest;

	beforeEach(() => {
		detector = new TriggerChangeDetector();
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
			rules: []
		};
		mockUpdateRequest = {
			trigger_id: "trigger-456"
		};
	});

	describe("getFieldPath", () => {
		it("should return trigger_id field path", () => {
			const result = detector.getFieldPath();
			expect(result).toBe("trigger_id");
		});
	});

	describe("hasChanged", () => {
		it("should return true when trigger_id has changed", () => {
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});

		it("should return false when trigger_id is the same", () => {
			mockUpdateRequest.trigger_id = "trigger-123";
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return false when trigger_id is undefined", () => {
			mockUpdateRequest.trigger_id = undefined;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return false when trigger_id is not provided", () => {
			delete mockUpdateRequest.trigger_id;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(false);
		});

		it("should return true when old trigger_id is undefined and new one is provided", () => {
			(mockWorkflowVersion as any).trigger_id = undefined;
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});

		it("should return true when old trigger_id is undefined and new one is provided", () => {
			(mockWorkflowVersion as any).trigger_id = undefined;
			mockUpdateRequest.trigger_id = "trigger-456";
			const result = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toBe(true);
		});
	});

	describe("detectChanges", () => {
		it("should detect trigger changes", () => {
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "trigger_id",
				old_value: "trigger-123",
				new_value: "trigger-456",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			});
		});

		it("should return empty array when trigger_id is undefined", () => {
			mockUpdateRequest.trigger_id = undefined;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should return empty array when trigger_id is not provided", () => {
			delete mockUpdateRequest.trigger_id;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should handle undefined old trigger_id", () => {
			(mockWorkflowVersion as any).trigger_id = undefined;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "trigger_id",
				old_value: undefined,
				new_value: "trigger-456",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			});
		});

		it("should handle null old trigger_id", () => {
			mockWorkflowVersion.trigger_id = null as any;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "trigger_id",
				old_value: null,
				new_value: "trigger-456",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			});
		});

		it("should handle empty string old trigger_id", () => {
			mockWorkflowVersion.trigger_id = "";
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "trigger_id",
				old_value: "",
				new_value: "trigger-456",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			});
		});

		it("should detect change when new trigger_id is different", () => {
			mockUpdateRequest.trigger_id = "trigger-999";

			const hasChanged = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(hasChanged).toBe(true);

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "trigger_id",
				old_value: "trigger-123",
				new_value: "trigger-999",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			});
		});

		it("should not create change records for empty string trigger_id", () => {
			// This test documents the current behavior: empty strings are considered falsy
			// and therefore no change records are created, even though hasChanged returns true
			mockUpdateRequest.trigger_id = "";

			const hasChanged = detector.hasChanged(mockWorkflowVersion, mockUpdateRequest);
			expect(hasChanged).toBe(true); // hasChanged detects the difference

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]); // But createChangeRecords returns empty array for falsy values
		});

		it("should return empty array when trigger_id values are the same", () => {
			mockUpdateRequest.trigger_id = "trigger-123";
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toEqual([]);
		});
	});

	describe("edge cases", () => {
		it("should handle very long trigger IDs", () => {
			const longTriggerId = "a".repeat(1000);
			mockUpdateRequest.trigger_id = longTriggerId;
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].new_value).toBe(longTriggerId);
		});

		it("should handle trigger IDs with special characters", () => {
			mockUpdateRequest.trigger_id = "trigger-123_@#$%";
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].new_value).toBe("trigger-123_@#$%");
		});

		it("should handle trigger IDs with unicode characters", () => {
			mockUpdateRequest.trigger_id = "trigger-🚀-emoji";
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1);
			expect(result[0].new_value).toBe("trigger-🚀-emoji");
		});
	});
});

import { BaseChangeDetector } from "#core/versioning/detectors/base/baseChangeDetector";
import {
	VersionChange,
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest
} from "#core/versioning/types";

// Concrete implementation for testing
class TestChangeDetector extends BaseChangeDetector {
	private shouldDetectChanges: boolean = true;
	private mockChanges: VersionChange[] = [];

	constructor(shouldDetectChanges: boolean = true, mockChanges: VersionChange[] = []) {
		super();
		this.shouldDetectChanges = shouldDetectChanges;
		this.mockChanges = mockChanges;
	}

	getFieldPath(): string {
		return "test_field";
	}

	hasChanged(_oldData: WorkflowVersionWithRulesAndTriggerConditions, _request: UpdateWorkflowRequest): boolean {
		return this.shouldDetectChanges;
	}

	protected createChangeRecords(
		_oldData: WorkflowVersionWithRulesAndTriggerConditions,
		_request: UpdateWorkflowRequest
	): VersionChange[] {
		return this.mockChanges;
	}
}

describe("BaseChangeDetector", () => {
	let detector: TestChangeDetector;
	let mockWorkflowVersion: WorkflowVersionWithRulesAndTriggerConditions;
	let mockUpdateRequest: UpdateWorkflowRequest;

	beforeEach(() => {
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

	describe("detectChanges", () => {
		it("should return empty array when no changes detected", () => {
			detector = new TestChangeDetector(false, []);
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should return change records when changes detected", () => {
			const mockChanges: VersionChange[] = [
				{
					field_path: "test_field",
					old_value: "old_value",
					new_value: "new_value",
					change_type: "trigger_changed"
				}
			];
			detector = new TestChangeDetector(true, mockChanges);

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual(mockChanges);
		});

		it("should return multiple change records when changes detected", () => {
			const mockChanges: VersionChange[] = [
				{
					field_path: "test_field_1",
					old_value: "old_value_1",
					new_value: "new_value_1",
					change_type: "trigger_changed"
				},
				{
					field_path: "test_field_2",
					old_value: "old_value_2",
					new_value: "new_value_2",
					change_type: "rule_modified"
				}
			];
			detector = new TestChangeDetector(true, mockChanges);

			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual(mockChanges);
			expect(result).toHaveLength(2);
		});

		it("should call hasChanged before createChangeRecords", () => {
			const hasChangedSpy = jest.spyOn(TestChangeDetector.prototype, "hasChanged");
			const createChangeRecordsSpy = jest.spyOn(
				TestChangeDetector.prototype as unknown as { createChangeRecords: jest.Mock },
				"createChangeRecords"
			);

			detector = new TestChangeDetector(true, []);
			detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(hasChangedSpy).toHaveBeenCalledWith(mockWorkflowVersion, mockUpdateRequest);
			expect(createChangeRecordsSpy).toHaveBeenCalledWith(mockWorkflowVersion, mockUpdateRequest);

			hasChangedSpy.mockRestore();
			createChangeRecordsSpy.mockRestore();
		});

		it("should not call createChangeRecords when hasChanged returns false", () => {
			const hasChangedSpy = jest.spyOn(TestChangeDetector.prototype, "hasChanged");
			const createChangeRecordsSpy = jest.spyOn(
				TestChangeDetector.prototype as unknown as { createChangeRecords: jest.Mock },
				"createChangeRecords"
			);

			detector = new TestChangeDetector(false, []);
			detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(hasChangedSpy).toHaveBeenCalledWith(mockWorkflowVersion, mockUpdateRequest);
			expect(createChangeRecordsSpy).not.toHaveBeenCalled();

			hasChangedSpy.mockRestore();
			createChangeRecordsSpy.mockRestore();
		});
	});

	describe("abstract methods", () => {
		it("should have hasChanged as abstract method", () => {
			expect(() => {
				new (class extends BaseChangeDetector {
					getFieldPath(): string {
						return "test";
					}
					hasChanged(): boolean {
						return true;
					}
					protected createChangeRecords(): VersionChange[] {
						return [];
					}
				})();
			}).not.toThrow();
		});

		it("should have createChangeRecords as abstract method", () => {
			expect(() => {
				new (class extends BaseChangeDetector {
					getFieldPath(): string {
						return "test";
					}
					hasChanged(): boolean {
						return true;
					}
					protected createChangeRecords(): VersionChange[] {
						return [];
					}
				})();
			}).not.toThrow();
		});

		it("should have getFieldPath as abstract method", () => {
			expect(() => {
				new (class extends BaseChangeDetector {
					getFieldPath(): string {
						return "test";
					}
					hasChanged(): boolean {
						return true;
					}
					protected createChangeRecords(): VersionChange[] {
						return [];
					}
				})();
			}).not.toThrow();
		});
	});

	describe("template method pattern", () => {
		it("should follow template method pattern correctly", () => {
			// Test that the template method calls the abstract methods in the correct order
			const hasChangedSpy = jest.spyOn(TestChangeDetector.prototype, "hasChanged");
			const createChangeRecordsSpy = jest.spyOn(
				TestChangeDetector.prototype as unknown as { createChangeRecords: jest.Mock },
				"createChangeRecords"
			);

			// Mock hasChanged to return true
			hasChangedSpy.mockReturnValue(true);

			const mockChanges: VersionChange[] = [
				{
					field_path: "test_field",
					old_value: "old_value",
					new_value: "new_value",
					change_type: "trigger_changed"
				}
			];
			createChangeRecordsSpy.mockReturnValue(mockChanges);

			detector = new TestChangeDetector();
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			// Verify the template method pattern
			expect(hasChangedSpy).toHaveBeenCalled();
			expect(createChangeRecordsSpy).toHaveBeenCalled();
			expect(result).toEqual(mockChanges);

			hasChangedSpy.mockRestore();
			createChangeRecordsSpy.mockRestore();
		});

		it("should handle hasChanged returning false", () => {
			const hasChangedSpy = jest.spyOn(TestChangeDetector.prototype, "hasChanged");
			const createChangeRecordsSpy = jest.spyOn(
				TestChangeDetector.prototype as unknown as { createChangeRecords: jest.Mock },
				"createChangeRecords"
			);

			// Mock hasChanged to return false
			hasChangedSpy.mockReturnValue(false);

			detector = new TestChangeDetector();
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			// Verify that createChangeRecords is not called when hasChanged returns false
			expect(hasChangedSpy).toHaveBeenCalledWith(mockWorkflowVersion, mockUpdateRequest);
			expect(createChangeRecordsSpy).not.toHaveBeenCalled();
			expect(result).toEqual([]);

			hasChangedSpy.mockRestore();
			createChangeRecordsSpy.mockRestore();
		});
	});

	describe("edge cases", () => {
		it("should handle null oldData", () => {
			detector = new TestChangeDetector(true, []);
			expect(() => {
				detector.detectChanges(null as unknown as WorkflowVersionWithRulesAndTriggerConditions, mockUpdateRequest);
			}).not.toThrow();
		});

		it("should handle null request", () => {
			detector = new TestChangeDetector(true, []);
			expect(() => {
				detector.detectChanges(mockWorkflowVersion, null as unknown as UpdateWorkflowRequest);
			}).not.toThrow();
		});

		it("should handle undefined oldData", () => {
			detector = new TestChangeDetector(true, []);
			expect(() => {
				detector.detectChanges(undefined as unknown as WorkflowVersionWithRulesAndTriggerConditions, mockUpdateRequest);
			}).not.toThrow();
		});

		it("should handle undefined request", () => {
			detector = new TestChangeDetector(true, []);
			expect(() => {
				detector.detectChanges(mockWorkflowVersion, undefined as unknown as UpdateWorkflowRequest);
			}).not.toThrow();
		});

		it("should handle empty change records", () => {
			detector = new TestChangeDetector(true, []);
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);
			expect(result).toEqual([]);
		});

		it("should handle large number of change records", () => {
			const largeChangeRecords: VersionChange[] = Array.from({ length: 1000 }, (_, i) => ({
				field_path: `test_field_${i}`,
				old_value: `old_value_${i}`,
				new_value: `new_value_${i}`,
				change_type: "trigger_changed"
			}));

			detector = new TestChangeDetector(true, largeChangeRecords);
			const result = detector.detectChanges(mockWorkflowVersion, mockUpdateRequest);

			expect(result).toHaveLength(1000);
			expect(result[0].field_path).toBe("test_field_0");
			expect(result[999].field_path).toBe("test_field_999");
		});
	});
});

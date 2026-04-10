import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import { ChangeDetectorFactory } from "#core/versioning/factories/changeDetectorFactory";
import { BaseChangeDetector } from "#core/versioning/detectors";
import {
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest,
	VersionChange
} from "#core/versioning/types";
import { WORKFLOW_STATUS, VERSION_CHANGE_TYPES } from "#constants";

jest.mock("../factories/changeDetectorFactory");

class MockDetector extends BaseChangeDetector {
	constructor(
		private fieldPath: string,
		private hasChangedResult: boolean,
		private changesResult: VersionChange[]
	) {
		super();
	}

	getFieldPath(): string {
		return this.fieldPath;
	}

	hasChanged(_oldData: WorkflowVersionWithRulesAndTriggerConditions, _request: UpdateWorkflowRequest): boolean {
		return this.hasChangedResult;
	}

	protected createChangeRecords(
		_oldData: WorkflowVersionWithRulesAndTriggerConditions,
		_request: UpdateWorkflowRequest
	): VersionChange[] {
		return this.changesResult;
	}
}

describe("VersionChangeDetector", () => {
	let mockDetectors: MockDetector[];

	const mockWorkflowVersion: WorkflowVersionWithRulesAndTriggerConditions = {
		id: "version-123",
		workflow_id: "workflow-456",
		trigger_id: "trigger-789",
		version_number: 1,
		status: WORKFLOW_STATUS.PUBLISHED,
		snapshot: {},
		default_action: {
			type: "set_field",
			parameters: { field: "case.status", value: "APPROVED" }
		},
		is_current: true,
		published_at: new Date("2024-01-01T00:00:00Z"),
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z"),
		rules: [
			{
				id: "rule-1",
				workflow_version_id: "version-123",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
				},
				actions: [
					{
						type: "set_field",
						parameters: { field: "case.priority", value: "HIGH" }
					}
				],
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockDetectors = [
			new MockDetector("trigger_id", false, []),
			new MockDetector("rules", false, []),
			new MockDetector("default_action", false, [])
		];
		(ChangeDetectorFactory.createDetectors as jest.Mock).mockReturnValue(mockDetectors);
		VersionChangeDetector.refreshDetectors();
	});

	describe("requiresNewVersion", () => {
		it("should return true when any detector detects changes", () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			mockDetectors[0].hasChanged = jest.fn().mockReturnValue(true);

			const result = VersionChangeDetector.requiresNewVersion(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});

		it("should return false when no detectors detect changes", () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "trigger-789"
			};

			mockDetectors.forEach(detector => {
				detector.hasChanged = jest.fn().mockReturnValue(false);
			});

			const result = VersionChangeDetector.requiresNewVersion(mockWorkflowVersion, updateRequest);

			expect(result).toBe(false);
		});

		it("should return true when multiple detectors detect changes", () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123",
				default_action: {
					type: "set_field",
					parameters: { field: "case.status", value: "REJECTED" }
				}
			};

			mockDetectors[0].hasChanged = jest.fn().mockReturnValue(true);
			mockDetectors[2].hasChanged = jest.fn().mockReturnValue(true);

			const result = VersionChangeDetector.requiresNewVersion(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});
	});

	describe("getChangedFields", () => {
		it("should return changes from all detectors", () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			const triggerChanges: VersionChange[] = [
				{
					field_path: "trigger_id",
					old_value: "trigger-789",
					new_value: "new-trigger-123",
					change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
				}
			];

			const defaultActionChanges: VersionChange[] = [
				{
					field_path: "workflow_versions.default_action",
					old_value: "old-action",
					new_value: "new-action",
					change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
				}
			];

			mockDetectors[0].hasChanged = jest.fn().mockReturnValue(true);
			mockDetectors[0].detectChanges = jest.fn().mockReturnValue(triggerChanges);
			mockDetectors[2].hasChanged = jest.fn().mockReturnValue(true);
			mockDetectors[2].detectChanges = jest.fn().mockReturnValue(defaultActionChanges);

			const result = VersionChangeDetector.getChangedFields(mockWorkflowVersion, updateRequest);

			expect(result).toHaveLength(2);
			expect(result).toEqual([...triggerChanges, ...defaultActionChanges]);
		});

		it("should return empty array when no changes detected", () => {
			const updateRequest: UpdateWorkflowRequest = {};

			mockDetectors.forEach(detector => {
				detector.hasChanged = jest.fn().mockReturnValue(false);
			});

			const result = VersionChangeDetector.getChangedFields(mockWorkflowVersion, updateRequest);

			expect(result).toEqual([]);
		});

		it("should handle detectors that detect changes but return empty change records", () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			mockDetectors[0].hasChanged = jest.fn().mockReturnValue(true);
			mockDetectors[0].detectChanges = jest.fn().mockReturnValue([]);

			const result = VersionChangeDetector.getChangedFields(mockWorkflowVersion, updateRequest);

			expect(result).toEqual([]);
		});
	});

	describe("refreshDetectors", () => {
		it("should refresh detectors using factory", () => {
			const newDetectors = [new MockDetector("new-field", false, [])];
			(ChangeDetectorFactory.createDetectors as jest.Mock).mockReturnValue(newDetectors);

			VersionChangeDetector.refreshDetectors();

			expect(ChangeDetectorFactory.createDetectors).toHaveBeenCalled();
		});
	});

	describe("getDetectors", () => {
		it("should return copy of current detectors", () => {
			const detectors = VersionChangeDetector.getDetectors();

			expect(detectors).toEqual(mockDetectors);
			expect(detectors).not.toBe(mockDetectors);
		});

		it("should return empty array when no detectors", () => {
			(ChangeDetectorFactory.createDetectors as jest.Mock).mockReturnValue([]);
			VersionChangeDetector.refreshDetectors();

			const detectors = VersionChangeDetector.getDetectors();

			expect(detectors).toEqual([]);
		});
	});
});

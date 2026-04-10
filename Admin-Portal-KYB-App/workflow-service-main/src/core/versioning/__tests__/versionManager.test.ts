import { VersionManager } from "#core/versioning/versionManager";
import { VersionRepository } from "#core/versioning/versionRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import {
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest,
	VersionChange
} from "#core/versioning/types";
import type { WorkflowVersion } from "#core/versioning/types";
import { WORKFLOW_STATUS, VERSION_CHANGE_TYPES, WORKFLOW_CHANGE_TYPES } from "#constants";
import { UserInfo } from "#types/common";

jest.mock("#core/workflow/workflowRepository");
jest.mock("#core/versioning/versionRepository");
jest.mock("#core/rule/ruleRepository");
jest.mock("#core/audit/auditRepository");
jest.mock("#core/versioning/versionChangeDetector");
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn()
	}
}));

describe("VersionManager", () => {
	let versionManager: VersionManager;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockRuleRepository: jest.Mocked<RuleRepository>;
	let mockAuditRepository: jest.Mocked<AuditRepository>;

	const mockCurrentVersion: WorkflowVersionWithRulesAndTriggerConditions = {
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

	const mockNewVersion: WorkflowVersion = {
		id: "version-124",
		workflow_id: "workflow-456",
		trigger_id: "trigger-789",
		version_number: 2,
		status: WORKFLOW_STATUS.DRAFT,
		snapshot: {},
		default_action: {
			type: "set_field",
			parameters: { field: "case.status", value: "APPROVED" }
		},
		is_current: false,
		published_at: undefined,
		created_by: "user-123",
		created_at: new Date("2024-01-02T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-02T00:00:00Z")
	};

	const mockUserInfo: UserInfo = {
		user_id: "user-123",
		email: "user@example.com",
		role: {
			id: 1,
			code: "admin"
		},
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-456"
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockVersionRepository = {
			createWorkflowVersion: jest.fn()
		} as unknown as jest.Mocked<VersionRepository>;

		mockRuleRepository = {
			insertRule: jest.fn()
		} as unknown as jest.Mocked<RuleRepository>;

		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn().mockResolvedValue(undefined)
		} as unknown as jest.Mocked<AuditRepository>;

		(VersionRepository as jest.Mock).mockImplementation(() => mockVersionRepository);
		(RuleRepository as jest.Mock).mockImplementation(() => mockRuleRepository);
		(AuditRepository as jest.Mock).mockImplementation(() => mockAuditRepository);
		versionManager = new VersionManager(mockVersionRepository, mockRuleRepository, mockAuditRepository);
	});

	describe("createVersion", () => {
		it("should create new version with trigger change and log version creation for published version", async () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			const mockChanges: VersionChange[] = [
				{
					field_path: "trigger_id",
					old_value: "trigger-789",
					new_value: "new-trigger-123",
					change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
				}
			];

			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockChanges);
			mockVersionRepository.createWorkflowVersion.mockResolvedValue(mockNewVersion);

			const result = await versionManager.createVersion(
				mockCurrentVersion,
				updateRequest,
				mockUserInfo,
				mockUserInfo.customer_id
			);

			expect(VersionChangeDetector.getChangedFields).toHaveBeenCalledWith(mockCurrentVersion, updateRequest);
			expect(mockVersionRepository.createWorkflowVersion).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith({
				workflow_id: "workflow-456",
				version_id: "version-124",
				change_type: WORKFLOW_CHANGE_TYPES.VERSION_CREATED,
				change_description: "New version 2 created from published version 1",
				updated_by: "user-123",
				customer_id: "customer-456",
				field_path: "data_workflow_versions"
			});
			expect(result).toEqual({
				workflow_id: "workflow-456",
				version_id: "version-124",
				version_number: 2,
				changes: mockChanges
			});
		});

		it("should create new version with rules", async () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "New Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "pending" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "PROCESSED" }
							}
						]
					}
				]
			};

			const mockChanges: VersionChange[] = [
				{
					field_path: "rules",
					old_value: "[]",
					new_value: "[{...}]",
					change_type: "rule_added"
				}
			];

			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockChanges);
			mockVersionRepository.createWorkflowVersion.mockResolvedValue(mockNewVersion);

			const result = await versionManager.createVersion(
				mockCurrentVersion,
				updateRequest,
				mockUserInfo,
				mockUserInfo.customer_id
			);

			expect(mockVersionRepository.createWorkflowVersion).toHaveBeenCalled();
			expect(result).toEqual({
				workflow_id: "workflow-456",
				version_id: "version-124",
				version_number: 2,
				changes: mockChanges
			});
		});

		it("should create new version with default_action change", async () => {
			const updateRequest: UpdateWorkflowRequest = {
				default_action: {
					type: "set_field",
					parameters: { field: "case.status", value: "REJECTED" }
				}
			};

			const mockChanges: VersionChange[] = [
				{
					field_path: "workflow_versions.default_action",
					old_value: '{"type":"set_field","parameters":{"field":"case.status.id","value":"APPROVED"}}',
					new_value: '{"type":"set_field","parameters":{"field":"case.status.id","value":"REJECTED"}}',
					change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
				}
			];

			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockChanges);
			mockVersionRepository.createWorkflowVersion.mockResolvedValue(mockNewVersion);

			const result = await versionManager.createVersion(
				mockCurrentVersion,
				updateRequest,
				mockUserInfo,
				mockUserInfo.customer_id
			);

			expect(result).toEqual({
				workflow_id: "workflow-456",
				version_id: "version-124",
				version_number: 2,
				changes: mockChanges
			});
		});

		it("should handle errors during version creation", async () => {
			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			const mockChanges: VersionChange[] = [];
			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockChanges);
			mockVersionRepository.createWorkflowVersion.mockRejectedValue(new Error("Database error"));

			await expect(
				versionManager.createVersion(mockCurrentVersion, updateRequest, mockUserInfo, mockUserInfo.customer_id)
			).rejects.toThrow("Database error");

			expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		});

		it("should not log version creation when creating from a draft version", async () => {
			const draftVersion: WorkflowVersionWithRulesAndTriggerConditions = {
				...mockCurrentVersion,
				status: WORKFLOW_STATUS.DRAFT
			};

			const updateRequest: UpdateWorkflowRequest = {
				trigger_id: "new-trigger-123"
			};

			const mockChanges: VersionChange[] = [];
			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockChanges);
			mockVersionRepository.createWorkflowVersion.mockResolvedValue(mockNewVersion);

			await versionManager.createVersion(draftVersion, updateRequest, mockUserInfo, mockUserInfo.customer_id);

			expect(mockVersionRepository.createWorkflowVersion).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		});
	});

	describe("createChangeLogEntries", () => {
		it("should create change log entries from changes", () => {
			const changes: VersionChange[] = [
				{
					field_path: "trigger_id",
					old_value: "trigger-789",
					new_value: "new-trigger-123",
					change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
				},
				{
					field_path: "workflow_versions.default_action",
					old_value: "old-action",
					new_value: "new-action",
					change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
				}
			];

			const result = VersionManager.createChangeLogEntries("workflow-456", "version-124", changes, "user-123");

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				workflow_id: "workflow-456",
				workflow_version_id: "version-124",
				field_path: "trigger_id",
				old_value: "trigger-789",
				new_value: "new-trigger-123",
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED,
				note: undefined,
				changed_by: "user-123",
				changed_at: expect.any(Date)
			});
		});
	});

	describe("validateUpdateRequest", () => {
		it("should return true for valid update request", () => {
			const validRequest: UpdateWorkflowRequest = {
				trigger_id: "trigger-123",
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "set_field", parameters: { field: "test", value: "value" } }]
					}
				],
				default_action: { type: "set_field", parameters: { field: "test", value: "value" } }
			};

			expect(VersionManager.validateUpdateRequest(validRequest)).toBe(true);
		});

		it("should return false for invalid trigger_id type", () => {
			const invalidRequest = {
				trigger_id: 123
			} as unknown as UpdateWorkflowRequest;

			expect(VersionManager.validateUpdateRequest(invalidRequest)).toBe(false);
		});

		it("should return false for invalid rules array", () => {
			const invalidRequest = {
				rules: "not-an-array"
			} as unknown as UpdateWorkflowRequest;

			expect(VersionManager.validateUpdateRequest(invalidRequest)).toBe(false);
		});

		it("should return false for invalid rule structure", () => {
			const invalidRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: "not-a-number",
						conditions: "not-an-object",
						actions: "not-an-object"
					}
				]
			} as unknown as UpdateWorkflowRequest;

			expect(VersionManager.validateUpdateRequest(invalidRequest)).toBe(false);
		});

		it("should return false for invalid default_action type", () => {
			const invalidRequest = {
				default_action: "not-an-object"
			} as unknown as UpdateWorkflowRequest;

			expect(VersionManager.validateUpdateRequest(invalidRequest)).toBe(false);
		});

		it("should return true for empty request", () => {
			const emptyRequest = {};

			expect(VersionManager.validateUpdateRequest(emptyRequest)).toBe(true);
		});
	});
});

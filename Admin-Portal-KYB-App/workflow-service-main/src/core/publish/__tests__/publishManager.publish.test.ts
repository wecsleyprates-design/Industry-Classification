import { PublishManager } from "../publishManager";
import { PublishRepository } from "../publishRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import { PublishWorkflowRequestValidator } from "#core/validators";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_STATUS, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, WORKFLOW_CHANGE_TYPES } from "#constants";

// Mock the validator
const mockValidate = jest.fn();
jest.mock("#core/validators", () => ({
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({
		validate: mockValidate
	}))
}));

// Mock the repository
jest.mock("../publishRepository");
const mockedPublishRepository = PublishRepository as jest.MockedClass<typeof PublishRepository>;

// Mock VersionRepository and VersionChangeDetector
jest.mock("#core/versioning/versionRepository");
jest.mock("#core/versioning/versionChangeDetector");

describe("PublishManager.publishWorkflow", () => {
	let publishManager: PublishManager;
	let mockPublishRepository: jest.Mocked<PublishRepository>;
	let mockAuditRepository: jest.Mocked<AuditRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockPublishValidator: jest.Mocked<PublishWorkflowRequestValidator>;

	beforeEach(() => {
		mockPublishRepository = {
			retireCurrentPublishedVersions: jest.fn(),
			activateWorkflow: jest.fn(),
			publishWorkflowVersion: jest.fn()
		} as unknown as jest.Mocked<PublishRepository>;

		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn().mockResolvedValue(undefined)
		} as unknown as jest.Mocked<AuditRepository>;

		mockVersionRepository = {
			getPublishedVersions: jest.fn().mockResolvedValue([]),
			getVersionAndRulesById: jest.fn().mockResolvedValue(null),
			updateWorkflowVersionSnapshot: jest.fn().mockResolvedValue(undefined)
		} as unknown as jest.Mocked<VersionRepository>;

		mockPublishValidator = {
			validate: mockValidate
		} as unknown as jest.Mocked<PublishWorkflowRequestValidator>;

		mockedPublishRepository.mockImplementation(() => mockPublishRepository);
		publishManager = new PublishManager(
			mockPublishRepository,
			mockAuditRepository,
			mockVersionRepository,
			mockPublishValidator
		);

		// Reset VersionChangeDetector mock
		(VersionChangeDetector.getChangedFields as jest.Mock) = jest.fn().mockReturnValue([]);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("publishWorkflow", () => {
		const testUserInfo = {
			user_id: "user-123",
			email: "test@example.com",
			role: { id: 1, code: "admin" },
			given_name: "Test",
			family_name: "User",
			customer_id: "customer-123"
		};

		const testVersionId = "123e4567-e89b-12d3-a456-426614174000";

		it("should successfully publish a workflow version and log activation when workflow was inactive", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			const previousPublishedVersion = {
				id: "old-version-id",
				workflow_id: "workflow-123",
				version_number: 1,
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				trigger_id: "trigger-123",
				snapshot: undefined,
				default_action: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const newPublishedVersion = {
				version: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.PUBLISHED,
					trigger_id: "trigger-123",
					is_current: true,
					snapshot: undefined,
					default_action: undefined,
					published_at: new Date("2024-01-01T12:00:00Z"),
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00Z")
				},
				rules: [],
				trigger_conditions: null
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockVersionRepository.getPublishedVersions.mockResolvedValue([previousPublishedVersion]);
			mockVersionRepository.getVersionAndRulesById.mockResolvedValue(newPublishedVersion);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue();

			const result = await publishManager.publishWorkflow(testVersionId, testUserInfo);

			expect(mockValidate).toHaveBeenCalledWith(testVersionId, testUserInfo);
			expect(mockVersionRepository.getPublishedVersions).toHaveBeenCalledWith("workflow-123");
			expect(mockPublishRepository.retireCurrentPublishedVersions).toHaveBeenCalledWith(
				"workflow-123",
				"user-123",
				undefined
			);
			expect(mockPublishRepository.activateWorkflow).toHaveBeenCalledWith("workflow-123", "user-123", undefined);
			expect(mockPublishRepository.publishWorkflowVersion).toHaveBeenCalledWith(testVersionId, "user-123", undefined);
			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenCalledWith(testVersionId, undefined);
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledTimes(3);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				1,
				{
					workflow_id: "workflow-123",
					version_id: "old-version-id",
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version archived (PUBLISHED → ARCHIVED)",
					updated_by: "user-123",
					field_path: "data_workflow_versions.status",
					old_value: "published",
					new_value: "archived",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				2,
				{
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
					change_description: "Workflow activated (inactive → active)",
					updated_by: "user-123",
					field_path: "data_workflows.active",
					old_value: "false",
					new_value: "true",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				3,
				{
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version published (DRAFT → PUBLISHED)",
					updated_by: "user-123",
					field_path: "data_workflow_versions.status",
					old_value: "draft",
					new_value: "published",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(result).toEqual({
				workflow_id: "workflow-123",
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-01T12:00:00.000Z",
				message: "Workflow published successfully"
			});
		});

		it("should not log activation when workflow was already active", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: true
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			const previousPublishedVersion = {
				id: "old-version-id",
				workflow_id: "workflow-123",
				version_number: 1,
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				trigger_id: "trigger-123",
				snapshot: undefined,
				default_action: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const newPublishedVersion = {
				version: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.PUBLISHED,
					trigger_id: "trigger-123",
					is_current: true,
					snapshot: undefined,
					default_action: undefined,
					published_at: new Date("2024-01-01T12:00:00Z"),
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00Z")
				},
				rules: [],
				trigger_conditions: null
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockVersionRepository.getPublishedVersions.mockResolvedValue([previousPublishedVersion]);
			mockVersionRepository.getVersionAndRulesById.mockResolvedValue(newPublishedVersion);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue();

			const result = await publishManager.publishWorkflow(testVersionId, testUserInfo);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledTimes(2);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				1,
				{
					workflow_id: "workflow-123",
					version_id: "old-version-id",
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version archived (PUBLISHED → ARCHIVED)",
					updated_by: "user-123",
					field_path: "data_workflow_versions.status",
					old_value: "published",
					new_value: "archived",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				2,
				{
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version published (DRAFT → PUBLISHED)",
					updated_by: "user-123",
					field_path: "data_workflow_versions.status",
					old_value: "draft",
					new_value: "published",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(result).toEqual({
				workflow_id: "workflow-123",
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-01T12:00:00.000Z",
				message: "Workflow published successfully"
			});
		});

		it("should log activation when publishing first version (no previous version to archive)", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			const newPublishedVersion = {
				version: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.PUBLISHED,
					trigger_id: "trigger-123",
					is_current: true,
					snapshot: undefined,
					default_action: undefined,
					published_at: new Date("2024-01-01T12:00:00Z"),
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00Z")
				},
				rules: [],
				trigger_conditions: null
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
			mockVersionRepository.getVersionAndRulesById.mockResolvedValue(newPublishedVersion);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue([]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue();

			const result = await publishManager.publishWorkflow(testVersionId, testUserInfo);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledTimes(2);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				1,
				{
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
					change_description: "Workflow activated (inactive → active)",
					updated_by: "user-123",
					field_path: "data_workflows.active",
					old_value: "false",
					new_value: "true",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(
				2,
				{
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version published (DRAFT → PUBLISHED)",
					updated_by: "user-123",
					field_path: "data_workflow_versions.status",
					old_value: "draft",
					new_value: "published",
					customer_id: "customer-123"
				},
				undefined
			);

			expect(result).toEqual({
				workflow_id: "workflow-123",
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-01T12:00:00.000Z",
				message: "Workflow published successfully"
			});
		});

		it("should log RULES_UPDATED when rules change between previous and new published version", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 2,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: true
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			const previousPublishedVersion = {
				id: "old-version-id",
				workflow_id: "workflow-123",
				version_number: 1,
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				trigger_id: "trigger-123",
				snapshot: undefined,
				default_action: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const previousVersionData = {
				version: previousPublishedVersion,
				rules: [
					{
						id: "rule-1",
						workflow_version_id: "old-version-id",
						name: "Old Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "set_field" as const, parameters: {} }],
						created_by: "user-123",
						created_at: new Date("2024-01-01T00:00:00Z"),
						updated_by: "user-123",
						updated_at: new Date("2024-01-01T00:00:00Z")
					}
				],
				trigger_conditions: null
			};

			const newPublishedVersion = {
				version: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 2,
					status: WORKFLOW_STATUS.PUBLISHED,
					trigger_id: "trigger-123",
					is_current: true,
					snapshot: undefined,
					default_action: undefined,
					published_at: new Date("2024-01-01T12:00:00Z"),
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00Z")
				},
				rules: [
					{
						id: "rule-2",
						workflow_version_id: testVersionId,
						name: "New Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [{ field: "status", operator: "=", value: "new" }] },
						actions: [{ type: "set_field" as const, parameters: {} }],
						created_by: "user-123",
						created_at: new Date("2024-01-02T00:00:00Z"),
						updated_by: "user-123",
						updated_at: new Date("2024-01-02T00:00:00Z")
					}
				],
				trigger_conditions: null
			};

			const mockRuleChanges = [
				{
					field_path: "rules.conditions",
					old_value: "1 rule",
					new_value: "1 rule",
					change_type: WORKFLOW_CHANGE_TYPES.RULES_UPDATED,
					note: "Rule added: New Rule"
				}
			];

			mockValidate.mockResolvedValue(mockValidatedData);
			mockVersionRepository.getPublishedVersions.mockResolvedValue([previousPublishedVersion]);
			mockVersionRepository.getVersionAndRulesById
				.mockResolvedValueOnce(previousVersionData)
				.mockResolvedValueOnce(newPublishedVersion);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockRuleChanges);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue();

			const result = await publishManager.publishWorkflow(testVersionId, testUserInfo);

			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenCalledWith("old-version-id");
			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenCalledTimes(2);
			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenNthCalledWith(2, testVersionId, undefined);
			expect(VersionChangeDetector.getChangedFields).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.RULES_UPDATED,
					field_path: "data_workflow_rules.conditions",
					customer_id: "customer-123"
				}),
				undefined
			);

			expect(result).toEqual({
				workflow_id: "workflow-123",
				version_id: testVersionId,
				version_number: 2,
				published_at: "2024-01-01T12:00:00.000Z",
				message: "Workflow published successfully"
			});
		});

		it("should log DEFAULT_ACTION_UPDATED when default_action changes between previous and new published version", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 2,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: true
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			const previousPublishedVersion = {
				id: "old-version-id",
				workflow_id: "workflow-123",
				version_number: 1,
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				trigger_id: "trigger-123",
				snapshot: undefined,
				default_action: { type: "set_field" as const, parameters: { field: "status", value: "approved" } },
				published_at: new Date("2024-01-01T00:00:00Z"),
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			const previousVersionData = {
				version: previousPublishedVersion,
				rules: [],
				trigger_conditions: null
			};

			const newPublishedVersion = {
				version: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 2,
					status: WORKFLOW_STATUS.PUBLISHED,
					trigger_id: "trigger-123",
					is_current: true,
					snapshot: undefined,
					default_action: { type: "set_field" as const, parameters: { field: "status", value: "rejected" } },
					published_at: new Date("2024-01-01T12:00:00Z"),
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00Z")
				},
				rules: [],
				trigger_conditions: null
			};

			const mockDefaultActionChanges = [
				{
					field_path: "default_action",
					old_value: '{"type":"set_field","parameters":{"field":"status","value":"approved"}}',
					new_value: '{"type":"set_field","parameters":{"field":"status","value":"rejected"}}',
					change_type: WORKFLOW_CHANGE_TYPES.DEFAULT_ACTION_UPDATED,
					note: undefined
				}
			];

			mockValidate.mockResolvedValue(mockValidatedData);
			mockVersionRepository.getPublishedVersions.mockResolvedValue([previousPublishedVersion]);
			mockVersionRepository.getVersionAndRulesById
				.mockResolvedValueOnce(previousVersionData)
				.mockResolvedValueOnce(newPublishedVersion);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			(VersionChangeDetector.getChangedFields as jest.Mock).mockReturnValue(mockDefaultActionChanges);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue();

			const result = await publishManager.publishWorkflow(testVersionId, testUserInfo);

			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenCalledWith("old-version-id");
			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenCalledTimes(2);
			expect(mockVersionRepository.getVersionAndRulesById).toHaveBeenNthCalledWith(2, testVersionId, undefined);
			expect(VersionChangeDetector.getChangedFields).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-123",
					version_id: testVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.DEFAULT_ACTION_UPDATED,
					field_path: "data_workflow_versions.default_action",
					customer_id: "customer-123"
				}),
				undefined
			);

			expect(result).toEqual({
				workflow_id: "workflow-123",
				version_id: testVersionId,
				version_number: 2,
				published_at: "2024-01-01T12:00:00.000Z",
				message: "Workflow published successfully"
			});
		});

		it("should throw error when validator throws validation error", async () => {
			const validationError = new ApiError(
				"Workflow version not found",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.WORKFLOW_VERSION_NOT_FOUND
			);
			mockValidate.mockRejectedValue(validationError);

			await expect(publishManager.publishWorkflow(testVersionId, testUserInfo)).rejects.toThrow(ApiError);

			try {
				await publishManager.publishWorkflow(testVersionId, testUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe("Workflow version not found");
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.WORKFLOW_VERSION_NOT_FOUND);
			}

			// Verify that repository methods were not called when validation fails
			expect(mockPublishRepository.retireCurrentPublishedVersions).not.toHaveBeenCalled();
			expect(mockPublishRepository.activateWorkflow).not.toHaveBeenCalled();
			expect(mockPublishRepository.publishWorkflowVersion).not.toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		});

		it("should handle repository errors during retire published versions", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockPublishRepository.retireCurrentPublishedVersions.mockRejectedValue(new Error("Database error"));

			await expect(publishManager.publishWorkflow(testVersionId, testUserInfo)).rejects.toThrow("Database error");
		});

		it("should handle repository errors during workflow activation", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockRejectedValue(new Error("Activation error"));

			await expect(publishManager.publishWorkflow(testVersionId, testUserInfo)).rejects.toThrow("Activation error");
		});

		it("should handle repository errors during publish", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockRejectedValue(new Error("Publish error"));

			await expect(publishManager.publishWorkflow(testVersionId, testUserInfo)).rejects.toThrow("Publish error");
		});

		it("should handle repository errors during change log insertion", async () => {
			const mockValidatedData = {
				versionId: testVersionId,
				workflowVersion: {
					id: testVersionId,
					workflow_id: "workflow-123",
					version_number: 1,
					status: WORKFLOW_STATUS.DRAFT,
					trigger_id: "trigger-123"
				},
				workflow: {
					id: "workflow-123",
					customer_id: "customer-123",
					active: false
				},
				userInfo: testUserInfo
			};

			const mockPublishResult = {
				published_at: "2024-01-01T12:00:00.000Z"
			};

			mockValidate.mockResolvedValue(mockValidatedData);
			mockPublishRepository.retireCurrentPublishedVersions.mockResolvedValue(["old-version-id"]);
			mockPublishRepository.activateWorkflow.mockResolvedValue();
			mockPublishRepository.publishWorkflowVersion.mockResolvedValue(mockPublishResult);
			mockAuditRepository.insertWorkflowChangeLog.mockRejectedValue(new Error("Change log error"));

			await expect(publishManager.publishWorkflow(testVersionId, testUserInfo)).rejects.toThrow("Change log error");
		});
	});
});

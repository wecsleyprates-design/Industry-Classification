import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { UserInfo } from "#types/common";
import { ERROR_CODES, ROLE_ID, WORKFLOW_CHANGE_TYPES } from "#constants";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#configs", () => ({
	envConfig: {
		CASE_SERVICE_URL: "http://localhost:3001",
		CASE_API_PREFIX: "/api/v1",
		CASE_HEALTH_PATH: "/health"
	},
	workflowConfig: {
		processingQueue: {
			delay: 1000
		},
		versioning: {
			versionGeneratingFields: ["trigger_id", "rules", "default_action"]
		}
	}
}));

jest.mock("#workers/workflowWorker", () => ({
	workflowQueue: {
		queue: {
			add: jest.fn()
		}
	}
}));

const mockValidator = {
	validate: jest.fn()
};

jest.mock("#core/validators", () => ({
	UpdateWorkflowStatusRequestValidator: jest.fn().mockImplementation(() => mockValidator),
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({ validate: jest.fn() }))
}));

describe("WorkflowManager - updateWorkflowStatus", () => {
	let workflowManager: WorkflowManager;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;
	let mockRuleRepository: jest.Mocked<RuleRepository>;
	let mockAuditRepository: jest.Mocked<AuditRepository>;
	let mockCaseService: jest.Mocked<CaseService>;
	let mockFactsManager: jest.Mocked<FactsManager>;
	let mockTransaction: any;

	const mockUserInfo: UserInfo = {
		user_id: "user-123",
		customer_id: "customer-456",
		email: "user@example.com",
		given_name: "John",
		family_name: "Doe",
		role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
	};

	const mockWorkflow = {
		id: "workflow-123",
		customer_id: "customer-456",
		name: "Test Workflow",
		description: "Test Description",
		active: true,
		priority: 3,
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockTransaction = {
			commit: jest.fn(),
			rollback: jest.fn()
		};

		mockWorkflowRepository = {
			transaction: jest.fn(callback => callback(mockTransaction)),
			getWorkflowById: jest.fn(),
			updateWorkflowStatus: jest.fn()
		} as any;

		mockVersionRepository = {
			hasPublishedVersion: jest.fn(),
			getCurrentPublishedVersionId: jest.fn()
		} as any;

		// Reset validator mock
		mockValidator.validate.mockReset();

		mockRuleRepository = {} as any;
		mockTriggerRepository = {} as any;

		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn()
		} as any;

		mockCaseService = {} as any;
		mockFactsManager = {} as any;
		const mockAuthService = {} as any;

		workflowManager = new WorkflowManager(
			mockWorkflowRepository,
			mockVersionRepository,
			mockRuleRepository,
			mockTriggerRepository,
			mockAuditRepository,
			mockCaseService,
			mockAuthService,
			mockFactsManager
		);
	});

	describe("Activate workflow (status: true)", () => {
		it("should successfully activate workflow with published version", async () => {
			const workflowId = "workflow-123";
			const active = true;
			const publishedVersionId = "version-456";

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue(publishedVersionId);
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(true);

			expect(mockValidator.validate).toHaveBeenCalledWith(workflowId, active, mockUserInfo, mockTransaction);
			expect(mockVersionRepository.getCurrentPublishedVersionId).toHaveBeenCalledWith(workflowId, mockTransaction);
			expect(mockWorkflowRepository.updateWorkflowStatus).toHaveBeenCalledWith(
				workflowId,
				active,
				mockUserInfo.user_id,
				mockTransaction
			);
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				{
					workflow_id: workflowId,
					version_id: publishedVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
					change_description: "Workflow status changed from inactive to active",
					updated_by: mockUserInfo.user_id,
					field_path: "data_workflows.active",
					old_value: "false",
					new_value: "true",
					customer_id: mockUserInfo.customer_id
				},
				mockTransaction
			);
		});

		it("should successfully activate workflow with published version (null version_id)", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue(null);
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(true);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				expect.objectContaining({
					version_id: undefined
				}),
				mockTransaction
			);
		});

		it("should throw 409 error when trying to activate workflow without published version", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockRejectedValue(
				new ApiError(
					"You need to complete the pending configuration before activating the workflow",
					StatusCodes.CONFLICT,
					ERROR_CODES.INVALID
				)
			);

			try {
				await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);
				fail("Expected ApiError to be thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.CONFLICT);
				expect((error as ApiError).message).toBe(
					"You need to complete the pending configuration before activating the workflow"
				);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.INVALID);

				expect(mockValidator.validate).toHaveBeenCalledWith(workflowId, active, mockUserInfo, mockTransaction);
				expect(mockWorkflowRepository.updateWorkflowStatus).not.toHaveBeenCalled();
				expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
			}
		});

		it("should not log audit when activating already active workflow", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: true
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue("version-456");
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(true);

			expect(mockWorkflowRepository.updateWorkflowStatus).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		});
	});

	describe("Deactivate workflow (status: false)", () => {
		it("should successfully deactivate workflow", async () => {
			const workflowId = "workflow-123";
			const active = false;
			const publishedVersionId = "version-456";

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: true
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue(publishedVersionId);
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(false);

			expect(mockVersionRepository.getCurrentPublishedVersionId).toHaveBeenCalledWith(workflowId, mockTransaction);
			expect(mockWorkflowRepository.updateWorkflowStatus).toHaveBeenCalledWith(
				workflowId,
				active,
				mockUserInfo.user_id,
				mockTransaction
			);
			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				{
					workflow_id: workflowId,
					version_id: publishedVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
					change_description: "Workflow status changed from active to inactive",
					updated_by: mockUserInfo.user_id,
					field_path: "data_workflows.active",
					old_value: "true",
					new_value: "false",
					customer_id: mockUserInfo.customer_id
				},
				mockTransaction
			);
		});

		it("should successfully deactivate workflow without published version", async () => {
			const workflowId = "workflow-123";
			const active = false;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: true
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue(null);
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);
			mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(false);

			expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
				expect.objectContaining({
					version_id: undefined
				}),
				mockTransaction
			);
		});

		it("should not log audit when deactivating already inactive workflow", async () => {
			const workflowId = "workflow-123";
			const active = false;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue(null);
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);

			const result = await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);

			expect(result.workflow_id).toBe(workflowId);
			expect(result.active).toBe(false);

			expect(mockWorkflowRepository.updateWorkflowStatus).toHaveBeenCalled();
			expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		});
	});

	describe("Edge cases", () => {
		it("should throw 404 error when workflow not found", async () => {
			const workflowId = "workflow-not-found";
			const active = true;

			mockValidator.validate.mockRejectedValue(
				new ApiError(`Workflow with ID ${workflowId} not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND)
			);

			try {
				await workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo);
				fail("Expected ApiError to be thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).message).toBe(`Workflow with ID ${workflowId} not found`);

				expect(mockValidator.validate).toHaveBeenCalledWith(workflowId, active, mockUserInfo, mockTransaction);
				expect(mockWorkflowRepository.updateWorkflowStatus).not.toHaveBeenCalled();
			}
		});

		it("should handle database error when updating workflow status", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue("version-456");
			mockWorkflowRepository.updateWorkflowStatus.mockRejectedValue(
				new ApiError("Failed to update workflow status", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR)
			);

			await expect(workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo)).rejects.toThrow(ApiError);
		});

		it("should handle database error when inserting audit log", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockResolvedValue("version-456");
			mockWorkflowRepository.updateWorkflowStatus.mockResolvedValue(undefined);
			mockAuditRepository.insertWorkflowChangeLog.mockRejectedValue(
				new ApiError("Failed to insert audit log", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR)
			);

			await expect(workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo)).rejects.toThrow(ApiError);
		});

		it("should handle transaction rollback on error", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockRejectedValue(
				new ApiError("Validation failed", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);

			await expect(workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo)).rejects.toThrow(ApiError);

			// Transaction should be rolled back automatically by Knex
			// We verify the error was thrown, which means transaction was handled
			expect(mockWorkflowRepository.transaction).toHaveBeenCalled();
		});

		it("should handle error when getting current published version ID", async () => {
			const workflowId = "workflow-123";
			const active = true;

			mockValidator.validate.mockResolvedValue({
				workflowId,
				workflow: {
					...mockWorkflow,
					active: false
				},
				active,
				userInfo: mockUserInfo
			});
			mockVersionRepository.getCurrentPublishedVersionId.mockRejectedValue(
				new ApiError(
					"Failed to get current published version ID",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				)
			);

			await expect(workflowManager.updateWorkflowStatus(workflowId, active, mockUserInfo)).rejects.toThrow(ApiError);
		});
	});
});

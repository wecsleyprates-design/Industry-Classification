import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { UserInfo } from "#types/common";
import { ERROR_CODES, WORKFLOW_STATUS, ROLE_ID, WORKFLOW_CHANGE_TYPES } from "#constants";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { UpdateWorkflowRequestValidator } from "#core/validators";
import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";

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

jest.mock("#workers/workflowProcessor", () => ({
	WorkflowProcessor: jest.fn()
}));

const mockValidator = {
	validate: jest.fn()
};

jest.mock("#core/validators", () => ({
	UpdateWorkflowRequestValidator: jest.fn().mockImplementation(() => mockValidator),
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({ validate: jest.fn() }))
}));

jest.mock("#core/versioning/versionChangeDetector", () => ({
	VersionChangeDetector: {
		requiresNewVersion: jest.fn()
	}
}));

const mockCreateVersion = jest.fn();
jest.mock("#core/versioning/versionManager", () => ({
	VersionManager: jest.fn().mockImplementation(() => ({
		createVersion: mockCreateVersion
	}))
}));

describe("WorkflowManager - updateWorkflow", () => {
	let workflowManager: WorkflowManager;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;
	let mockRuleRepository: jest.Mocked<RuleRepository>;
	let mockAuditRepository: jest.Mocked<AuditRepository>;
	let mockCaseService: jest.Mocked<CaseService>;
	let mockFactsManager: jest.Mocked<FactsManager>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {
			updateWorkflow: jest.fn(),
			updateWorkflowVersion: jest.fn(),
			getWorkflowById: jest.fn(),
			getDraftVersion: jest.fn(),
			updateWorkflowVersionSnapshot: jest.fn(),
			insertWorkflowChangeLog: jest.fn()
		} as any;

		mockVersionRepository = {
			getWorkflowVersionAndRules: jest.fn(),
			createWorkflowVersion: jest.fn(),
			updateWorkflowVersion: jest.fn(),
			getDraftVersion: jest.fn(),
			updateWorkflowVersionSnapshot: jest.fn(),
			getPublishedVersions: jest.fn()
		} as any;

		mockRuleRepository = {
			insertRule: jest.fn(),
			deleteRulesForVersion: jest.fn(),
			deleteRulesForVersionWithCount: jest.fn()
		} as any;

		mockTriggerRepository = {} as any;

		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn()
		} as any;

		mockCaseService = {} as any;
		mockFactsManager = {} as any;

		workflowManager = new WorkflowManager(
			mockWorkflowRepository,
			mockVersionRepository,
			mockRuleRepository,
			mockTriggerRepository,
			mockAuditRepository,
			mockCaseService,
			undefined, // authService - not needed for this test
			mockFactsManager
		);
	});

	it("should successfully update workflow with new version", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			name: "Updated Workflow",
			trigger_id: "trigger-456"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		const mockVersionResult = {
			version_id: "version-456",
			changes: [{ field: "trigger_id", old_value: "trigger-123", new_value: "trigger-456" }]
		};

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockValidatedData.workflow);
		mockVersionRepository.getDraftVersion.mockResolvedValue(mockVersionAndRules.version);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue([
			{
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				snapshot: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				default_action: undefined,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		]);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);
		(VersionChangeDetector.requiresNewVersion as jest.Mock).mockReturnValue(true);
		mockCreateVersion.mockResolvedValue(mockVersionResult);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(result).toEqual({
			requiresNewVersion: true,
			changes: mockVersionResult.changes
		});
	});

	it("should update draft version without creating new version", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			name: "Updated Workflow"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.DRAFT,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockValidatedData.workflow);
		mockVersionRepository.getDraftVersion.mockResolvedValue(mockVersionAndRules.version);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
		mockVersionRepository.updateWorkflowVersion.mockResolvedValue(undefined);
		mockRuleRepository.deleteRulesForVersion.mockResolvedValue(0);
		mockRuleRepository.insertRule.mockResolvedValue("rule-123");
		mockVersionRepository.updateWorkflowVersionSnapshot.mockResolvedValue(undefined);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);
		mockVersionRepository.updateWorkflowVersion.mockResolvedValue(undefined);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(result).toEqual({
			requiresNewVersion: false,
			changes: []
		});
	});

	it("should handle validation errors", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {};
		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidator = new UpdateWorkflowRequestValidator();
		(mockValidator.validate as jest.Mock).mockRejectedValue(
			new ApiError("Validation failed", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
		);

		await expect(workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo)).rejects.toThrow(ApiError);
	});

	it("should log name change when workflow has published version", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			name: "Updated Workflow Name"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		const mockPublishedVersions = [
			{
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				snapshot: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				default_action: undefined,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		];

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue(mockPublishedVersions);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);
		(VersionChangeDetector.requiresNewVersion as jest.Mock).mockReturnValue(false);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(mockWorkflowRepository.updateWorkflow).toHaveBeenCalledWith(
			workflowId,
			{ name: "Updated Workflow Name" },
			"user-123"
		);
		expect(mockVersionRepository.getPublishedVersions).toHaveBeenCalledWith(workflowId);
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith({
			workflow_id: workflowId,
			version_id: "version-123",
			change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
			change_description: 'Workflow name updated from "Original Workflow" to "Updated Workflow Name"',
			updated_by: "user-123",
			field_path: "data_workflows.name",
			old_value: "Original Workflow",
			new_value: "Updated Workflow Name",
			customer_id: "customer-456"
		});
		expect(result).toEqual({
			requiresNewVersion: false,
			changes: []
		});
	});

	it("should log description change when workflow has published version", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			description: "Updated description"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		const mockPublishedVersions = [
			{
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				snapshot: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				default_action: undefined,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		];

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue(mockPublishedVersions);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);
		(VersionChangeDetector.requiresNewVersion as jest.Mock).mockReturnValue(false);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(mockVersionRepository.getPublishedVersions).toHaveBeenCalledWith(workflowId);
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith({
			workflow_id: workflowId,
			version_id: "version-123",
			change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
			change_description: "Workflow description updated",
			updated_by: "user-123",
			field_path: "data_workflows.description",
			old_value: "Original description",
			new_value: "Updated description",
			customer_id: "customer-456"
		});
		expect(result).toEqual({
			requiresNewVersion: false,
			changes: []
		});
	});

	it("should log both name and description changes when workflow has published version", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			name: "Updated Workflow Name",
			description: "Updated description"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		const mockPublishedVersions = [
			{
				id: "version-123",
				status: WORKFLOW_STATUS.PUBLISHED,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				snapshot: undefined,
				published_at: new Date("2024-01-01T00:00:00Z"),
				default_action: undefined,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		];

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue(mockPublishedVersions);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);
		(VersionChangeDetector.requiresNewVersion as jest.Mock).mockReturnValue(false);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(mockVersionRepository.getPublishedVersions).toHaveBeenCalledWith(workflowId);
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledTimes(2);
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(1, {
			workflow_id: workflowId,
			version_id: "version-123",
			change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
			change_description: 'Workflow name updated from "Original Workflow" to "Updated Workflow Name"',
			updated_by: "user-123",
			field_path: "data_workflows.name",
			old_value: "Original Workflow",
			new_value: "Updated Workflow Name",
			customer_id: "customer-456"
		});
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenNthCalledWith(2, {
			workflow_id: workflowId,
			version_id: "version-123",
			change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
			change_description: "Workflow description updated",
			updated_by: "user-123",
			field_path: "data_workflows.description",
			old_value: "Original description",
			new_value: "Updated description",
			customer_id: "customer-456"
		});
		expect(result).toEqual({
			requiresNewVersion: false,
			changes: []
		});
	});

	it("should not log metadata changes when workflow has no published versions", async () => {
		const workflowId = "workflow-123";
		const mockUpdateRequest = {
			name: "Updated Workflow Name"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockValidatedData = {
			workflowId,
			updateData: mockUpdateRequest,
			userInfo: mockUserInfo,
			workflow: {
				id: workflowId,
				name: "Original Workflow",
				description: "Original description",
				customer_id: "customer-456",
				active: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		};

		const mockVersionAndRules = {
			version: {
				id: "version-123",
				status: WORKFLOW_STATUS.DRAFT,
				workflow_id: workflowId,
				trigger_id: "trigger-123",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			rules: []
		};

		mockValidator.validate.mockResolvedValue(mockValidatedData);
		mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue(mockVersionAndRules);
		mockWorkflowRepository.updateWorkflow.mockResolvedValue(undefined);
		mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
		(VersionChangeDetector.requiresNewVersion as jest.Mock).mockReturnValue(false);

		const result = await workflowManager.updateWorkflow(workflowId, mockUpdateRequest, mockUserInfo);

		expect(mockWorkflowRepository.updateWorkflow).toHaveBeenCalled();
		expect(mockVersionRepository.getPublishedVersions).toHaveBeenCalledWith(workflowId);
		expect(mockAuditRepository.insertWorkflowChangeLog).not.toHaveBeenCalled();
		expect(result).toEqual({
			requiresNewVersion: false,
			changes: []
		});
	});
});

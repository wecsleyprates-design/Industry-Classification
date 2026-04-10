import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { UserInfo } from "#types/common";
import { ROLE_ID } from "#constants";

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
	DeleteWorkflowRequestValidator: jest.fn().mockImplementation(() => mockValidator),
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({ validate: jest.fn() }))
}));

describe("WorkflowManager - deleteDraftWorkflow", () => {
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
		active: false,
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
			deleteWorkflowWithCount: jest.fn(),
			getMaxPriority: jest.fn(),
			getWorkflowsInPriorityRange: jest.fn(),
			updateWorkflowPrioritiesBatch: jest.fn()
		} as any;

		mockVersionRepository = {
			getDraftVersions: jest.fn(),
			deleteWorkflowVersionWithCount: jest.fn()
		} as any;

		mockRuleRepository = {
			deleteRulesForVersionWithCount: jest.fn()
		} as any;

		mockTriggerRepository = {} as any;

		mockAuditRepository = {} as any;

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

	it("should successfully delete draft workflow and reorder priorities", async () => {
		const workflowId = "workflow-123";

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			userInfo: mockUserInfo
		});

		const draftVersions = [
			{
				id: "version-1",
				workflow_id: workflowId,
				status: "draft",
				trigger_id: "trigger-1",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		];

		mockVersionRepository.getDraftVersions.mockResolvedValue(draftVersions as any);
		mockRuleRepository.deleteRulesForVersionWithCount.mockResolvedValue(2);
		mockVersionRepository.deleteWorkflowVersionWithCount.mockResolvedValue(1);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

		const workflowsToReorder = [
			{ id: "workflow-4", priority: 4, name: "Workflow 4" },
			{ id: "workflow-5", priority: 5, name: "Workflow 5" }
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(workflowsToReorder);
		mockWorkflowRepository.updateWorkflowPrioritiesBatch.mockResolvedValue(undefined);

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockValidator.validate).toHaveBeenCalledWith(workflowId, mockUserInfo);
		expect(mockVersionRepository.getDraftVersions).toHaveBeenCalledWith(workflowId);
		expect(mockRuleRepository.deleteRulesForVersionWithCount).toHaveBeenCalledWith("version-1", mockTransaction);
		expect(mockVersionRepository.deleteWorkflowVersionWithCount).toHaveBeenCalledWith("version-1", mockTransaction);
		expect(mockWorkflowRepository.deleteWorkflowWithCount).toHaveBeenCalledWith(workflowId, mockTransaction);
		expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("customer-456", mockTransaction);
		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).toHaveBeenCalledWith(
			"customer-456",
			4,
			5,
			true,
			mockTransaction
		);
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).toHaveBeenCalledWith(
			[
				{ workflowId: "workflow-4", priority: 3 },
				{ workflowId: "workflow-5", priority: 4 }
			],
			mockUserInfo.user_id,
			mockTransaction
		);
	});

	it("should delete workflow without reordering when no workflows have higher priority", async () => {
		const workflowId = "workflow-123";
		const deletedPriority = 5;

		const workflowWithMaxPriority = { ...mockWorkflow, priority: deletedPriority };

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: workflowWithMaxPriority,
			userInfo: mockUserInfo
		});

		mockVersionRepository.getDraftVersions.mockResolvedValue([]);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("customer-456", mockTransaction);
		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});

	it("should delete workflow without reordering when maxPriority equals deletedPriority", async () => {
		const workflowId = "workflow-123";

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			userInfo: mockUserInfo
		});

		mockVersionRepository.getDraftVersions.mockResolvedValue([]);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(3); // Same as workflow priority (3)

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});

	it("should delete workflow without reordering when priority is 0 or less", async () => {
		const workflowId = "workflow-123";
		const workflowWithNoPriority = { ...mockWorkflow, priority: 0 };

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: workflowWithNoPriority,
			userInfo: mockUserInfo
		});

		mockVersionRepository.getDraftVersions.mockResolvedValue([]);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockWorkflowRepository.getMaxPriority).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});

	it("should delete multiple draft versions and their rules", async () => {
		const workflowId = "workflow-123";

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			userInfo: mockUserInfo
		});

		const draftVersions = [
			{
				id: "version-1",
				workflow_id: workflowId,
				status: "draft",
				trigger_id: "trigger-1",
				version_number: 1,
				is_current: true,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			{
				id: "version-2",
				workflow_id: workflowId,
				status: "draft",
				trigger_id: "trigger-1",
				version_number: 2,
				is_current: false,
				created_by: "user-123",
				updated_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		];

		mockVersionRepository.getDraftVersions.mockResolvedValue(draftVersions as any);
		mockRuleRepository.deleteRulesForVersionWithCount.mockResolvedValue(1);
		mockVersionRepository.deleteWorkflowVersionWithCount.mockResolvedValue(1);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(3);

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockRuleRepository.deleteRulesForVersionWithCount).toHaveBeenCalledTimes(2);
		expect(mockRuleRepository.deleteRulesForVersionWithCount).toHaveBeenCalledWith("version-1", mockTransaction);
		expect(mockRuleRepository.deleteRulesForVersionWithCount).toHaveBeenCalledWith("version-2", mockTransaction);
		expect(mockVersionRepository.deleteWorkflowVersionWithCount).toHaveBeenCalledTimes(2);
		expect(mockVersionRepository.deleteWorkflowVersionWithCount).toHaveBeenCalledWith("version-1", mockTransaction);
		expect(mockVersionRepository.deleteWorkflowVersionWithCount).toHaveBeenCalledWith("version-2", mockTransaction);
	});

	it("should handle validator errors", async () => {
		const workflowId = "workflow-123";

		mockValidator.validate.mockRejectedValue(new Error("Validation failed"));

		await expect(workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo)).rejects.toThrow("Validation failed");

		expect(mockVersionRepository.getDraftVersions).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.deleteWorkflowWithCount).not.toHaveBeenCalled();
	});

	it("should not reorder when no workflows found in range", async () => {
		const workflowId = "workflow-123";

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			userInfo: mockUserInfo
		});

		mockVersionRepository.getDraftVersions.mockResolvedValue([]);
		mockWorkflowRepository.deleteWorkflowWithCount.mockResolvedValue(1);
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);
		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue([]); // Empty array

		const result = await workflowManager.deleteDraftWorkflow(workflowId, mockUserInfo);

		expect(result).toEqual({
			message: "Draft workflow deleted successfully"
		});

		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});
});

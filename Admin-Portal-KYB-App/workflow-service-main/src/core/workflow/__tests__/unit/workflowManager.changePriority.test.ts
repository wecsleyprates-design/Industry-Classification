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
	ChangePriorityRequestValidator: jest.fn().mockImplementation(() => mockValidator),
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({ validate: jest.fn() }))
}));

describe("WorkflowManager - changePriority", () => {
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
			getWorkflowsInPriorityRange: jest.fn(),
			updateWorkflowPrioritiesBatch: jest.fn(),
			getMaxPriority: jest.fn()
		} as any;

		mockVersionRepository = {} as any;
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

	it("should successfully change priority moving up (from 3 to 1)", async () => {
		const workflowId = "workflow-123";
		const newPriority = 1;
		const oldPriority = 3;

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			newPriority,
			userInfo: mockUserInfo
		});

		const affectedWorkflows = [
			{ id: "workflow-1", priority: 1, name: "Workflow 1" },
			{ id: "workflow-2", priority: 2, name: "Workflow 2" },
			{ id: workflowId, priority: oldPriority, name: "Test Workflow" }
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(affectedWorkflows);
		mockWorkflowRepository.updateWorkflowPrioritiesBatch.mockResolvedValue(undefined);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

		const result = await workflowManager.changePriority(workflowId, newPriority, mockUserInfo);

		expect(result.workflow_id).toBe(workflowId);
		expect(result.affected_workflows).toHaveLength(3);
		expect(result.affected_workflows).toContainEqual({
			workflow_id: workflowId,
			old_priority: oldPriority,
			new_priority: newPriority
		});
		expect(result.affected_workflows).toContainEqual({
			workflow_id: "workflow-1",
			old_priority: 1,
			new_priority: 2
		});
		expect(result.affected_workflows).toContainEqual({
			workflow_id: "workflow-2",
			old_priority: 2,
			new_priority: 3
		});

		expect(mockValidator.validate).toHaveBeenCalledWith(workflowId, newPriority, mockUserInfo, mockTransaction);
		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).toHaveBeenCalledWith(
			"customer-456",
			1,
			3,
			true,
			mockTransaction
		);
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				{ workflowId, priority: newPriority },
				{ workflowId: "workflow-1", priority: 2 },
				{ workflowId: "workflow-2", priority: 3 }
			]),
			mockUserInfo.user_id,
			mockTransaction
		);
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).toHaveBeenCalledTimes(1);
		const updateCall = mockWorkflowRepository.updateWorkflowPrioritiesBatch.mock.calls[0][0];
		expect(updateCall).toHaveLength(3);
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalled();
	});

	it("should successfully change priority moving down (from 1 to 3)", async () => {
		const workflowId = "workflow-123";
		const newPriority = 3;
		const oldPriority = 1;

		const workflowWithPriority1 = { ...mockWorkflow, priority: oldPriority };

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: workflowWithPriority1,
			newPriority,
			userInfo: mockUserInfo
		});

		const affectedWorkflows = [
			{ id: workflowId, priority: oldPriority, name: "Test Workflow" },
			{ id: "workflow-2", priority: 2, name: "Workflow 2" },
			{ id: "workflow-3", priority: 3, name: "Workflow 3" }
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(affectedWorkflows);
		mockWorkflowRepository.updateWorkflowPrioritiesBatch.mockResolvedValue(undefined);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

		const result = await workflowManager.changePriority(workflowId, newPriority, mockUserInfo);

		expect(result.workflow_id).toBe(workflowId);
		expect(result.affected_workflows).toHaveLength(3);
		expect(result.affected_workflows).toContainEqual({
			workflow_id: workflowId,
			old_priority: oldPriority,
			new_priority: newPriority
		});
		expect(result.affected_workflows).toContainEqual({
			workflow_id: "workflow-2",
			old_priority: 2,
			new_priority: 1
		});
		expect(result.affected_workflows).toContainEqual({
			workflow_id: "workflow-3",
			old_priority: 3,
			new_priority: 2
		});

		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				{ workflowId, priority: newPriority },
				{ workflowId: "workflow-2", priority: 1 },
				{ workflowId: "workflow-3", priority: 2 }
			]),
			mockUserInfo.user_id,
			mockTransaction
		);
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).toHaveBeenCalledTimes(1);
		const updateCall = mockWorkflowRepository.updateWorkflowPrioritiesBatch.mock.calls[0][0];
		expect(updateCall).toHaveLength(3);
	});

	it("should throw error when priority is the same", async () => {
		const workflowId = "workflow-123";
		const priority = 3;

		mockValidator.validate.mockRejectedValue(
			new ApiError(`Workflow already has priority ${priority}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
		);

		await expect(workflowManager.changePriority(workflowId, priority, mockUserInfo)).rejects.toThrow(ApiError);

		await expect(workflowManager.changePriority(workflowId, priority, mockUserInfo)).rejects.toThrow(
			`Workflow already has priority ${priority}`
		);

		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});

	it("should throw error when workflow not found in priority range", async () => {
		const workflowId = "workflow-123";
		const newPriority = 1;

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			newPriority,
			userInfo: mockUserInfo
		});

		const affectedWorkflows = [
			{ id: "workflow-1", priority: 1, name: "Workflow 1" },
			{ id: "workflow-2", priority: 2, name: "Workflow 2" }
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(affectedWorkflows);

		await expect(workflowManager.changePriority(workflowId, newPriority, mockUserInfo)).rejects.toThrow(ApiError);

		await expect(workflowManager.changePriority(workflowId, newPriority, mockUserInfo)).rejects.toThrow(
			"not found in priority range"
		);
	});

	it("should throw error when workflow priority mismatch", async () => {
		const workflowId = "workflow-123";
		const newPriority = 1;

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			newPriority,
			userInfo: mockUserInfo
		});

		const affectedWorkflows = [
			{ id: "workflow-1", priority: 1, name: "Workflow 1" },
			{ id: workflowId, priority: 5, name: "Test Workflow" } // Different priority
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(affectedWorkflows);

		await expect(workflowManager.changePriority(workflowId, newPriority, mockUserInfo)).rejects.toThrow(ApiError);

		await expect(workflowManager.changePriority(workflowId, newPriority, mockUserInfo)).rejects.toThrow(
			"Workflow priority mismatch"
		);
	});

	it("should log audit with correct affected workflows count", async () => {
		const workflowId = "workflow-123";
		const newPriority = 1;
		const oldPriority = 3;

		mockValidator.validate.mockResolvedValue({
			workflowId,
			workflow: mockWorkflow,
			newPriority,
			userInfo: mockUserInfo
		});

		const affectedWorkflows = [
			{ id: "workflow-1", priority: 1, name: "Workflow 1" },
			{ id: workflowId, priority: oldPriority, name: "Test Workflow" }
		];

		mockWorkflowRepository.getWorkflowsInPriorityRange.mockResolvedValue(affectedWorkflows);
		mockWorkflowRepository.updateWorkflowPrioritiesBatch.mockResolvedValue(undefined);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

		await workflowManager.changePriority(workflowId, newPriority, mockUserInfo);

		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalledWith(
			expect.objectContaining({
				workflow_id: workflowId,
				change_type: WORKFLOW_CHANGE_TYPES.PRIORITY_CHANGED,
				change_description: expect.stringContaining("affecting 1 other workflows"),
				field_path: "data_workflows.priority",
				old_value: oldPriority.toString(),
				new_value: newPriority.toString()
			}),
			mockTransaction
		);
	});

	it("should handle validator errors", async () => {
		const workflowId = "workflow-123";
		const newPriority = 1;

		mockValidator.validate.mockRejectedValue(
			new ApiError("Workflow not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND)
		);

		await expect(workflowManager.changePriority(workflowId, newPriority, mockUserInfo)).rejects.toThrow(ApiError);

		expect(mockWorkflowRepository.getWorkflowsInPriorityRange).not.toHaveBeenCalled();
		expect(mockWorkflowRepository.updateWorkflowPrioritiesBatch).not.toHaveBeenCalled();
	});
});

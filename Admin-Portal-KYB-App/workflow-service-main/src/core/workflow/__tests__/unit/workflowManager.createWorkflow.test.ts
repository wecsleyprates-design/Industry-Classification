import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
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

jest.mock("#workers/workflowProcessor", () => ({
	WorkflowProcessor: jest.fn()
}));

jest.mock("#core/versioning/versionChangeDetector", () => ({
	VersionChangeDetector: {
		requiresNewVersion: jest.fn(),
		getChangedFields: jest.fn(),
		refreshDetectors: jest.fn(),
		getDetectors: jest.fn()
	}
}));

jest.mock("#core/versioning/versionManager", () => ({
	VersionManager: jest.fn().mockImplementation(() => ({
		createVersion: jest.fn()
	}))
}));

jest.mock("#core/trigger/triggerRepository");
jest.mock("#core/workflow/workflowRepository");

describe("WorkflowManager - createWorkflow", () => {
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
			getMaxPriority: jest.fn(),
			insertWorkflow: jest.fn(),
			transaction: jest.fn()
		} as any;
		mockVersionRepository = {
			insertWorkflowVersion: jest.fn()
		} as any;
		mockTriggerRepository = {
			getTriggerIdByName: jest.fn(),
			getTriggerById: jest.fn()
		} as any;
		mockRuleRepository = {} as any;
		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn()
		} as any;
		mockCaseService = {} as any;
		mockFactsManager = {} as any;

		(TriggerRepository as jest.Mock).mockImplementation(() => mockTriggerRepository);
		(WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);

		workflowManager = new WorkflowManager(
			mockWorkflowRepository,
			mockVersionRepository,
			mockRuleRepository,
			mockTriggerRepository,
			mockAuditRepository,
			mockCaseService,
			undefined,
			mockFactsManager
		);
	});

	it("should successfully create workflow draft", async () => {
		const mockRequest = {
			name: "Test Workflow"
			// No trigger_id provided, so it should use default SUBMITTED trigger
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "123e4567-e89b-12d3-a456-426614174000",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		// Mock the repository methods
		mockTriggerRepository.getTriggerIdByName.mockResolvedValue("trigger-submitted");
		mockWorkflowRepository.getMaxPriority.mockResolvedValue(0);
		mockWorkflowRepository.transaction.mockImplementation(async callback => {
			// Simulate transaction by calling the callback with a mock transaction
			const mockTrx = {} as any;
			return await callback(mockTrx);
		});

		const result = await workflowManager.createWorkflow(
			mockRequest,
			"123e4567-e89b-12d3-a456-426614174000",
			mockUserInfo
		);

		// Verify the result structure
		expect(result).toHaveProperty("workflow_id");
		expect(result).toHaveProperty("version_id");
		expect(result).toHaveProperty("message");
		expect(result.message).toBe("Workflow draft created successfully");

		// Verify repository methods were called
		expect(mockTriggerRepository.getTriggerIdByName).toHaveBeenCalledWith("SUBMITTED");
		expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
		expect(mockWorkflowRepository.transaction).toHaveBeenCalled();
		expect(mockWorkflowRepository.insertWorkflow).toHaveBeenCalled();
		expect(mockVersionRepository.insertWorkflowVersion).toHaveBeenCalled();
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalled();
	});

	it("should successfully create workflow draft with specific trigger", async () => {
		const mockRequest = {
			name: "Test Workflow",
			trigger_id: "trigger-123"
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "123e4567-e89b-12d3-a456-426614174000",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		mockTriggerRepository.getTriggerById.mockResolvedValue({
			id: "trigger-123",
			name: "Test Trigger",
			conditions: {
				operator: "AND",
				conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
			},
			created_by: "user-123",
			updated_by: "user-123",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_at: new Date("2024-01-01T00:00:00Z")
		});

		mockWorkflowRepository.getMaxPriority.mockResolvedValue(0);
		mockWorkflowRepository.transaction.mockImplementation(async callback => {
			const mockTrx = {} as any;
			return await callback(mockTrx);
		});

		const result = await workflowManager.createWorkflow(
			mockRequest,
			"123e4567-e89b-12d3-a456-426614174000",
			mockUserInfo
		);

		// Verify the result structure
		expect(result).toHaveProperty("workflow_id");
		expect(result).toHaveProperty("version_id");
		expect(result).toHaveProperty("message");
		expect(result.message).toBe("Workflow draft created successfully");

		// Verify repository methods were called
		expect(mockTriggerRepository.getTriggerIdByName).not.toHaveBeenCalled(); // Should not be called when trigger_id is provided
		expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
		expect(mockWorkflowRepository.transaction).toHaveBeenCalled();
		expect(mockWorkflowRepository.insertWorkflow).toHaveBeenCalled();
		expect(mockVersionRepository.insertWorkflowVersion).toHaveBeenCalled();
		expect(mockAuditRepository.insertWorkflowChangeLog).toHaveBeenCalled();
	});

	it("should throw error when creation fails", async () => {
		const mockRequest = {
			name: "Test Workflow"
			// No trigger_id provided, so it should use default SUBMITTED trigger
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "123e4567-e89b-12d3-a456-426614174000",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		// Mock a repository method to throw an error
		mockTriggerRepository.getTriggerIdByName.mockRejectedValue(new Error("Creation failed"));

		await expect(
			workflowManager.createWorkflow(mockRequest, "123e4567-e89b-12d3-a456-426614174000", mockUserInfo)
		).rejects.toThrow("Creation failed");
	});
});

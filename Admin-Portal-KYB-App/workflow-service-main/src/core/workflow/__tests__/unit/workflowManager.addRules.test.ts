import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { UserInfo, ApiError } from "#types/common";
import { WORKFLOW_STATUS, ROLE_ID } from "#constants";
import { isValidUUID } from "#utils/validation";

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

jest.mock("#utils/validation", () => ({
	isValidUUID: jest.fn()
}));

describe("WorkflowManager - addRules", () => {
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
			getWorkflowById: jest.fn(),
			getDraftVersion: jest.fn(),
			updateWorkflowVersionSnapshot: jest.fn(),
			insertWorkflowChangeLog: jest.fn()
		} as unknown as jest.Mocked<WorkflowRepository>;
		mockVersionRepository = {
			getDraftVersion: jest.fn(),
			updateWorkflowVersionSnapshot: jest.fn()
		} as unknown as jest.Mocked<VersionRepository>;
		mockRuleRepository = {
			deleteRulesForVersion: jest.fn(),
			insertRule: jest.fn(),
			deleteRulesForVersionWithCount: jest.fn()
		} as unknown as jest.Mocked<RuleRepository>;
		mockTriggerRepository = {} as unknown as jest.Mocked<TriggerRepository>;
		mockAuditRepository = {
			insertWorkflowChangeLog: jest.fn()
		} as unknown as jest.Mocked<AuditRepository>;
		mockCaseService = {} as unknown as jest.Mocked<CaseService>;
		mockFactsManager = {} as unknown as jest.Mocked<FactsManager>;

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

	it("should successfully add rules to workflow", async () => {
		const workflowId = "workflow-123";
		const mockRequest = {
			rules: [
				{
					name: "Test Rule",
					priority: 1,
					conditions: { operator: "AND", conditions: [] },
					actions: [{ type: "set_field" as const, parameters: {} }]
				}
			]
		};

		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		const mockWorkflow = {
			id: workflowId,
			name: "Test Workflow",
			customer_id: "customer-456",
			active: true,
			created_by: "user-123",
			updated_by: "user-123",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_at: new Date("2024-01-01T00:00:00Z")
		};
		const mockDraftVersion = {
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
		};

		(isValidUUID as jest.Mock).mockReturnValue(true);
		mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
		mockVersionRepository.getDraftVersion.mockResolvedValue(mockDraftVersion);
		mockRuleRepository.deleteRulesForVersion.mockResolvedValue(2);
		mockRuleRepository.insertRule.mockResolvedValue("rule-123");
		mockVersionRepository.updateWorkflowVersionSnapshot.mockResolvedValue(undefined);
		mockAuditRepository.insertWorkflowChangeLog.mockResolvedValue(undefined);

		const result = await workflowManager.addRules(workflowId, mockRequest, mockUserInfo);

		expect(result).toEqual({
			workflow_id: workflowId,
			version_id: "version-123",
			rules_added: 1,
			message: "Successfully added 1 rules to workflow"
		});
	});

	it("should throw error for invalid workflow ID", async () => {
		const workflowId = "invalid-id";
		const mockRequest = { rules: [] };
		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		(isValidUUID as jest.Mock).mockReturnValue(false);

		await expect(workflowManager.addRules(workflowId, mockRequest, mockUserInfo)).rejects.toThrow(ApiError);
	});

	it("should throw error when workflow not found", async () => {
		const workflowId = "workflow-123";
		const mockRequest = { rules: [] };
		const mockUserInfo: UserInfo = {
			user_id: "user-123",
			customer_id: "customer-456",
			email: "user@example.com",
			given_name: "John",
			family_name: "Doe",
			role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
		};

		(isValidUUID as jest.Mock).mockReturnValue(true);
		mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

		await expect(workflowManager.addRules(workflowId, mockRequest, mockUserInfo)).rejects.toThrow(ApiError);
	});
});

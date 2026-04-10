import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { workflowQueue } from "#workers/workflowWorker";
import { EVENTS } from "#constants";

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

describe("WorkflowManager - notifyWorkflow", () => {
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

		mockWorkflowRepository = {} as unknown as jest.Mocked<WorkflowRepository>;
		mockVersionRepository = {} as unknown as jest.Mocked<VersionRepository>;
		mockTriggerRepository = {} as unknown as jest.Mocked<TriggerRepository>;
		mockRuleRepository = {} as unknown as jest.Mocked<RuleRepository>;
		mockAuditRepository = {} as unknown as jest.Mocked<AuditRepository>;
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

	it("should successfully queue workflow notification", async () => {
		const mockRequest = {
			case_id: "case-123",
			customer_id: "customer-456"
		};

		const mockJob = { id: "job-789" };
		(workflowQueue.queue.add as jest.Mock).mockResolvedValue(mockJob);

		const result = await workflowManager.notifyWorkflow(mockRequest);

		expect(result).toEqual({
			message: "Workflow notification received and queued for processing",
			job_id: "job-789",
			estimated_processing_time: expect.any(String)
		});
		expect(workflowQueue.queue.add).toHaveBeenCalledWith(EVENTS.PROCESS_WORKFLOW, {
			case_id: "case-123",
			customer_id: "customer-456",
			enqueued_at: expect.any(String),
			annotations: undefined,
			previous_status: undefined
		});
	});

	it("should successfully queue workflow notification with annotations", async () => {
		const mockRequest = {
			case_id: "case-123",
			customer_id: "customer-456",
			annotations: {
				source_events: {
					facts: "timeout_monitor"
				},
				trigger_type: "initial_submit" as const
			}
		};

		const mockJob = { id: "job-789" };
		(workflowQueue.queue.add as jest.Mock).mockResolvedValue(mockJob);

		const result = await workflowManager.notifyWorkflow(mockRequest);

		expect(result).toEqual({
			message: "Workflow notification received and queued for processing",
			job_id: "job-789",
			estimated_processing_time: expect.any(String)
		});
		expect(workflowQueue.queue.add).toHaveBeenCalledWith(EVENTS.PROCESS_WORKFLOW, {
			case_id: "case-123",
			customer_id: "customer-456",
			enqueued_at: expect.any(String),
			annotations: {
				source_events: {
					facts: "timeout_monitor"
				},
				trigger_type: "initial_submit"
			},
			previous_status: undefined
		});
	});

	it("should throw error when queue fails", async () => {
		const mockRequest = {
			case_id: "case-123",
			customer_id: "customer-456"
		};

		(workflowQueue.queue.add as jest.Mock).mockRejectedValue(new Error("Queue failed"));

		await expect(workflowManager.notifyWorkflow(mockRequest)).rejects.toThrow("Queue failed");
	});
});

import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { warehouseService } from "#services/warehouse";

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

jest.mock("#services/case", () => ({
	CaseService: jest.fn().mockImplementation(() => ({
		validateConnection: jest.fn()
	}))
}));

jest.mock("#services/warehouse", () => ({
	warehouseService: {
		validateConnection: jest.fn()
	}
}));

describe("WorkflowManager - validateSetup", () => {
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

		mockWorkflowRepository = {} as any;
		mockVersionRepository = {} as any;
		mockTriggerRepository = {} as any;
		mockRuleRepository = {} as any;
		mockAuditRepository = {} as any;
		mockCaseService = {
			validateConnection: jest.fn()
		} as any;
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

	it("should return true when all services are healthy", async () => {
		mockCaseService.validateConnection.mockResolvedValue(true);
		(warehouseService.validateConnection as jest.Mock).mockResolvedValue(true);

		const result = await workflowManager.validateSetup();

		expect(result).toBe(true);
		expect(mockCaseService.validateConnection).toHaveBeenCalled();
		expect(warehouseService.validateConnection).toHaveBeenCalled();
	});

	it("should return false when case service is unhealthy", async () => {
		mockCaseService.validateConnection.mockResolvedValue(false);
		(warehouseService.validateConnection as jest.Mock).mockResolvedValue(true);

		const result = await workflowManager.validateSetup();

		expect(result).toBe(false);
	});

	it("should return false when warehouse service is unhealthy", async () => {
		mockCaseService.validateConnection.mockResolvedValue(true);
		(warehouseService.validateConnection as jest.Mock).mockResolvedValue(false);

		const result = await workflowManager.validateSetup();

		expect(result).toBe(false);
	});

	it("should return false when validation throws error", async () => {
		mockCaseService.validateConnection.mockRejectedValue(new Error("Connection failed"));

		const result = await workflowManager.validateSetup();

		expect(result).toBe(false);
	});
});

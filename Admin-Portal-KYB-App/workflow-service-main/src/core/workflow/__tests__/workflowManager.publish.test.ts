import { WorkflowManager } from "../workflowManager";

// Create mock functions
const mockValidate = jest.fn();
const mockRetireCurrentPublishedVersions = jest.fn();
const mockPublishWorkflowVersion = jest.fn();
const mockInsertWorkflowChangeLog = jest.fn();

// Mock the validator to avoid database calls during tests
jest.mock("#core/validators", () => ({
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({
		validate: mockValidate
	})),
	UpdateWorkflowRequestValidator: jest.fn()
}));

// Mock dependencies to avoid circular imports
jest.mock("../workflowRepository", () => ({
	WorkflowRepository: jest.fn().mockImplementation(() => ({
		retireCurrentPublishedVersions: mockRetireCurrentPublishedVersions,
		publishWorkflowVersion: mockPublishWorkflowVersion,
		insertWorkflowChangeLog: mockInsertWorkflowChangeLog
	}))
}));

jest.mock("#services/case", () => ({
	CaseService: jest.fn().mockImplementation(() => ({}))
}));

jest.mock("#core", () => ({}));
jest.mock("#workers/workflowWorker", () => ({}));
jest.mock("#services/warehouse", () => ({}));
jest.mock("#core/actions", () => ({}));
jest.mock("../../evaluators", () => ({}));

describe("WorkflowManager - Publish Workflow", () => {
	let workflowManager: WorkflowManager;
	let mockWorkflowRepository: any;
	let mockCaseService: any;
	let mockFactsManager: any;

	beforeEach(() => {
		mockWorkflowRepository = {};
		mockCaseService = {};
		mockFactsManager = {};

		workflowManager = new WorkflowManager(
			mockWorkflowRepository,
			undefined, // versionRepository
			undefined, // ruleRepository
			undefined, // triggerRepository
			undefined, // auditRepository
			mockCaseService,
			undefined, // authService
			mockFactsManager
		);

		// Reset all mocks and set default successful behavior
		jest.clearAllMocks();
		mockValidate.mockResolvedValue({
			versionId: "version-123",
			workflowVersion: {
				id: "version-123",
				workflow_id: "workflow-123",
				status: "draft",
				trigger_id: "trigger-123",
				version_number: 1
			},
			workflow: {
				id: "workflow-123",
				customer_id: "customer-123"
			},
			userInfo: {
				user_id: "user-123",
				customer_id: "customer-123"
			}
		});
		mockRetireCurrentPublishedVersions.mockResolvedValue(0);
		mockPublishWorkflowVersion.mockResolvedValue({
			published_at: new Date("2024-01-15T10:30:00Z")
		});
		mockInsertWorkflowChangeLog.mockResolvedValue(undefined);
	});

	describe("publishWorkflow", () => {
		it("should not have publishWorkflow method (moved to PublishManager)", () => {
			expect("publishWorkflow" in workflowManager).toBe(false);
		});
	});
});

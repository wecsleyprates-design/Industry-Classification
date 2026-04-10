import { WorkflowManager } from "#core/workflow/workflowManager";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { FactsManager } from "#core/facts";
import { CaseService } from "#services/case";
import { AuthService } from "#services/auth";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { UserInfo, ApiError } from "#types/common";
import { ROLE_ID } from "#constants";
import { StatusCodes } from "http-status-codes";
import type { GetWorkflowsListParams } from "../../types";

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#core/versioning/versionManager", () => ({
	VersionManager: jest.fn().mockImplementation(() => ({
		createVersion: jest.fn()
	}))
}));

jest.mock("#workers/workflowWorker", () => ({
	workflowQueue: {
		queue: {
			add: jest.fn()
		}
	}
}));

jest.mock("#core/actions", () => ({
	actionProcessor: {
		processActions: jest.fn()
	}
}));

jest.mock("#core/validators", () => ({
	GetWorkflowsListRequestValidator: jest.fn().mockImplementation(() => ({
		validate: jest.fn().mockImplementation(async (customerId: string, params: any, userInfo: any) => {
			return {
				customerId,
				params,
				userInfo
			};
		})
	})),
	PublishWorkflowRequestValidator: jest.fn().mockImplementation(() => ({ validate: jest.fn() }))
}));

describe("WorkflowManager - getWorkflowsList", () => {
	let workflowManager: WorkflowManager;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;
	let mockRuleRepository: jest.Mocked<RuleRepository>;
	let mockAuditRepository: jest.Mocked<AuditRepository>;
	let mockCaseService: jest.Mocked<CaseService>;
	let mockAuthService: jest.Mocked<AuthService>;
	let mockFactsManager: jest.Mocked<FactsManager>;

	const mockUserInfo: UserInfo = {
		user_id: "user-123",
		email: "user@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		role: {
			id: ROLE_ID.CUSTOMER,
			code: "CUSTOMER"
		}
	};

	// Note: mockAdminUserInfo removed - authorization tests are now in GetWorkflowsListRequestValidator tests

	const mockWorkflows = [
		{
			id: "workflow-1",
			name: "Workflow 1",
			description: "Description 1",
			priority: 1,
			cases: 10,
			published_version: "1.0",
			draft_version: null,
			status: "active" as const,
			created_by: "user-1",
			created_at: new Date("2024-01-15T10:30:00Z"),
			updated_at: new Date("2024-01-20T14:45:00Z")
		},
		{
			id: "workflow-2",
			name: "Workflow 2",
			description: "Description 2",
			priority: 2,
			cases: 5,
			published_version: "2.0",
			draft_version: null,
			status: "inactive" as const,
			created_by: "user-2",
			created_at: new Date("2024-01-16T10:30:00Z"),
			updated_at: null
		}
	];

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {
			getWorkflowsList: jest.fn()
		} as any;

		mockVersionRepository = {} as any;
		mockTriggerRepository = {} as any;
		mockRuleRepository = {} as any;
		mockAuditRepository = {} as any;
		mockCaseService = {} as any;
		mockAuthService = {
			getCustomerNames: jest.fn()
		} as any;
		mockFactsManager = {} as any;

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

	describe("Success cases", () => {
		it("should successfully retrieve workflows list with pagination", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123",
				page: 1,
				itemsPerPage: 10
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 2
			});

			mockAuthService.getCustomerNames.mockResolvedValue({
				"user-1": "User One",
				"user-2": "User Two"
			});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result).toEqual({
				records: [
					{
						id: "workflow-1",
						name: "Workflow 1",
						description: "Description 1",
						priority: 1,
						cases: 10,
						published_version: "1.0",
						draft_version: null,
						status: "active",
						created_by: "user-1",
						created_by_name: "User One",
						created_at: "2024-01-15T10:30:00.000Z",
						updated_at: "2024-01-20T14:45:00.000Z"
					},
					{
						id: "workflow-2",
						name: "Workflow 2",
						description: "Description 2",
						priority: 2,
						cases: 5,
						published_version: "2.0",
						draft_version: null,
						status: "inactive",
						created_by: "user-2",
						created_by_name: "User Two",
						created_at: "2024-01-16T10:30:00.000Z",
						updated_at: undefined
					}
				],
				totalPages: 1,
				totalItems: 2
			});

			expect(mockWorkflowRepository.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					pagination: expect.objectContaining({
						page: 1,
						itemsPerPage: 10,
						usePagination: true,
						offset: 0
					}),
					filter: params.filter,
					search: params.search
				})
			);
			expect(mockAuthService.getCustomerNames).toHaveBeenCalledWith(["user-1", "user-2"]);
		});

		it("should normalize pagination parameters with defaults", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
				// No page or itemsPerPage
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 2
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(mockWorkflowRepository.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					pagination: expect.objectContaining({
						page: 1,
						itemsPerPage: 10,
						usePagination: true,
						offset: 0
					}),
					filter: undefined,
					search: undefined
				})
			);
		});

		it("should calculate totalPages correctly", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123",
				page: 2,
				itemsPerPage: 10
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 25
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.totalPages).toBe(3); // Math.ceil(25 / 10) = 3
			expect(result.totalItems).toBe(25);
		});

		it("should return totalPages=1 when pagination is disabled", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123",
				pagination: false
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 25
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.totalPages).toBe(1);
		});

		it("should handle empty customer names map gracefully", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 2
			});

			mockAuthService.getCustomerNames.mockResolvedValue({}); // Empty map

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.records[0].created_by_name).toBeUndefined();
			expect(result.records[1].created_by_name).toBeUndefined();
		});

		it("should handle missing customer names for some users", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 2
			});

			mockAuthService.getCustomerNames.mockResolvedValue({
				"user-1": "User One"
				// user-2 missing
			});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.records[0].created_by_name).toBe("User One");
			expect(result.records[1].created_by_name).toBeUndefined();
		});

		it("should handle empty workflows list", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: [],
				totalItems: 0
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.records).toEqual([]);
			expect(result.totalItems).toBe(0);
			expect(result.totalPages).toBe(0); // Math.ceil(0 / 10) = 0
			expect(mockAuthService.getCustomerNames).toHaveBeenCalledWith([]);
		});
	});

	// Note: Authorization tests are now in GetWorkflowsListRequestValidator tests
	// The WorkflowManager no longer validates access - that's handled by the validator

	describe("Error handling", () => {
		it("should handle repository errors gracefully", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			const dbError = new Error("Database error");
			mockWorkflowRepository.getWorkflowsList.mockRejectedValue(dbError);

			await expect(workflowManager.getWorkflowsList(params, mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await workflowManager.getWorkflowsList(params, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				const apiError = error as ApiError;
				expect(apiError.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect(apiError.message).toContain("Failed to get workflows list");
			}
		});

		it("should continue even if AuthService fails to fetch customer names", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: mockWorkflows,
				totalItems: 2
			});

			// AuthService returns empty map on error (handled internally)
			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result).toBeDefined();
			expect(result.records).toHaveLength(2);
			expect(result.records[0].created_by_name).toBeUndefined();
		});
	});

	describe("Data transformation", () => {
		it("should transform description null to empty string", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			const workflowsWithNullDescription = [
				{
					...mockWorkflows[0],
					description: null
				}
			];

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: workflowsWithNullDescription,
				totalItems: 1
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.records[0].description).toBe("");
		});

		it("should handle updated_at null correctly", async () => {
			const params: GetWorkflowsListParams = {
				customerId: "customer-123"
			};

			const workflowsWithNullUpdatedAt = [
				{
					...mockWorkflows[0],
					updated_at: null
				}
			];

			mockWorkflowRepository.getWorkflowsList.mockResolvedValue({
				workflows: workflowsWithNullUpdatedAt,
				totalItems: 1
			});

			mockAuthService.getCustomerNames.mockResolvedValue({});

			const result = await workflowManager.getWorkflowsList(params, mockUserInfo);

			expect(result.records[0].updated_at).toBeUndefined();
		});
	});
});

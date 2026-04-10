import { WorkflowManager } from "../../workflowManager";
import { WorkflowRepository } from "../../workflowRepository";
import { GetWorkflowByIdRequestValidator } from "#core/validators";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ROLES, ROLE_ID, ACTION_TYPES } from "#constants";
import type { UserInfo } from "#types/common";
import type { WorkflowAction } from "#core/actions/types";

// Mock dependencies
jest.mock("../../workflowRepository");
jest.mock("#core/validators");
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#database", () => ({}));
jest.mock("#helpers/redis", () => ({}));
jest.mock("#helpers/bullQueue", () => ({}));
jest.mock("#workers/workflowWorker", () => ({
	workflowQueue: {
		queue: {
			add: jest.fn()
		}
	}
}));

// eslint-disable-next-line @typescript-eslint/naming-convention
const MockedWorkflowRepository = WorkflowRepository as jest.MockedClass<typeof WorkflowRepository>;
// eslint-disable-next-line @typescript-eslint/naming-convention
const MockedGetWorkflowByIdRequestValidator = GetWorkflowByIdRequestValidator as jest.MockedClass<
	typeof GetWorkflowByIdRequestValidator
> &
	jest.Mock;

describe("WorkflowManager.getWorkflowById", () => {
	let workflowManager: WorkflowManager;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;

	const mockUserInfo: UserInfo = {
		user_id: "user-123",
		email: "user@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		role: {
			id: ROLE_ID.CUSTOMER,
			code: ROLES.CUSTOMER
		}
	};

	const mockWorkflowWithDetails = {
		workflow: {
			id: "workflow-123",
			customer_id: "customer-123",
			name: "Test Workflow",
			description: "Test description",
			active: true,
			priority: 1,
			created_by: "user-123",
			created_at: new Date("2024-01-15T10:30:00Z"),
			updated_by: "user-123",
			updated_at: new Date("2024-01-20T14:45:00Z")
		},
		version: {
			id: "version-123",
			version_number: 1,
			status: "draft",
			trigger_id: "trigger-123",
			default_action: {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "case.status", value: "AUTO_APPROVED" }
			} as WorkflowAction
		},
		trigger: {
			id: "trigger-123",
			name: "SUBMITTED",
			conditions: { "==": [{ var: "status.code" }, "SUBMITTED"] } as Record<string, unknown>
		},
		rules: [
			{
				id: "rule-123",
				name: "High Risk Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "facts.mcc_code", operator: "=", value: "1234" }]
				} as Record<string, unknown>,
				actions: [
					{
						type: ACTION_TYPES.SET_FIELD,
						parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
					} as WorkflowAction
				]
			}
		]
	} as NonNullable<Awaited<ReturnType<WorkflowRepository["getWorkflowWithDetails"]>>>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {
			getWorkflowWithDetails: jest.fn()
		} as unknown as jest.Mocked<WorkflowRepository>;

		MockedWorkflowRepository.mockImplementation(() => mockWorkflowRepository);

		// Mock validator to pass validation
		MockedGetWorkflowByIdRequestValidator.mockImplementation(
			() =>
				({
					validate: jest.fn().mockResolvedValue({
						workflowId: "workflow-123",
						workflow: mockWorkflowWithDetails.workflow,
						userInfo: mockUserInfo
					})
				}) as unknown as GetWorkflowByIdRequestValidator
		);

		workflowManager = new WorkflowManager(mockWorkflowRepository);
	});

	describe("Success cases", () => {
		it("should return workflow details successfully", async () => {
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(mockWorkflowWithDetails);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result).toEqual({
				id: "workflow-123",
				name: "Test Workflow",
				description: "Test description",
				priority: 1,
				active: true,
				created_at: "2024-01-15T10:30:00.000Z",
				updated_at: "2024-01-20T14:45:00.000Z",
				current_version: {
					id: "version-123",
					version_number: 1,
					status: "draft",
					trigger_id: "trigger-123",
					trigger: {
						id: "trigger-123",
						name: "SUBMITTED",
						conditions: { "==": [{ var: "status.code" }, "SUBMITTED"] }
					},
					default_action: {
						type: ACTION_TYPES.SET_FIELD,
						parameters: { field: "case.status", value: "AUTO_APPROVED" }
					} as WorkflowAction,
					rules: [
						{
							id: "rule-123",
							name: "High Risk Rule",
							priority: 1,
							conditions: {
								operator: "AND",
								conditions: [{ field: "facts.mcc_code", operator: "=", value: "1234" }]
							},
							actions: [
								{
									type: ACTION_TYPES.SET_FIELD,
									parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
								} as WorkflowAction
							]
						}
					]
				}
			});

			expect(mockWorkflowRepository.getWorkflowWithDetails).toHaveBeenCalledWith("workflow-123");
		});

		it("should return workflow with null description", async () => {
			const workflowNoDesc = {
				...mockWorkflowWithDetails,
				workflow: {
					...mockWorkflowWithDetails.workflow,
					description: undefined
				}
			};
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(workflowNoDesc);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result.description).toBeNull();
		});

		it("should return workflow with empty rules array", async () => {
			const workflowNoRules = {
				...mockWorkflowWithDetails,
				rules: []
			};
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(workflowNoRules);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result.current_version.rules).toEqual([]);
		});

		it("should return workflow with null default_action", async () => {
			const workflowNoDefaultAction = {
				...mockWorkflowWithDetails,
				version: {
					...mockWorkflowWithDetails.version,
					default_action: null
				}
			};
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(workflowNoDefaultAction);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result.current_version.default_action).toBeNull();
		});

		it("should return workflow with published status", async () => {
			const publishedWorkflow = {
				...mockWorkflowWithDetails,
				version: {
					...mockWorkflowWithDetails.version,
					status: "published"
				}
			};
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(publishedWorkflow);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result.current_version.status).toBe("published");
		});

		it("should handle workflow with priority 0", async () => {
			const workflowZeroPriority = {
				...mockWorkflowWithDetails,
				workflow: {
					...mockWorkflowWithDetails.workflow,
					priority: undefined
				}
			};
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(workflowZeroPriority);

			const result = await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(result.priority).toBe(0);
		});
	});

	describe("Error cases", () => {
		it("should throw NOT_FOUND when workflow details not found", async () => {
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(null);

			await expect(workflowManager.getWorkflowById("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await workflowManager.getWorkflowById("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).message).toContain("not found");
			}
		});

		it("should re-throw ApiError from validator", async () => {
			const validatorError = new ApiError(
				"Access denied. You are not authorized to access this workflow.",
				StatusCodes.FORBIDDEN,
				"UNAUTHORIZED"
			);
			MockedGetWorkflowByIdRequestValidator.mockImplementation(
				() =>
					({
						validate: jest.fn().mockRejectedValue(validatorError)
					}) as unknown as GetWorkflowByIdRequestValidator
			);

			workflowManager = new WorkflowManager(mockWorkflowRepository);

			await expect(workflowManager.getWorkflowById("workflow-123", mockUserInfo)).rejects.toThrow(validatorError);
		});

		it("should wrap non-ApiError errors", async () => {
			mockWorkflowRepository.getWorkflowWithDetails.mockRejectedValue(new Error("Database connection failed"));

			await expect(workflowManager.getWorkflowById("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await workflowManager.getWorkflowById("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
			}
		});
	});

	describe("Validator interaction", () => {
		it("should call validator with correct parameters", async () => {
			mockWorkflowRepository.getWorkflowWithDetails.mockResolvedValue(mockWorkflowWithDetails);
			const mockValidate = jest.fn().mockResolvedValue({
				workflowId: "workflow-123",
				workflow: mockWorkflowWithDetails.workflow,
				userInfo: mockUserInfo
			});
			MockedGetWorkflowByIdRequestValidator.mockImplementation(
				() =>
					({
						validate: mockValidate
					}) as unknown as GetWorkflowByIdRequestValidator
			);

			workflowManager = new WorkflowManager(mockWorkflowRepository);

			await workflowManager.getWorkflowById("workflow-123", mockUserInfo);

			expect(mockValidate).toHaveBeenCalledWith("workflow-123", mockUserInfo);
		});
	});
});

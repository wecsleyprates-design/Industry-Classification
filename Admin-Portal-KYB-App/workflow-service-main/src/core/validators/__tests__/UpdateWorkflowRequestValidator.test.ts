import { UpdateWorkflowRequestValidator } from "#core/validators/UpdateWorkflowRequestValidator";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { TriggerRepository } from "#core/trigger";
import type { Workflow } from "#core/workflow/types";
import { UserInfo } from "#types/common";
import { UpdateWorkflowRequest } from "#core/versioning/types";
import { ROLE_ID } from "#constants";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

jest.mock("#core/workflow/workflowRepository");
jest.mock("#core/trigger");

describe("UpdateWorkflowRequestValidator", () => {
	let validator: UpdateWorkflowRequestValidator;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;

	const mockWorkflow: Workflow = {
		id: "workflow-123",
		customer_id: "customer-456",
		name: "Test Workflow",
		description: "Test Description",
		active: true,
		priority: 1,
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockUserInfo: UserInfo & { "custom:customer_id": string } = {
		user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
		email: "test@example.com",
		given_name: "John",
		family_name: "Doe",
		customer_id: "customer-456",
		"custom:customer_id": "customer-456",
		role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
	} as UserInfo & { "custom:customer_id": string };

	beforeEach(() => {
		jest.clearAllMocks();
		mockWorkflowRepository = {
			getWorkflowById: jest.fn()
		} as jest.Mocked<Partial<WorkflowRepository>> as jest.Mocked<WorkflowRepository>;
		mockTriggerRepository = {
			getTriggerById: jest.fn()
		} as jest.Mocked<Partial<TriggerRepository>> as jest.Mocked<TriggerRepository>;

		(WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);
		(TriggerRepository as jest.Mock).mockImplementation(() => mockTriggerRepository);

		validator = new UpdateWorkflowRequestValidator();
	});

	describe("validate", () => {
		it("should successfully validate update request with trigger_id", async () => {
			const updateData: UpdateWorkflowRequest = {
				trigger_id: "trigger-123"
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
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

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				updateData,
				userInfo: mockUserInfo
			});
			expect(mockWorkflowRepository.getWorkflowById).toHaveBeenCalledWith("workflow-123", undefined);
			expect(mockTriggerRepository.getTriggerById).toHaveBeenCalledWith("trigger-123");
		});

		it("should successfully validate update request with rules", async () => {
			const updateData: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					}
				]
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toBeDefined();
			expect(result.workflowId).toBe("workflow-123");
			expect(result.updateData.rules).toEqual(updateData.rules);
		});

		it("should successfully validate update request with default_action", async () => {
			const updateData: UpdateWorkflowRequest = {
				default_action: {
					type: "set_field",
					parameters: { field: "case.status", value: "APPROVED" }
				}
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				updateData,
				userInfo: mockUserInfo
			});
		});

		it("should throw error when workflow does not exist", async () => {
			const updateData: UpdateWorkflowRequest = {};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

			await expect(validator.validate("non-existent", updateData, mockUserInfo)).rejects.toThrow(
				"Workflow with ID non-existent not found"
			);
		});

		it("should throw error when user does not have access to workflow", async () => {
			const updateData: UpdateWorkflowRequest = {};
			const differentUserInfo: UserInfo & { "custom:customer_id": string } = {
				user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
				email: "test@example.com",
				given_name: "John",
				family_name: "Doe",
				customer_id: "different-customer",
				"custom:customer_id": "different-customer",
				role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
			} as UserInfo & { "custom:customer_id": string };

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			await expect(validator.validate("workflow-123", updateData, differentUserInfo)).rejects.toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});

		it("should throw error when trigger does not exist", async () => {
			const updateData: UpdateWorkflowRequest = {
				trigger_id: "non-existent-trigger"
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockTriggerRepository.getTriggerById.mockResolvedValue(null);

			await expect(validator.validate("workflow-123", updateData, mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", updateData, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe("Trigger with ID non-existent-trigger not found");
				expect((error as ApiError).status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should not validate rules structure", async () => {
			const updateData = {
				rules: [
					{
						name: "Invalid Rule",
						priority: 1,
						conditions: {
							operator: "INVALID_OPERATOR",
							conditions: []
						},
						actions: []
					}
				]
			} as unknown as UpdateWorkflowRequest;

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toBeDefined();
			expect(result.workflowId).toBe("workflow-123");
			expect(result.updateData.rules).toEqual(updateData.rules);
		});

		it("should not validate default_action structure (handled by router)", async () => {
			const updateData = {
				default_action: {
					type: "INVALID_TYPE",
					parameters: {}
				}
			} as unknown as UpdateWorkflowRequest;

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toBeDefined();
			expect(result.workflowId).toBe("workflow-123");
		});

		it("should successfully validate empty update request", async () => {
			const updateData: UpdateWorkflowRequest = {};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", updateData, mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				updateData,
				userInfo: mockUserInfo
			});
		});
	});
});

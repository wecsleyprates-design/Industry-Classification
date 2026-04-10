import { CreateWorkflowRequestValidator } from "#core/validators/CreateWorkflowRequestValidator";
import { TriggerRepository } from "#core/trigger";
import { UserInfo } from "#types/common";
import type { CreateWorkflowRequest } from "#types/workflow-dtos";
import { ROLE_ID } from "#constants";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

jest.mock("#core/trigger");

describe("CreateWorkflowRequestValidator", () => {
	let validator: CreateWorkflowRequestValidator;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;

	const mockUserInfo: UserInfo & { "custom:customer_id": string } = {
		user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
		email: "test@example.com",
		given_name: "John",
		family_name: "Doe",
		customer_id: "123e4567-e89b-12d3-a456-426614174000",
		"custom:customer_id": "123e4567-e89b-12d3-a456-426614174000",
		role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
	} as UserInfo & { "custom:customer_id": string };

	const mockCustomerId = "123e4567-e89b-12d3-a456-426614174000";

	beforeEach(() => {
		jest.clearAllMocks();
		mockTriggerRepository = {
			getTriggerById: jest.fn()
		} as jest.Mocked<Partial<TriggerRepository>> as jest.Mocked<TriggerRepository>;

		(TriggerRepository as jest.Mock).mockImplementation(() => mockTriggerRepository);

		validator = new CreateWorkflowRequestValidator();
	});

	describe("validate", () => {
		it("should successfully validate create request with trigger_id", async () => {
			const request: CreateWorkflowRequest = {
				name: "Test Workflow",
				trigger_id: "trigger-123"
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

			const result = await validator.validate(request, mockCustomerId, mockUserInfo);

			expect(result).toEqual({
				request,
				customerId: mockCustomerId,
				userInfo: mockUserInfo
			});
			expect(mockTriggerRepository.getTriggerById).toHaveBeenCalledWith("trigger-123");
		});

		it("should successfully validate create request without trigger_id", async () => {
			const request: CreateWorkflowRequest = {
				name: "Test Workflow"
			};

			const result = await validator.validate(request, mockCustomerId, mockUserInfo);

			expect(result).toEqual({
				request,
				customerId: mockCustomerId,
				userInfo: mockUserInfo
			});
			expect(mockTriggerRepository.getTriggerById).not.toHaveBeenCalled();
		});

		it("should successfully validate create request with rules and default_action", async () => {
			const request: CreateWorkflowRequest = {
				name: "Test Workflow",
				trigger_id: "trigger-123",
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
				],
				default_action: {
					type: "set_field",
					parameters: { field: "case.status", value: "APPROVED" }
				}
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

			const result = await validator.validate(request, mockCustomerId, mockUserInfo);

			expect(result).toEqual({
				request,
				customerId: mockCustomerId,
				userInfo: mockUserInfo
			});
			expect(mockTriggerRepository.getTriggerById).toHaveBeenCalledWith("trigger-123");
		});

		it("should throw error when trigger does not exist", async () => {
			const request: CreateWorkflowRequest = {
				name: "Test Workflow",
				trigger_id: "non-existent-trigger"
			};

			mockTriggerRepository.getTriggerById.mockResolvedValue(null);

			await expect(validator.validate(request, mockCustomerId, mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate(request, mockCustomerId, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe("Trigger with ID non-existent-trigger not found");
				expect((error as ApiError).status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should successfully validate create request with undefined trigger_id", async () => {
			const request: CreateWorkflowRequest = {
				name: "Test Workflow",
				trigger_id: undefined
			};

			const result = await validator.validate(request, mockCustomerId, mockUserInfo);

			expect(result).toEqual({
				request,
				customerId: mockCustomerId,
				userInfo: mockUserInfo
			});
			expect(mockTriggerRepository.getTriggerById).not.toHaveBeenCalled();
		});
	});
});

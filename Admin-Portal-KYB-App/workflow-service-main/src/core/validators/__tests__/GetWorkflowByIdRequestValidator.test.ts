import { GetWorkflowByIdRequestValidator } from "../GetWorkflowByIdRequestValidator";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ROLES, ROLE_ID } from "#constants";
import type { UserInfo } from "#types/common";

// Mock the WorkflowRepository
jest.mock("#core/workflow/workflowRepository", () => ({
	WorkflowRepository: jest.fn().mockImplementation(() => ({
		getWorkflowById: jest.fn()
	}))
}));

// Mock isValidUUID function
jest.mock("#utils/validation", () => ({
	isValidUUID: jest.fn()
}));

import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { isValidUUID } from "#utils/validation";

// eslint-disable-next-line @typescript-eslint/naming-convention
const MockedWorkflowRepository = WorkflowRepository as jest.MockedClass<typeof WorkflowRepository>;
const mockedIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>;

describe("GetWorkflowByIdRequestValidator", () => {
	let validator: GetWorkflowByIdRequestValidator;
	let mockWorkflowRepository: { getWorkflowById: jest.Mock };

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

	const mockAdminUserInfo: UserInfo = {
		user_id: "admin-123",
		email: "admin@example.com",
		given_name: "Admin",
		family_name: "User",
		customer_id: "customer-123",
		role: {
			id: ROLE_ID.ADMIN,
			code: ROLES.ADMIN
		}
	};

	const mockWorkflow = {
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
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {
			getWorkflowById: jest.fn()
		};

		MockedWorkflowRepository.mockImplementation(() => mockWorkflowRepository as any);
		mockedIsValidUUID.mockReturnValue(true);

		validator = new GetWorkflowByIdRequestValidator();
	});

	describe("validateWorkflowIdFormat", () => {
		it("should throw error if workflowId is missing", async () => {
			await expect(validator.validate("", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Workflow ID is required");
			}
		});

		it("should throw error if workflowId is not a valid UUID", async () => {
			mockedIsValidUUID.mockReturnValue(false);

			await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("invalid-uuid", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("valid UUID format");
			}
		});
	});

	describe("validateWorkflowExists", () => {
		it("should throw error if workflow not found", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).message).toContain("not found");
			}
		});
	});

	describe("validateWorkflowAccess", () => {
		it("should throw error if customer user tries to access another customer workflow", async () => {
			const otherCustomerWorkflow = {
				...mockWorkflow,
				customer_id: "other-customer-456"
			};
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(otherCustomerWorkflow);

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});

		it("should allow admin to access any customer workflow", async () => {
			const otherCustomerWorkflow = {
				...mockWorkflow,
				customer_id: "other-customer-456"
			};
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(otherCustomerWorkflow);

			const result = await validator.validate("workflow-123", mockAdminUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: otherCustomerWorkflow,
				userInfo: mockAdminUserInfo
			});
		});

		it("should allow customer to access their own workflow", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				userInfo: mockUserInfo
			});
		});
	});

	describe("Success cases", () => {
		it("should return validated data when all validations pass", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator.validate("workflow-123", mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				userInfo: mockUserInfo
			});

			expect(mockWorkflowRepository.getWorkflowById).toHaveBeenCalledWith("workflow-123", undefined);
		});

		it("should validate workflow ID format before checking existence", async () => {
			mockedIsValidUUID.mockReturnValue(false);

			await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toThrow(ApiError);

			// Should not call repository if UUID is invalid
			expect(mockWorkflowRepository.getWorkflowById).not.toHaveBeenCalled();
		});
	});
});

import { GetCaseExecutionDetailsRequestValidator } from "../GetCaseExecutionDetailsRequestValidator";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ROLES, ROLE_ID } from "#constants";
import type { UserInfo } from "#types/common";
import { AuditRepository } from "#core/audit/auditRepository";
import type { ExecutionWithWorkflowInfo } from "#core/audit/types";

jest.mock("#core/audit/auditRepository", () => ({
	AuditRepository: jest.fn().mockImplementation(() => ({
		getLatestExecutionByCaseId: jest.fn()
	}))
}));

jest.mock("#utils/validation", () => ({
	isValidUUID: jest.fn()
}));

import { isValidUUID } from "#utils/validation";

const mockedIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>;

describe("GetCaseExecutionDetailsRequestValidator", () => {
	let validator: GetCaseExecutionDetailsRequestValidator;
	let mockAuditRepository: jest.Mocked<AuditRepository>;

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

	const mockExecution: ExecutionWithWorkflowInfo = {
		case_id: "case-123",
		workflow_version_id: "version-123",
		matched_rule_id: "rule-123",
		executed_at: new Date("2024-01-15T10:30:00Z"),
		input_attr: {},
		evaluation_log: {},
		latency_ms: 100,
		created_at: new Date("2024-01-15T10:30:00Z"),
		customer_id: "customer-123",
		workflow_id: "workflow-123",
		action_applied: {},
		workflow_name: "Test Workflow",
		version_number: "1.0"
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockAuditRepository = {
			getLatestExecutionByCaseId: jest.fn()
		} as unknown as jest.Mocked<AuditRepository>;

		(AuditRepository as jest.Mock).mockImplementation(() => mockAuditRepository);
		mockedIsValidUUID.mockReturnValue(true);

		validator = new GetCaseExecutionDetailsRequestValidator(mockAuditRepository);
	});

	describe("validateCaseIdFormat", () => {
		it("should throw error if caseId is missing", async () => {
			await expect(validator.validate("", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Case ID is required");
			}
		});

		it("should throw error if caseId is not a valid UUID", async () => {
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

	describe("validateExecutionExists", () => {
		it("should throw error if execution not found", async () => {
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([]);

			await expect(validator.validate("case-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("case-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).message).toContain("No workflow execution found");
			}
		});

		it("should return execution when it exists", async () => {
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([mockExecution]);

			const result = await validator.validate("case-123", mockUserInfo);

			expect(mockAuditRepository.getLatestExecutionByCaseId).toHaveBeenCalledWith("case-123");
			expect(result.execution).toEqual(mockExecution);
		});
	});

	describe("validateExecutionAccess", () => {
		it("should throw error if customer_id is missing", async () => {
			const executionWithoutCustomer: ExecutionWithWorkflowInfo = {
				...mockExecution,
				customer_id: null as unknown as string
			};
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([executionWithoutCustomer]);

			await expect(validator.validate("case-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("case-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect((error as ApiError).message).toContain("missing customer_id");
			}
		});

		it("should allow admin to access any customer execution", async () => {
			const otherCustomerExecution = {
				...mockExecution,
				customer_id: "other-customer-456"
			};
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([otherCustomerExecution]);

			const result = await validator.validate("case-123", mockAdminUserInfo);

			expect(result).toEqual({
				caseId: "case-123",
				execution: otherCustomerExecution,
				userInfo: mockAdminUserInfo
			});
		});

		it("should allow customer to access their own execution", async () => {
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([mockExecution]);

			const result = await validator.validate("case-123", mockUserInfo);

			expect(result).toEqual({
				caseId: "case-123",
				execution: mockExecution,
				userInfo: mockUserInfo
			});
		});

		it("should throw error if customer tries to access another customer execution", async () => {
			const otherCustomerExecution = {
				...mockExecution,
				customer_id: "other-customer-456"
			};
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([otherCustomerExecution]);

			await expect(validator.validate("case-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("case-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});
	});

	describe("Success cases", () => {
		it("should return validated data when all validations pass", async () => {
			mockAuditRepository.getLatestExecutionByCaseId.mockResolvedValue([mockExecution]);

			const result = await validator.validate("case-123", mockUserInfo);

			expect(result).toEqual({
				caseId: "case-123",
				execution: mockExecution,
				userInfo: mockUserInfo
			});

			expect(mockAuditRepository.getLatestExecutionByCaseId).toHaveBeenCalledWith("case-123");
		});

		it("should validate case ID format before checking existence", async () => {
			mockedIsValidUUID.mockReturnValue(false);

			await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toThrow(ApiError);

			expect(mockAuditRepository.getLatestExecutionByCaseId).not.toHaveBeenCalled();
		});
	});
});

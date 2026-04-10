import { GetWorkflowsListRequestValidator } from "../GetWorkflowsListRequestValidator";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ROLES, ROLE_ID } from "#constants";
import type { UserInfo } from "#types/common";
import * as UtilsModule from "@joinworth/types";

jest.mock("@joinworth/types", () => {
	const actual = jest.requireActual("@joinworth/types");
	return {
		...actual,
		Utils: {
			...actual.Utils,
			Utils: {
				...actual.Utils.Utils,
				isUUID: jest.fn()
			}
		}
	};
});

const mockIsUUID = UtilsModule.Utils.Utils.isUUID as unknown as jest.Mock;

describe("GetWorkflowsListRequestValidator", () => {
	let validator: GetWorkflowsListRequestValidator;
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

	beforeEach(() => {
		validator = new GetWorkflowsListRequestValidator();
		jest.clearAllMocks();
		mockIsUUID.mockReturnValue(true);
	});

	describe("validateCustomerId", () => {
		it("should throw error if customerId is missing", async () => {
			await expect(validator.validate("", { customerId: "" }, mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("", { customerId: "" }, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Customer ID is required");
			}
		});

		it("should throw error if customerId is not a valid UUID", async () => {
			mockIsUUID.mockReturnValue(false);

			await expect(validator.validate("invalid-uuid", { customerId: "invalid-uuid" }, mockUserInfo)).rejects.toThrow(
				ApiError
			);

			try {
				await validator.validate("invalid-uuid", { customerId: "invalid-uuid" }, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Customer ID must be a valid UUID");
			}
		});
	});

	describe("validateCustomerAccess", () => {
		it("should allow ADMIN to access any customer's workflows", async () => {
			const result = await validator.validate("customer-999", { customerId: "customer-999" }, mockAdminUserInfo);

			expect(result.customerId).toBe("customer-999");
			expect(result.userInfo).toBe(mockAdminUserInfo);
		});

		it("should allow CUSTOMER to access own workflows", async () => {
			const result = await validator.validate("customer-123", { customerId: "customer-123" }, mockUserInfo);

			expect(result.customerId).toBe("customer-123");
			expect(result.userInfo).toBe(mockUserInfo);
		});

		it("should throw 403 when CUSTOMER tries to access another customer's workflows", async () => {
			await expect(validator.validate("customer-999", { customerId: "customer-999" }, mockUserInfo)).rejects.toThrow(
				ApiError
			);

			try {
				await validator.validate("customer-999", { customerId: "customer-999" }, mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});

		it("should throw 403 when user role is not CUSTOMER or ADMIN", async () => {
			const invalidUserInfo: UserInfo = {
				...mockUserInfo,
				role: {
					id: 999,
					code: "INVALID_ROLE"
				}
			};

			await expect(validator.validate("customer-123", { customerId: "customer-123" }, invalidUserInfo)).rejects.toThrow(
				ApiError
			);

			try {
				await validator.validate("customer-123", { customerId: "customer-123" }, invalidUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});
	});

	describe("validate", () => {
		it("should successfully validate request with valid customerId and access", async () => {
			const params = {
				customerId: "customer-123",
				page: 1,
				itemsPerPage: 10
			};

			const result = await validator.validate("customer-123", params, mockUserInfo);

			expect(result).toEqual({
				customerId: "customer-123",
				params,
				userInfo: mockUserInfo
			});
		});

		it("should successfully validate request for ADMIN with any customerId", async () => {
			const params = {
				customerId: "customer-999",
				page: 1,
				itemsPerPage: 10
			};

			const result = await validator.validate("customer-999", params, mockAdminUserInfo);

			expect(result).toEqual({
				customerId: "customer-999",
				params,
				userInfo: mockAdminUserInfo
			});
		});
	});
});

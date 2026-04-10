import { GetAttributeCatalogRequestValidator } from "../GetAttributeCatalogRequestValidator";
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

describe("GetAttributeCatalogRequestValidator", () => {
	let validator: GetAttributeCatalogRequestValidator;
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
		validator = new GetAttributeCatalogRequestValidator();
		jest.clearAllMocks();
		mockIsUUID.mockReturnValue(true);
	});

	describe("validate", () => {
		it("should successfully validate valid customerId and user access", async () => {
			await expect(validator.validate("customer-123", mockUserInfo)).resolves.toBeUndefined();
		});

		it("should allow ADMIN to access any customer's catalog", async () => {
			await expect(validator.validate("customer-999", mockAdminUserInfo)).resolves.toBeUndefined();
		});
	});

	describe("validateCustomerId", () => {
		it("should throw error if customerId is missing", async () => {
			await expect(validator.validate("", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Customer ID is required");
			}
		});

		it("should throw error if customerId is not a valid UUID", async () => {
			mockIsUUID.mockReturnValue(false);

			await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("invalid-uuid", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).message).toContain("Customer ID must be a valid UUID");
			}
		});

		it("should accept valid UUID format", async () => {
			mockIsUUID.mockReturnValue(true);
			const validUserInfo: UserInfo = {
				...mockUserInfo,
				customer_id: "550e8400-e29b-41d4-a716-446655440000"
			};

			await expect(validator.validate("550e8400-e29b-41d4-a716-446655440000", validUserInfo)).resolves.toBeUndefined();
		});
	});

	describe("validateCustomerAccess", () => {
		it("should allow ADMIN to access any customer's catalog", async () => {
			await expect(validator.validate("customer-999", mockAdminUserInfo)).resolves.toBeUndefined();
		});

		it("should allow CUSTOMER to access own catalog", async () => {
			await expect(validator.validate("customer-123", mockUserInfo)).resolves.toBeUndefined();
		});

		it("should throw error when CUSTOMER tries to access different customer's catalog", async () => {
			await expect(validator.validate("customer-999", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("customer-999", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});

		it("should throw error when user role is not CUSTOMER or ADMIN", async () => {
			const invalidUserInfo: UserInfo = {
				...mockUserInfo,
				role: {
					id: 999,
					code: "INVALID_ROLE"
				}
			};

			await expect(validator.validate("customer-123", invalidUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("customer-123", invalidUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((error as ApiError).message).toContain("Access denied");
			}
		});
	});
});

import { ExportAuditLogsRequestValidator } from "../ExportAuditLogsRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ROLE_ID, ROLES, ERROR_MESSAGES } from "#constants";

const VALID_CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_CUSTOMER_ID = "660e8400-e29b-41d4-a716-446655440001";

describe("ExportAuditLogsRequestValidator", () => {
	let validator: ExportAuditLogsRequestValidator;
	let mockUserInfo: UserInfo;
	let mockAdminUserInfo: UserInfo;

	beforeEach(() => {
		validator = new ExportAuditLogsRequestValidator();
		mockUserInfo = {
			user_id: "user-123",
			email: "customer@example.com",
			role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
			given_name: "Customer",
			family_name: "User",
			customer_id: VALID_CUSTOMER_ID
		};

		mockAdminUserInfo = {
			user_id: "admin-123",
			email: "admin@example.com",
			role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN },
			given_name: "Admin",
			family_name: "User",
			customer_id: ""
		};
	});

	describe("validate", () => {
		describe("validateCustomerId", () => {
			it("should throw error when customerId is missing", async () => {
				await expect(validator.validate("", mockUserInfo)).rejects.toThrow(ApiError);
				await expect(validator.validate("", mockUserInfo)).rejects.toMatchObject({
					status: StatusCodes.BAD_REQUEST,
					message: ERROR_MESSAGES.CUSTOMER_ID_REQUIRED
				});
			});

			it("should throw error when customerId is not a valid UUID", async () => {
				await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toThrow(ApiError);
				await expect(validator.validate("invalid-uuid", mockUserInfo)).rejects.toMatchObject({
					status: StatusCodes.BAD_REQUEST,
					message: ERROR_MESSAGES.CUSTOMER_ID_INVALID_UUID
				});
			});
		});

		describe("validateCustomerAccess", () => {
			it("should allow ADMIN to access any customer's logs", async () => {
				await expect(validator.validate(VALID_CUSTOMER_ID, mockAdminUserInfo)).resolves.toBeUndefined();
			});

			it("should allow CUSTOMER to access own logs", async () => {
				await expect(validator.validate(VALID_CUSTOMER_ID, mockUserInfo)).resolves.toBeUndefined();
			});

			it("should throw error when CUSTOMER tries to access different customer's logs", async () => {
				await expect(validator.validate(OTHER_CUSTOMER_ID, mockUserInfo)).rejects.toThrow(ApiError);
				await expect(validator.validate(OTHER_CUSTOMER_ID, mockUserInfo)).rejects.toMatchObject({
					status: StatusCodes.FORBIDDEN,
					message: ERROR_MESSAGES.ACCESS_DENIED
				});
			});

			it("should throw error when user role is not CUSTOMER or ADMIN", async () => {
				const invalidUserInfo: UserInfo = {
					...mockUserInfo,
					role: {
						id: 999,
						code: "INVALID_ROLE"
					}
				};

				await expect(validator.validate(VALID_CUSTOMER_ID, invalidUserInfo)).rejects.toThrow(ApiError);
				await expect(validator.validate(VALID_CUSTOMER_ID, invalidUserInfo)).rejects.toMatchObject({
					status: StatusCodes.FORBIDDEN,
					message: ERROR_MESSAGES.ACCESS_DENIED
				});
			});
		});
	});
});

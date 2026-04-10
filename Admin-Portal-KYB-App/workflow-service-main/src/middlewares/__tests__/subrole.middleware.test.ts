import { validateSubroleForWrite, createValidateSubroleForWrite } from "#middlewares/subrole.middleware";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ROLES, ROLE_ID } from "#constants";
import { ResponseWithLocals, UserInfo, RoleMiddlewareError } from "#types/common";

const validateSharedRulesWrite = createValidateSubroleForWrite([ROLES.ADMIN, ROLES.CUSTOMER], "shared rules");

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		debug: jest.fn()
	}
}));

describe("Subrole Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<ResponseWithLocals>;
	let mockNext: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		mockReq = {};
		mockRes = {
			locals: {
				user: {} as UserInfo
			}
		};
		mockNext = jest.fn();
	});

	describe("validateSubroleForWrite", () => {
		it("should allow ADMIN user (always has write access)", async () => {
			mockRes.locals!.user = {
				user_id: "admin-123",
				email: "admin@example.com",
				role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN },
				given_name: "Admin",
				family_name: "User",
				customer_id: ""
			};

			await validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should block APPLICANT user", async () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			await expect(validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
				RoleMiddlewareError
			);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should throw error with correct message for APPLICANT", async () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			try {
				await validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext);
				fail("Should have thrown RoleMiddlewareError");
			} catch (error: any) {
				expect(error).toBeInstanceOf(RoleMiddlewareError);
				expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
				expect(error.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
				expect(error.message).toContain("Applicant role does not have write access");
			}
		});

		it("should block CUSTOMER user (only ADMIN can write)", async () => {
			mockRes.locals!.user = {
				user_id: "customer-123",
				email: "owner@example.com",
				role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
				given_name: "Owner",
				family_name: "User",
				customer_id: "customer-456",
				subrole_id: "subrole-owner-123"
			};

			await expect(validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
				RoleMiddlewareError
			);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should throw error with correct message for CUSTOMER", async () => {
			mockRes.locals!.user = {
				user_id: "customer-123",
				email: "customer@example.com",
				role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
				given_name: "Customer",
				family_name: "User",
				customer_id: "customer-456",
				subrole_id: "subrole-owner-123"
			};

			try {
				await validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext);
				fail("Should have thrown RoleMiddlewareError");
			} catch (error: any) {
				expect(error).toBeInstanceOf(RoleMiddlewareError);
				expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
				expect(error.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
				expect(error.message).toContain("Customer role does not have write access");
			}
		});

		it("should block CUSTOMER user regardless of subrole", async () => {
			const subroleScenarios = [
				{ subrole_id: "subrole-owner-123" },
				{ subrole_id: "subrole-cro-123" },
				{ subrole_id: "subrole-risk-123" },
				{}
			];

			for (const scenario of subroleScenarios) {
				mockRes.locals!.user = {
					user_id: "customer-123",
					email: "customer@example.com",
					role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
					given_name: "Customer",
					family_name: "User",
					customer_id: "customer-456",
					...scenario
				};

				await expect(validateSubroleForWrite(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
					RoleMiddlewareError
				);

				expect(mockNext).not.toHaveBeenCalled();
			}
		});
	});

	describe("createValidateSubroleForWrite (shared rules: ADMIN + CUSTOMER)", () => {
		it("should allow ADMIN user", async () => {
			mockRes.locals!.user = {
				user_id: "admin-123",
				email: "admin@example.com",
				role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN },
				given_name: "Admin",
				family_name: "User",
				customer_id: ""
			};

			await validateSharedRulesWrite(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should allow CUSTOMER user (for case-service forwarded token)", async () => {
			mockRes.locals!.user = {
				user_id: "customer-123",
				email: "owner@example.com",
				role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
				given_name: "Owner",
				family_name: "User",
				customer_id: "customer-456",
				subrole_id: "subrole-owner-123"
			};

			await validateSharedRulesWrite(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should block APPLICANT user", async () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			await expect(validateSharedRulesWrite(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
				RoleMiddlewareError
			);

			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});

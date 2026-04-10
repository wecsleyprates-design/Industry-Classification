import { validateRole } from "#middlewares/role.middleware";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ROLES, ROLE_ID } from "#constants";
import { ResponseWithLocals, UserInfo } from "#types/common";

describe("Role Middleware", () => {
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

	describe("validateRole", () => {
		it("should allow ADMIN user when ADMIN role is required", () => {
			mockRes.locals!.user = {
				user_id: "admin-123",
				email: "admin@example.com",
				role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN },
				given_name: "Admin",
				family_name: "User",
				customer_id: ""
			};

			const middleware = validateRole(ROLES.ADMIN);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should allow CUSTOMER user when CUSTOMER role is required", () => {
			mockRes.locals!.user = {
				user_id: "customer-123",
				email: "customer@example.com",
				role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
				given_name: "Customer",
				family_name: "User",
				customer_id: "customer-456"
			};

			const middleware = validateRole(ROLES.CUSTOMER);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should allow ADMIN or CUSTOMER when both are required", () => {
			mockRes.locals!.user = {
				user_id: "admin-123",
				email: "admin@example.com",
				role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN },
				given_name: "Admin",
				family_name: "User",
				customer_id: ""
			};

			const middleware = validateRole(ROLES.ADMIN, ROLES.CUSTOMER);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should throw error when user role is not in allowed roles", () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			const middleware = validateRole(ROLES.ADMIN, ROLES.CUSTOMER);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow();

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should throw RoleMiddlewareError with correct status and error code", () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			const middleware = validateRole(ROLES.ADMIN);

			try {
				middleware(mockReq as Request, mockRes as Response, mockNext);
				fail("Should have thrown RoleMiddlewareError");
			} catch (error: any) {
				expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
				expect(error.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
				expect(error.message).toBe("Role Not Allowed");
			}
		});

		it("should allow CUSTOMER user when ADMIN and CUSTOMER are required", () => {
			mockRes.locals!.user = {
				user_id: "customer-123",
				email: "customer@example.com",
				role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
				given_name: "Customer",
				family_name: "User",
				customer_id: "customer-456"
			};

			const middleware = validateRole(ROLES.ADMIN, ROLES.CUSTOMER);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should block APPLICANT when only ADMIN and CUSTOMER are allowed", () => {
			mockRes.locals!.user = {
				user_id: "applicant-123",
				email: "applicant@example.com",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
				given_name: "Applicant",
				family_name: "User",
				customer_id: ""
			};

			const middleware = validateRole(ROLES.ADMIN, ROLES.CUSTOMER);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow();

			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});

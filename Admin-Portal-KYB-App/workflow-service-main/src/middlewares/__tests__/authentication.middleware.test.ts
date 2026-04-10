import { validateUser } from "#middlewares/authentication.middleware";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ROLES, ROLE_ID } from "#constants";
import { ResponseWithLocals, UserInfo } from "#types/common";

jest.mock("#configs", () => ({
	envConfig: {
		WORTH_ADMIN_USER_POOL_ID: "us-east-1_admin123",
		CUSTOMER_USER_POOL_ID: "us-east-1_customer456"
	}
}));

jest.mock("#utils", () => ({
	verifyToken: jest.fn()
}));

describe("Authentication Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<ResponseWithLocals>;
	let mockNext: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		mockReq = {
			get: jest.fn()
		};
		mockRes = {
			locals: {
				user: {} as UserInfo
			}
		};
		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("validateUser", () => {
		it("should successfully authenticate admin user", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_admin123",
				"cognito:username": "admin@example.com",
				"custom:id": "admin-user-123",
				"custom:customer_id": "admin-customer-123",
				email: "admin@example.com",
				given_name: "Admin",
				family_name: "User"
			};

			((await import("#utils")).verifyToken as jest.Mock).mockResolvedValue(mockTokenData);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer valid-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.locals?.user).toEqual({
				...mockTokenData,
				role: {
					id: ROLE_ID.ADMIN,
					code: ROLES.ADMIN
				},
				user_id: "admin-user-123",
				customer_id: "admin-customer-123",
				sub_user_id: "admin@example.com",
				access_token: "valid-token"
			});
			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should successfully authenticate customer user", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_customer456",
				"cognito:username": "customer@example.com",
				"custom:id": "customer-user-123",
				"custom:customer_id": "customer-456",
				email: "customer@example.com",
				given_name: "Customer",
				family_name: "User"
			};

			((await import("#utils")).verifyToken as jest.Mock).mockResolvedValue(mockTokenData);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer valid-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.locals?.user).toEqual({
				...mockTokenData,
				role: {
					id: ROLE_ID.CUSTOMER,
					code: ROLES.CUSTOMER
				},
				user_id: "customer-user-123",
				customer_id: "customer-456",
				sub_user_id: "customer@example.com",
				access_token: "valid-token"
			});
			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should successfully authenticate applicant user", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_other789",
				"cognito:username": "applicant@example.com",
				"custom:id": "applicant-user-123",
				"custom:customer_id": "applicant-customer-789",
				email: "applicant@example.com",
				given_name: "Applicant",
				family_name: "User"
			};

			((await import("#utils")).verifyToken as jest.Mock).mockResolvedValue(mockTokenData);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer valid-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.locals?.user).toEqual({
				...mockTokenData,
				role: {
					id: ROLE_ID.APPLICANT,
					code: ROLES.APPLICANT
				},
				user_id: "applicant-user-123",
				customer_id: "applicant-customer-789",
				sub_user_id: "applicant@example.com",
				access_token: "valid-token"
			});
			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should throw error when authorization header is missing", async () => {
			(mockReq.get as jest.Mock).mockReturnValue(undefined);

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Authorization header not present",
					status: StatusCodes.UNAUTHORIZED,
					errorCode: ERROR_CODES.UNAUTHENTICATED
				})
			);
		});

		it("should throw error when authorization header does not start with Bearer", async () => {
			(mockReq.get as jest.Mock).mockReturnValue("Invalid token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Invalid Authorization header type",
					status: StatusCodes.BAD_REQUEST,
					errorCode: ERROR_CODES.INVALID
				})
			);
		});

		it("should handle token verification errors", async () => {
			const tokenError = new Error("Invalid token");
			((await import("#utils")).verifyToken as jest.Mock).mockRejectedValue(tokenError);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer invalid-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(tokenError);
		});

		it("should handle token expired errors", async () => {
			const expiredError = new Error("Token expired");
			expiredError.name = "TokenExpiredError";
			((await import("#utils")).verifyToken as jest.Mock).mockRejectedValue(expiredError);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer expired-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(expiredError);
		});

		it("should handle missing access token in authorization header", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_admin123",
				"cognito:username": "admin@example.com",
				"custom:id": "admin-user-123"
			};

			((await import("#utils")).verifyToken as jest.Mock).mockResolvedValue(mockTokenData);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer ");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.locals?.user.access_token).toBe("");
		});

		it("should handle customer user without customer_id", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_customer456",
				"cognito:username": "customer@example.com",
				"custom:id": "customer-user-123"
			};

			((await import("#utils")).verifyToken as jest.Mock).mockResolvedValue(mockTokenData);
			(mockReq.get as jest.Mock).mockReturnValue("Bearer valid-token");

			await validateUser(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.locals?.user.customer_id).toBe("");
		});
	});
});

import { verifyToken, decodeToken } from "#utils/token";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import jwt from "jsonwebtoken";

jest.mock("#lib/index", () => ({
	cognito: {
		verifyCognitoToken: jest.fn()
	}
}));

jest.mock("jsonwebtoken", () => ({
	...jest.requireActual("jsonwebtoken"),
	decode: jest.fn() as jest.MockedFunction<typeof import("jsonwebtoken").decode>
}));

describe("Token Utils", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("verifyToken", () => {
		it("should successfully verify a valid token", async () => {
			const mockTokenData = {
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_admin123",
				"custom:id": "user-123",
				"cognito:username": "user@example.com",
				email: "user@example.com"
			};

			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockResolvedValue(mockTokenData);

			const result = await verifyToken("valid-token");

			expect(result).toEqual(mockTokenData);
			expect((await import("#lib/index")).cognito.verifyCognitoToken).toHaveBeenCalledWith("valid-token", "id");
		});

		it("should handle token expired error", async () => {
			const expiredError = new Error("Token expired");
			expiredError.name = "TokenExpiredError";
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(expiredError);

			await expect(verifyToken("expired-token")).rejects.toThrow();

			expect((await import("#lib/index")).cognito.verifyCognitoToken).toHaveBeenCalledWith("expired-token", "id");
		});

		it("should modify token expired error properties", async () => {
			const expiredError = new Error("Token expired");
			expiredError.name = "TokenExpiredError";
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(expiredError);

			try {
				await verifyToken("expired-token");
			} catch (error: unknown) {
				expect((error as Error).message).toBe("User Session Expired");
				expect((error as { status: number }).status).toBe(StatusCodes.UNAUTHORIZED);
				expect((error as { errorCode: string }).errorCode).toBe(ERROR_CODES.UNAUTHENTICATED);
			}
		});

		it("should handle generic token verification errors", async () => {
			const genericError = new Error("Invalid token");
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(genericError);

			await expect(verifyToken("invalid-token")).rejects.toThrow();

			expect((await import("#lib/index")).cognito.verifyCognitoToken).toHaveBeenCalledWith("invalid-token", "id");
		});

		it("should modify generic error properties", async () => {
			const genericError = new Error("Invalid token");
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(genericError);

			try {
				await verifyToken("invalid-token");
			} catch (error: unknown) {
				expect((error as Error).message).toBe("Invalid token");
				expect((error as { status: number }).status).toBe(StatusCodes.UNAUTHORIZED);
				expect((error as { errorCode: string }).errorCode).toBe(ERROR_CODES.UNAUTHENTICATED);
			}
		});

		it("should handle non-object errors", async () => {
			const stringError = "String error";
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(stringError);

			await expect(verifyToken("invalid-token")).rejects.toBe(stringError);
		});

		it("should handle null/undefined errors", async () => {
			((await import("#lib/index")).cognito.verifyCognitoToken as jest.Mock).mockRejectedValue(null);

			await expect(verifyToken("invalid-token")).rejects.toBeNull();
		});
	});

	describe("decodeToken", () => {
		it("should successfully decode a token", () => {
			const mockToken =
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
			const mockDecodedToken = {
				sub: "1234567890",
				name: "John Doe",
				iat: 1516239022
			};

			(jwt.decode as jest.Mock).mockReturnValue(mockDecodedToken);

			const result = decodeToken(mockToken, { complete: true });

			expect(result).toEqual(mockDecodedToken);
			expect(jwt.decode).toHaveBeenCalledWith(mockToken, { complete: true });
		});

		it("should decode token with default options", () => {
			const mockToken = "mock-token";
			const mockDecodedToken = { sub: "1234567890" };

			(jwt.decode as jest.Mock).mockReturnValue(mockDecodedToken);

			const result = decodeToken(mockToken, {});

			expect(result).toEqual(mockDecodedToken);
			expect(jwt.decode).toHaveBeenCalledWith(mockToken, {});
		});

		it("should handle decode errors", () => {
			const invalidToken = "invalid-token";
			(jwt.decode as jest.Mock).mockReturnValue(null);

			const result = decodeToken(invalidToken, {});

			expect(result).toBeNull();
			expect(jwt.decode).toHaveBeenCalledWith(invalidToken, {});
		});
	});
});

import { BaseHttpService } from "../BaseHttpService";
import axios, { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import { ERROR_CODES } from "#constants";

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn()
	}
}));

// Create a concrete implementation for testing
class TestHttpService extends BaseHttpService {
	constructor(baseURL: string = "http://test.com", timeout: number = 10000) {
		super(baseURL, timeout);
	}
}

describe("BaseHttpService", () => {
	let service: TestHttpService;

	beforeEach(() => {
		service = new TestHttpService();
		jest.clearAllMocks();
	});

	describe("parseError", () => {
		it("should parse Axios error with response", () => {
			const error = {
				response: {
					status: StatusCodes.BAD_REQUEST
				},
				message: "Bad Request"
			} as AxiosError;

			const result = (service as unknown as { parseError: (error: AxiosError) => unknown }).parseError(error);

			expect(result).toEqual({
				status: StatusCodes.BAD_REQUEST,
				errorCode: ERROR_CODES.UNKNOWN_ERROR,
				message: "Bad Request"
			});
		});

		it("should parse Axios error without response", () => {
			const error = {
				message: "Network Error"
			} as AxiosError;

			const result = (service as unknown as { parseError: (error: AxiosError) => unknown }).parseError(error);

			expect(result).toEqual({
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				errorCode: ERROR_CODES.UNKNOWN_ERROR,
				message: "Network Error"
			});
		});
	});

	describe("buildErrorDetails", () => {
		it("should build error details from Axios error with response", () => {
			const error = {
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error",
					data: { error: "Something went wrong" }
				},
				config: {
					url: "http://test.com/api",
					method: "post"
				},
				message: "Request failed",
				code: "ECONNREFUSED"
			} as unknown as AxiosError;

			const result = (service as unknown as { buildErrorDetails: (error: AxiosError) => unknown }).buildErrorDetails(
				error
			);

			expect(result).toEqual({
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				statusText: "Internal Server Error",
				url: "http://test.com/api",
				method: "post",
				data: { error: "Something went wrong" },
				message: "Request failed",
				code: "ECONNREFUSED"
			});
		});

		it("should build error details from Axios error without response", () => {
			const error = {
				config: {
					url: "http://test.com/api",
					method: "get"
				},
				message: "Network Error",
				code: "ETIMEDOUT"
			} as unknown as AxiosError;

			const result = (service as unknown as { buildErrorDetails: (error: AxiosError) => unknown }).buildErrorDetails(
				error
			);

			expect(result).toEqual({
				status: undefined,
				statusText: undefined,
				url: "http://test.com/api",
				method: "get",
				data: undefined,
				message: "Network Error",
				code: "ETIMEDOUT"
			});
		});
	});

	describe("handleAxiosError", () => {
		it("should handle error with response (server error)", () => {
			const error = {
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error"
				},
				config: { url: "http://test.com/api", method: "post" },
				message: "Request failed"
			} as unknown as AxiosError;

			const result = (
				service as unknown as {
					handleAxiosError: (error: AxiosError, serviceName: string, context?: string) => unknown;
				}
			).handleAxiosError(error, "Test Service", "testing");

			expect(logger.warn).toHaveBeenCalledWith(
				"Test Service returned error status 500 when testing",
				expect.objectContaining({
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: "Request failed"
				})
			);
			expect(result).toBeDefined();
		});

		it("should handle error with request but no response (network error)", () => {
			const error = {
				request: {},
				config: { url: "http://test.com/api", method: "get" },
				message: "Network Error"
			} as unknown as AxiosError;

			(
				service as unknown as {
					handleAxiosError: (error: AxiosError, serviceName: string, context?: string) => unknown;
				}
			).handleAxiosError(error, "Test Service", "testing");

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.anything() }),
				expect.stringContaining("Test Service request failed (no response received) when testing")
			);
		});

		it("should handle error setting up request", () => {
			const error = {
				config: { url: "http://test.com/api", method: "post" },
				message: "Request setup failed"
			} as unknown as AxiosError;

			(
				service as unknown as {
					handleAxiosError: (error: AxiosError, serviceName: string, context?: string) => unknown;
				}
			).handleAxiosError(error, "Test Service");

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.objectContaining({ message: "Request setup failed" }) }),
				"Error setting up request to Test Service"
			);
		});
	});

	describe("handleNonAxiosError", () => {
		it("should handle Error instance", () => {
			const error = new Error("Something went wrong");

			(
				service as unknown as { handleNonAxiosError: (error: unknown, serviceName: string, context?: string) => void }
			).handleNonAxiosError(error, "Test Service", "testing");

			expect(logger.error).toHaveBeenCalledWith({ error }, "Unexpected error when calling Test Service when testing");
		});

		it("should handle non-Error values", () => {
			const error = "String error";

			(
				service as unknown as { handleNonAxiosError: (error: unknown, serviceName: string, context?: string) => void }
			).handleNonAxiosError(error, "Test Service");

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: "String error" }),
				"Unexpected error when calling Test Service"
			);
		});
	});

	describe("handleError", () => {
		it("should handle Axios errors", () => {
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.BAD_REQUEST
				},
				config: { url: "http://test.com/api" },
				message: "Bad Request"
			} as unknown as AxiosError;

			// Mock axios.isAxiosError
			const isAxiosErrorSpy = jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

			const result = (
				service as unknown as {
					handleError: (error: unknown, serviceName: string, context?: string) => unknown;
				}
			).handleError(error, "Test Service", "testing");

			expect(result).toBeDefined();
			expect(logger.warn).toHaveBeenCalled();

			// Restore
			isAxiosErrorSpy.mockRestore();
		});

		it("should handle non-Axios errors", () => {
			const error = new Error("Non-Axios error");

			// Mock axios.isAxiosError
			const isAxiosErrorSpy = jest.spyOn(axios, "isAxiosError").mockReturnValue(false);

			(
				service as unknown as {
					handleError: (error: unknown, serviceName: string, context?: string) => unknown;
				}
			).handleError(error, "Test Service", "testing");

			expect(logger.error).toHaveBeenCalledWith({ error }, "Unexpected error when calling Test Service when testing");

			// Restore
			isAxiosErrorSpy.mockRestore();
		});
	});

	describe("constructor", () => {
		it("should set baseURL and timeout", () => {
			const customService = new TestHttpService("http://custom.com", 5000);
			expect((customService as unknown as { baseURL: string }).baseURL).toBe("http://custom.com");
			expect((customService as unknown as { timeout: number }).timeout).toBe(5000);
		});

		it("should use default timeout if not provided", () => {
			const customService = new TestHttpService("http://custom.com");
			expect((customService as unknown as { timeout: number }).timeout).toBe(10000);
		});
	});
});

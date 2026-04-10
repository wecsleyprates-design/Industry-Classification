import { throttleMiddleware, stopCleanupInterval } from "../throttle.middleware";
import { type Request, type Response, type NextFunction } from "express";
import { ApiError } from "#types/common";

describe("throttleMiddleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: jest.MockedFunction<NextFunction>;

	beforeEach(() => {
		mockReq = {};
		mockRes = {
			locals: {
				user: {
					user_id: "user-123"
				}
			}
		} as any;
		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Stop cleanup interval after each test to prevent Jest from hanging
		stopCleanupInterval();
	});

	describe("with default options", () => {
		const middleware = throttleMiddleware();

		it("should allow request when under limit", () => {
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should allow multiple requests from same user", () => {
			middleware(mockReq as Request, mockRes as Response, mockNext);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledTimes(2);
		});
	});

	describe("with custom maxRequests", () => {
		it("should allow requests up to maxRequests", () => {
			const middleware = throttleMiddleware({ maxRequests: 2, windowMs: 60000, endpointKey: "test-max-allow" });

			middleware(mockReq as Request, mockRes as Response, mockNext);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledTimes(2);
		});

		it("should throw error when maxRequests exceeded", () => {
			const middleware = throttleMiddleware({ maxRequests: 2, windowMs: 60000, endpointKey: "test-max-exceed" });

			middleware(mockReq as Request, mockRes as Response, mockNext);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow(ApiError);

			expect(mockNext).toHaveBeenCalledTimes(2);
		});
	});

	describe("with different endpoints", () => {
		const middleware1 = throttleMiddleware({ maxRequests: 1, windowMs: 60000, endpointKey: "endpoint1" });
		const middleware2 = throttleMiddleware({ maxRequests: 1, windowMs: 60000, endpointKey: "endpoint2" });

		it("should track requests separately per endpoint", () => {
			middleware1(mockReq as Request, mockRes as Response, mockNext);
			middleware2(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledTimes(2);
		});
	});

	describe("with different users", () => {
		it("should track requests separately per user", () => {
			const middleware = throttleMiddleware({ maxRequests: 1, windowMs: 60000, endpointKey: "test-diff-users" });

			middleware(mockReq as Request, mockRes as Response, mockNext);

			const mockRes2 = {
				locals: {
					user: {
						user_id: "user-456"
					}
				}
			} as any;
			middleware(mockReq as Request, mockRes2 as Response, mockNext);

			expect(mockNext).toHaveBeenCalledTimes(2);
		});
	});

	describe("error handling", () => {
		const middleware = throttleMiddleware();

		it("should throw error when user info is missing", () => {
			(mockRes as any).locals = {};

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow(ApiError);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should throw error when user_id is missing", () => {
			(mockRes as any).locals = {
				user: {} as any
			};

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow(ApiError);

			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});

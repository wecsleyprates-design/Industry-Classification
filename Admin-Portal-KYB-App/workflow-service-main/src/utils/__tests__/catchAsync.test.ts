import { catchAsync } from "../catchAsync";
import { type Request, type Response } from "express";

describe("catchAsync", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockReq = {};
		mockRes = {};
		mockNext = jest.fn();
	});

	describe("when async function succeeds", () => {
		it("should call the async function and not call next", async () => {
			const asyncFn = jest.fn().mockResolvedValue("success");
			const wrappedFn = catchAsync(asyncFn);

			await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should pass through the return value", async () => {
			const expectedResult = { data: "test result" };
			const asyncFn = jest.fn().mockResolvedValue(expectedResult);
			const wrappedFn = catchAsync(asyncFn);

			const result = await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(result).toBe(expectedResult);
		});

		it("should handle async function that returns undefined", async () => {
			const asyncFn = jest.fn().mockResolvedValue(undefined);
			const wrappedFn = catchAsync(asyncFn);

			const result = await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(result).toBeUndefined();
			expect(mockNext).not.toHaveBeenCalled();
		});
	});

	describe("when async function throws an error", () => {
		it("should catch the error and call next with the error", async () => {
			const error = new Error("Test error");
			const asyncFn = jest.fn().mockRejectedValue(error);
			const wrappedFn = catchAsync(asyncFn);

			await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
			expect(mockNext).toHaveBeenCalledWith(error);
		});

		it("should handle different types of errors", async () => {
			const errors = [
				new Error("Standard error"),
				new TypeError("Type error"),
				new ReferenceError("Reference error"),
				"String error",
				123,
				null,
				undefined
			];

			for (const error of errors) {
				// Reset mocks
				mockNext.mockClear();

				const asyncFn = jest.fn().mockRejectedValue(error);
				const wrappedFn = catchAsync(asyncFn);

				await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

				expect(mockNext).toHaveBeenCalledWith(error);
			}
		});

		it("should handle async function that throws synchronously", async () => {
			const error = new Error("Synchronous error");
			const asyncFn = jest.fn().mockImplementation(() => {
				throw error;
			});
			const wrappedFn = catchAsync(asyncFn);

			expect(() => {
				void wrappedFn(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("Synchronous error");
		});
	});

	describe("when async function returns a rejected promise", () => {
		it("should catch the rejection and call next with the error", async () => {
			const error = new Error("Promise rejection");
			const asyncFn = jest.fn().mockReturnValue(Promise.reject(error));
			const wrappedFn = catchAsync(asyncFn);

			await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});

	describe("function signature and types", () => {
		it("should return a function with correct signature", () => {
			const asyncFn = jest.fn().mockResolvedValue("test");

			const wrappedFn = catchAsync(asyncFn);

			expect(typeof wrappedFn).toBe("function");
			expect(wrappedFn.length).toBe(3); // (req, res, next)
		});

		it("should preserve the original function's behavior", async () => {
			const asyncFn = jest.fn().mockImplementation(async (_req, _res, _next) => {
				// Simulate some async work
				await new Promise(resolve => setTimeout(resolve, 10));
				return "async result";
			});
			const wrappedFn = catchAsync(asyncFn);

			const result = await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(result).toBe("async result");
			expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
		});
	});

	describe("edge cases", () => {
		it("should handle async function that never resolves", async () => {
			const asyncFn = jest.fn().mockReturnValue(new Promise(() => {})); // Never resolves
			const wrappedFn = catchAsync(asyncFn);

			const result = wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(result).toBeInstanceOf(Promise);
		});

		it("should handle async function that returns non-promise", async () => {
			const asyncFn = jest.fn().mockReturnValue("not a promise");
			const wrappedFn = catchAsync(asyncFn);

			const result = await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			expect(result).toBe("not a promise");
			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});

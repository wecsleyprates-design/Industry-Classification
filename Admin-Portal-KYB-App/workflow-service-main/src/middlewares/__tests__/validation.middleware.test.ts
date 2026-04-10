import { validateSchema } from "../validation.middleware";
import Joi from "joi";
import { type Request, type Response } from "express";

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

describe("Validation Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockReq = {
			body: {}
		};

		mockRes = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn()
		};

		mockNext = jest.fn();

		jest.clearAllMocks();
	});

	describe("validateSchema", () => {
		const validSchema = Joi.object({
			case_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().required()
		});

		it("should call next() when validation passes", () => {
			mockReq.body = {
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc"
			};

			const middleware = validateSchema(validSchema);

			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
			expect(mockRes.status).not.toHaveBeenCalled();
		});

		it("should throw ValidationMiddlewareError when validation fails", () => {
			mockReq.body = {
				case_id: "invalid-uuid",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc"
			};

			const middleware = validateSchema(validSchema);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("case_id must be a valid GUID");
		});

		it("should throw ValidationMiddlewareError for missing required fields", () => {
			mockReq.body = {
				case_id: "123e4567-e89b-12d3-a456-426614174000"
				// customer_id is missing
			};

			const middleware = validateSchema(validSchema);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("customer_id is required");
		});

		it("should throw ValidationMiddlewareError for empty body", () => {
			mockReq.body = {};

			const middleware = validateSchema(validSchema);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("case_id is required, customer_id is required");
		});

		it("should throw ValidationMiddlewareError for null body", () => {
			mockReq.body = null;

			const middleware = validateSchema(validSchema);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("value must be of type object");
		});

		it("should update req.body with validated and transformed data", () => {
			const schemaWithTransform = Joi.object({
				case_id: Joi.string().uuid().required(),
				customer_id: Joi.string().uuid().required(),
				status: Joi.string().valid("active", "inactive").default("active")
			});

			mockReq.body = {
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc"
			};

			const middleware = validateSchema(schemaWithTransform);

			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockReq.body).toEqual({
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc",
				status: "active"
			});
			expect(mockNext).toHaveBeenCalledWith();
		});

		it("should handle multiple validation errors", () => {
			mockReq.body = {
				case_id: "invalid-uuid",
				customer_id: "also-invalid-uuid"
			};

			const middleware = validateSchema(validSchema);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("case_id must be a valid GUID, customer_id must be a valid GUID");
		});

		it("should handle complex nested validation", () => {
			const complexSchema = Joi.object({
				case_id: Joi.string().uuid().required(),
				customer_id: Joi.string().uuid().required(),
				metadata: Joi.object({
					source: Joi.string().required(),
					priority: Joi.number().min(1).max(10).default(5)
				}).optional()
			});

			mockReq.body = {
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc",
				metadata: {
					source: "api",
					priority: 8
				}
			};

			const middleware = validateSchema(complexSchema);

			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith();
			expect(mockReq.body).toEqual({
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc",
				metadata: {
					source: "api",
					priority: 8
				}
			});
		});

		it("should handle validation with custom error messages", () => {
			const schemaWithCustomMessages = Joi.object({
				case_id: Joi.string().uuid().required().messages({
					"string.guid": "Case ID must be a valid UUID format",
					"any.required": "Case ID is mandatory"
				}),
				customer_id: Joi.string().uuid().required().messages({
					"string.guid": "Customer ID must be a valid UUID format",
					"any.required": "Customer ID is mandatory"
				})
			});

			mockReq.body = {
				case_id: "invalid-format",
				customer_id: "987fcdeb-51a2-43d1-b789-123456789abc"
			};

			const middleware = validateSchema(schemaWithCustomMessages);

			expect(() => {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}).toThrow("Case ID must be a valid UUID format");
		});
	});
});

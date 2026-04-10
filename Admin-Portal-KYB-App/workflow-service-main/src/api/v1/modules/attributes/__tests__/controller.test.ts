import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES } from "#constants";
import type { Request, Response, NextFunction } from "express";

// Mock the AttributeManager before importing the controller
const mockGetAttributeCatalog = jest.fn();

jest.mock("#core/attributes", () => ({
	AttributeManager: jest.fn().mockImplementation(() => ({
		getAttributeCatalog: mockGetAttributeCatalog
	}))
}));

const mockValidate = jest.fn();
jest.mock("#core/validators/GetAttributeCatalogRequestValidator", () => ({
	GetAttributeCatalogRequestValidator: jest.fn().mockImplementation(() => ({
		validate: mockValidate
	}))
}));

// Import controller after mock is set up
import { controller } from "../controller";
import { ATTRIBUTE_CATALOG_OPERATORS_FILTER as FILTER } from "#core/attributes/catalogOperators";

describe("Attributes Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: jest.MockedFunction<NextFunction>;

	beforeEach(() => {
		mockReq = {
			params: {
				customerId: "550e8400-e29b-41d4-a716-446655440000"
			},
			query: {},
			locals: {
				user: {
					customer_id: "550e8400-e29b-41d4-a716-446655440000"
				}
			}
		} as Partial<Request> as Request;

		mockRes = {
			jsend: {
				success: jest.fn(),
				fail: jest.fn(),
				error: jest.fn()
			},
			locals: {
				user: {
					customer_id: "550e8400-e29b-41d4-a716-446655440000"
				}
			}
		} as unknown as Response;

		mockNext = jest.fn();
		mockValidate.mockResolvedValue(undefined);
		jest.clearAllMocks();
	});

	describe("getAttributeCatalog", () => {
		it("should successfully retrieve attribute catalog without filters", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					}
				],
				kyc: [
					{
						context: "kyc",
						attribute: {
							name: "status",
							label: "Case Status"
						},
						operators: ["=", "!=", "IN", "NOT_IN"],
						dataType: "enum",
						validationRegex: null,
						description: "Current status of the case"
					}
				]
			};

			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockValidate).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", expect.any(Object));
			expect(mockGetAttributeCatalog).toHaveBeenCalledWith({}, "550e8400-e29b-41d4-a716-446655440000", FILTER.ALL);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCatalogResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should successfully retrieve attribute catalog filtered by source", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					}
				]
			};

			mockReq.query = { source: "facts" };
			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith(
				{
					source: "facts"
				},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.ALL
			);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCatalogResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should successfully retrieve attribute catalog filtered by context", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					},
					{
						context: "financial",
						attribute: {
							name: "annual_income",
							label: "Annual Income"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Annual income in USD"
					}
				]
			};

			mockReq.query = { context: "financial" };
			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith(
				{
					context: "financial"
				},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.ALL
			);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCatalogResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should successfully retrieve attribute catalog filtered by both source and context", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					}
				]
			};

			mockReq.query = { source: "facts", context: "financial" };
			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith(
				{
					source: "facts",
					context: "financial"
				},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.ALL
			);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCatalogResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should pass operator type comparison when query operators is comparison", async () => {
			mockReq.query = { operators: FILTER.COMPARISON };
			mockGetAttributeCatalog.mockResolvedValue({});

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith(
				{},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.COMPARISON
			);
		});

		it("should normalize invalid operators query to all", async () => {
			mockReq.query = { operators: "not-a-valid-value" };
			mockGetAttributeCatalog.mockResolvedValue({});

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith({}, "550e8400-e29b-41d4-a716-446655440000", FILTER.ALL);
		});

		it("should handle empty catalog response", async () => {
			const mockEmptyResponse = {};

			mockGetAttributeCatalog.mockResolvedValue(mockEmptyResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith({}, "550e8400-e29b-41d4-a716-446655440000", FILTER.ALL);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockEmptyResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should call next with error when AttributeManager.getAttributeCatalog throws", async () => {
			const error = new Error("Database connection failed");
			mockGetAttributeCatalog.mockRejectedValue(error);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
			expect(mockRes.jsend?.success).not.toHaveBeenCalled();
		});

		it("should handle catalog with multiple contexts and attributes", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					},
					{
						context: "financial",
						attribute: {
							name: "annual_income",
							label: "Annual Income"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Annual income in USD"
					}
				],
				kyc: [
					{
						context: "kyc",
						attribute: {
							name: "status",
							label: "Case Status"
						},
						operators: ["=", "!=", "IN", "NOT_IN"],
						dataType: "enum",
						validationRegex: null,
						description: "Current status of the case"
					},
					{
						context: "kyc",
						attribute: {
							name: "email",
							label: "Email Address"
						},
						operators: ["=", "!=", "CONTAINS", "NOT_CONTAINS", "IN"],
						dataType: "string",
						validationRegex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
						description: "Customer email address"
					}
				],
				kyb: [
					{
						context: "kyb",
						attribute: {
							name: "is_verified",
							label: "Is Verified"
						},
						operators: ["=", "!="],
						dataType: "boolean",
						validationRegex: null,
						description: "Whether the entity is verified"
					}
				]
			};

			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith({}, "550e8400-e29b-41d4-a716-446655440000", FILTER.ALL);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCatalogResponse,
				SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should not include undefined filters in the call", async () => {
			const mockCatalogResponse = {
				financial: [
					{
						context: "financial",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: [">=", "<=", "=", "!=", ">", "<"],
						dataType: "number",
						validationRegex: null,
						description: "Credit score from credit bureau"
					}
				]
			};

			mockReq.query = { source: undefined, context: undefined };
			mockGetAttributeCatalog.mockResolvedValue(mockCatalogResponse);

			await controller.getAttributeCatalog(mockReq as Request, mockRes as Response, mockNext);

			expect(mockGetAttributeCatalog).toHaveBeenCalledWith({}, "550e8400-e29b-41d4-a716-446655440000", FILTER.ALL);
			expect(mockRes.jsend?.success).toHaveBeenCalled();
		});
	});
});

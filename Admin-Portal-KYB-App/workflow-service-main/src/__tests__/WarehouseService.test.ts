import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { StatusCodes } from "http-status-codes";
import { WarehouseService } from "../services/warehouse/warehouseService";
import { ApiError } from "../types/errors";
import { ERROR_CODES } from "../constants";

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#configs", () => ({
	envConfig: {
		WAREHOUSE_SERVICE_URL: "http://localhost:8000",
		WAREHOUSE_HEALTH_PATH: "/api/health"
	}
}));

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Import mocked logger
import { logger as mockLogger } from "#helpers/logger";

describe("WarehouseService", () => {
	let warehouseService: WarehouseService;

	beforeEach(() => {
		jest.clearAllMocks();
		warehouseService = new WarehouseService();
	});

	describe("constructor", () => {
		it("should use default configuration when no config provided", () => {
			const service = new WarehouseService();
			expect(service).toBeInstanceOf(WarehouseService);
		});

		it("should use custom configuration when provided", () => {
			const customConfig = {
				baseURL: "http://custom-url:9000",
				healthPath: "/custom/health",
				timeout: 15000
			};
			const service = new WarehouseService(customConfig);
			expect(service).toBeInstanceOf(WarehouseService);
		});
	});

	describe("getFacts", () => {
		const businessId = "business-123";
		const factsRequired = ["credit_score", "annual_income", "employment_status"];

		it("should fetch facts successfully", async () => {
			const mockResponse = {
				data: [
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "credit_score",
						value: { name: "credit_score", value: 750, alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					},
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "annual_income",
						value: { name: "annual_income", value: 50000, alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					}
				]
			};

			mockedAxios.post.mockResolvedValue(mockResponse);

			const result = await warehouseService.getFacts(businessId, factsRequired);

			expect(result).toEqual({
				credit_score: 750,
				annual_income: 50000,
				employment_status: null
			});

			expect(mockedAxios.post).toHaveBeenCalledWith(
				`http://localhost:8000/facts/${businessId}`,
				{ facts_required: factsRequired },
				{
					timeout: 10000,
					headers: { "Content-Type": "application/json" }
				}
			);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				`Fetching facts for business ${businessId} from Warehouse Service`,
				{ factsRequired }
			);
		});

		it("should handle missing facts by setting them to null", async () => {
			const mockResponse = {
				data: [
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "credit_score",
						value: { name: "credit_score", value: 750, alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					}
				]
			};

			mockedAxios.post.mockResolvedValue(mockResponse);

			const result = await warehouseService.getFacts(businessId, factsRequired);

			expect(result).toEqual({
				credit_score: 750,
				annual_income: null,
				employment_status: null
			});
		});

		it("should handle server errors (5xx) by throwing ApiError", async () => {
			const serverError = new Error("Server Error") as AxiosError;
			serverError.response = {
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				statusText: "Internal Server Error",
				data: {},
				headers: {},
				config: {} as InternalAxiosRequestConfig
			};
			serverError.isAxiosError = true;

			// Mock axios.isAxiosError to return true for this error
			jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

			mockedAxios.post.mockRejectedValue(serverError);

			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(ApiError);
			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(
				"Warehouse Service error: 500 Internal Server Error"
			);

			// Verify that handleError was called (which logs with warn for server errors)
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Warehouse Service returned error status 500"),
				expect.any(Object)
			);

			// Restore the original function
			jest.restoreAllMocks();
		});

		it("should handle network errors by throwing ApiError", async () => {
			const networkError = new Error("Network Error") as AxiosError;
			networkError.isAxiosError = true;
			networkError.request = {}; // Simulate request was made but no response received

			mockedAxios.post.mockRejectedValue(networkError);

			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(ApiError);
			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(
				`Failed to fetch facts for business ${businessId}`
			);

			// Verify that handleError was called (which logs the error)
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.anything() }),
				expect.stringContaining("Warehouse Service request failed (no response received)")
			);
		});

		it("should handle non-axios errors", async () => {
			const nonAxiosError = new Error("Non-axios error");
			mockedAxios.post.mockRejectedValue(nonAxiosError);

			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(ApiError);
			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(
				`Failed to fetch facts for business ${businessId}`
			);
		});

		it("should log successful fetch", async () => {
			const mockResponse = {
				data: [
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "credit_score",
						value: { name: "credit_score", value: 750, alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					},
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "annual_income",
						value: { name: "annual_income", value: 50000, alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					},
					{
						collected_at: "2024-01-01T00:00:00Z",
						business_id: businessId,
						name: "employment_status",
						value: { name: "employment_status", value: "employed", alternatives: [], dependencies: [] },
						received_at: "2024-01-01T00:00:00Z",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					}
				]
			};

			mockedAxios.post.mockResolvedValue(mockResponse);

			await warehouseService.getFacts(businessId, factsRequired);

			expect(mockLogger.debug).toHaveBeenCalledWith(`Successfully fetched 3 facts for business ${businessId}`);
		});
	});

	describe("validateConnection", () => {
		it("should return true when service is healthy", async () => {
			const mockResponse = {
				status: StatusCodes.OK,
				data: { status: "healthy" }
			};

			mockedAxios.get.mockResolvedValue(mockResponse);

			const result = await warehouseService.validateConnection();

			expect(result).toBe(true);
			expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:8000/api/health", {
				timeout: 5000,
				headers: { "Content-Type": "application/json" }
			});
			expect(mockLogger.debug).toHaveBeenCalledWith("Validating Warehouse Service connection");
			expect(mockLogger.debug).toHaveBeenCalledWith("Warehouse Service health check: healthy");
		});

		it("should return false when service returns non-200 status", async () => {
			const mockResponse = {
				status: StatusCodes.SERVICE_UNAVAILABLE,
				data: { status: "unhealthy" }
			};

			mockedAxios.get.mockResolvedValue(mockResponse);

			const result = await warehouseService.validateConnection();

			expect(result).toBe(false);
			expect(mockLogger.debug).toHaveBeenCalledWith("Warehouse Service health check: unhealthy");
		});

		it("should return false when health check fails", async () => {
			const healthError = new Error("Connection failed");
			mockedAxios.get.mockRejectedValue(healthError);

			const result = await warehouseService.validateConnection();

			expect(result).toBe(false);
			expect(mockLogger.error).toHaveBeenCalledWith({ error: healthError }, "Warehouse Service health check failed");
		});

		it("should handle timeout errors", async () => {
			const timeoutError = new Error("timeout of 5000ms exceeded") as Error & { code: string };
			timeoutError.code = "ECONNABORTED";
			mockedAxios.get.mockRejectedValue(timeoutError);

			const result = await warehouseService.validateConnection();

			expect(result).toBe(false);
			expect(mockLogger.error).toHaveBeenCalledWith({ error: timeoutError }, "Warehouse Service health check failed");
		});
	});

	describe("parseError", () => {
		it("should parse axios error with response", () => {
			const axiosError = new Error("Request failed") as AxiosError;
			axiosError.response = {
				status: StatusCodes.BAD_REQUEST,
				statusText: "Bad Request",
				data: {},
				headers: {},
				config: {} as InternalAxiosRequestConfig
			};

			const result = (warehouseService as unknown as { parseError: (error: AxiosError) => unknown }).parseError(
				axiosError
			);

			expect(result).toEqual({
				status: StatusCodes.BAD_REQUEST,
				errorCode: ERROR_CODES.UNKNOWN_ERROR,
				message: "Request failed"
			});
		});

		it("should parse axios error without response", () => {
			const axiosError = new Error("Network error") as AxiosError;
			axiosError.isAxiosError = true;

			const result = (warehouseService as unknown as { parseError: (error: AxiosError) => unknown }).parseError(
				axiosError
			);

			expect(result).toEqual({
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				errorCode: ERROR_CODES.UNKNOWN_ERROR,
				message: "Network error"
			});
		});
	});
});

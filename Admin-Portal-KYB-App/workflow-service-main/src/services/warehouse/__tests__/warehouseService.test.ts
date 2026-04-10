import { WarehouseService } from "../warehouseService";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import axios from "axios";
import { logger } from "#helpers/logger";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

describe("WarehouseService", () => {
	let warehouseService: WarehouseService;

	beforeEach(() => {
		warehouseService = new WarehouseService();
		jest.clearAllMocks();
	});

	describe("getFacts", () => {
		const businessId = "business-123";
		const factsRequired = ["fact1", "fact2"];

		it("should successfully fetch facts for business", async () => {
			// Arrange
			const mockResponse = {
				data: [
					{
						name: "fact1",
						value: { value: "value1" }
					},
					{
						name: "fact2",
						value: { value: "value2" }
					}
				]
			};

			mockedAxios.post.mockResolvedValue(mockResponse as never);

			// Act
			const result = await warehouseService.getFacts(businessId, factsRequired);

			// Assert
			expect(result).toEqual({
				fact1: "value1",
				fact2: "value2"
			});
			expect(mockedAxios.post).toHaveBeenCalledWith(
				expect.stringContaining(`/facts/${businessId}`),
				{ facts_required: factsRequired },
				expect.objectContaining({
					timeout: expect.any(Number),
					headers: expect.objectContaining({
						"Content-Type": "application/json"
					})
				})
			);
			expect(logger.debug).toHaveBeenCalledWith(
				expect.stringContaining("Fetching facts for business"),
				expect.any(Object)
			);
		});

		it("should return null for facts not found in response", async () => {
			// Arrange
			const mockResponse = {
				data: [
					{
						name: "fact1",
						value: { value: "value1" }
					}
					// fact2 is missing
				]
			};

			mockedAxios.post.mockResolvedValue(mockResponse as never);

			// Act
			const result = await warehouseService.getFacts(businessId, factsRequired);

			// Assert
			expect(result).toEqual({
				fact1: "value1",
				fact2: null
			});
		});

		it("should throw ApiError for server errors (500+)", async () => {
			// Arrange
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error"
				},
				config: { url: "http://test.com/api", method: "post" },
				message: "Request failed",
				request: undefined
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.post.mockRejectedValue(error as never);

			// Act & Assert
			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(ApiError);
		});

		it("should throw ApiError for other errors", async () => {
			// Arrange
			const error = new Error("Network error");

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(false);
			mockedAxios.post.mockRejectedValue(error as never);

			// Act & Assert
			await expect(warehouseService.getFacts(businessId, factsRequired)).rejects.toThrow(ApiError);
		});
	});

	describe("validateConnection", () => {
		it("should return true when service is healthy", async () => {
			// Arrange
			const mockResponse = {
				status: StatusCodes.OK
			};

			mockedAxios.get.mockResolvedValue(mockResponse as never);

			// Act
			const result = await warehouseService.validateConnection();

			// Assert
			expect(result).toBe(true);
			expect(mockedAxios.get).toHaveBeenCalledWith(
				expect.stringContaining("/api/health"),
				expect.objectContaining({
					timeout: 5000
				})
			);
		});

		it("should return false when service is unhealthy", async () => {
			// Arrange
			const mockResponse = {
				status: StatusCodes.SERVICE_UNAVAILABLE
			};

			mockedAxios.get.mockResolvedValue(mockResponse as never);

			// Act
			const result = await warehouseService.validateConnection();

			// Assert
			expect(result).toBe(false);
		});

		it("should return false when health check fails", async () => {
			// Arrange
			const error = new Error("Connection failed");

			mockedAxios.get.mockRejectedValue(error as never);

			// Act
			const result = await warehouseService.validateConnection();

			// Assert
			expect(result).toBe(false);
			expect(logger.error).toHaveBeenCalledWith({ error }, "Warehouse Service health check failed");
		});
	});
});

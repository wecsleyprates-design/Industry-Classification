import { CaseService } from "../caseService";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("CaseService", () => {
	let caseService: CaseService;

	beforeEach(() => {
		caseService = new CaseService();
		jest.clearAllMocks();
	});

	describe("getCasesByBusinessId", () => {
		const businessId = uuidv4();

		it("should successfully fetch cases by business_id", async () => {
			// Arrange
			const mockCases = [
				{
					id: uuidv4(),
					business_id: businessId,
					customer_id: uuidv4(),
					case_type: 1,
					status: { id: 1, code: "INVITED", label: "INVITED" },
					created_at: new Date(),
					updated_at: new Date()
				}
			];

			const mockResponse = {
				data: {
					status: "success",
					message: "Success",
					data: {
						records: mockCases,
						total_pages: 1,
						total_items: 1
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await caseService.getCasesByBusinessId(businessId, 10, 0);

			// Assert
			expect(result).toEqual(mockCases);
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "get",
					url: expect.stringContaining(`/internal/businesses/${businessId}/cases`),
					params: { limit: 10, offset: 0 }
				})
			);
		});

		it("should return empty array when no cases found", async () => {
			// Arrange
			const mockResponse = {
				data: {
					status: "success",
					message: "Success",
					data: {
						records: [],
						total_pages: 0,
						total_items: 0
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await caseService.getCasesByBusinessId(businessId, 10, 0);

			// Assert
			expect(result).toEqual([]);
		});

		it("should handle NOT_FOUND error gracefully", async () => {
			// Arrange
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.NOT_FOUND,
					statusText: "Not Found"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act
			const result = await caseService.getCasesByBusinessId(businessId, 10, 0);

			// Assert
			expect(result).toEqual([]);
		});

		it("should throw ApiError for server errors", async () => {
			// Arrange
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(caseService.getCasesByBusinessId(businessId, 10, 0)).rejects.toThrow(ApiError);
		});

		it("should use custom limit and offset", async () => {
			// Arrange
			const mockResponse = {
				data: {
					status: "success",
					message: "Success",
					data: {
						records: [],
						total_pages: 0,
						total_items: 0
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			await caseService.getCasesByBusinessId(businessId, 5, 10);

			// Assert
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					params: { limit: 5, offset: 10 }
				})
			);
		});
	});

	describe("getCaseById", () => {
		const caseId = uuidv4();

		it("should successfully fetch case by id", async () => {
			// Arrange
			const mockCase = {
				id: caseId,
				business_id: uuidv4(),
				customer_id: uuidv4(),
				case_type: 1,
				status: { id: 1, code: "INVITED", label: "INVITED" },
				created_at: new Date(),
				updated_at: new Date()
			};

			const mockResponse = {
				data: {
					status: "success",
					data: mockCase
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await caseService.getCaseById(caseId);

			// Assert
			expect(result).toEqual(mockCase);
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "get",
					url: expect.stringContaining(`/internal/cases/${caseId}`)
				})
			);
		});

		it("should throw ApiError with NOT_FOUND when case not found", async () => {
			// Arrange
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.NOT_FOUND,
					statusText: "Not Found"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(caseService.getCaseById(caseId)).rejects.toThrow(ApiError);
			await expect(caseService.getCaseById(caseId)).rejects.toThrow(`Case ${caseId} not found`);
		});

		it("should throw ApiError for server errors (500+)", async () => {
			// Arrange
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(caseService.getCaseById(caseId)).rejects.toThrow(ApiError);
		});

		it("should throw ApiError for other errors", async () => {
			// Arrange
			const error = new Error("Network error");

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(false);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(caseService.getCaseById(caseId)).rejects.toThrow(ApiError);
			await expect(caseService.getCaseById(caseId)).rejects.toThrow(`Failed to fetch case ${caseId}`);
		});
	});

	describe("getCustomFieldsSummary", () => {
		const customerId = uuidv4();

		it("should successfully fetch custom fields summary", async () => {
			const mockCustomFields = [
				{
					field: "product_code",
					label: "Product Code",
					type: "text"
				},
				{
					field: "risk_level",
					label: "Risk Level",
					type: "dropdown"
				}
			];

			const mockResponse = {
				data: {
					status: "success",
					message: "Success",
					data: mockCustomFields
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			const result = await caseService.getCustomFieldsSummary(customerId);

			expect(result).toEqual(mockCustomFields);
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "get",
					url: expect.stringContaining(`/internal/customers/${customerId}/custom-fields/summary`)
				})
			);
		});

		it("should return empty array when no custom fields data", async () => {
			const mockResponse = {
				data: {
					status: "success",
					message: "Success",
					data: null
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			const result = await caseService.getCustomFieldsSummary(customerId);

			expect(result).toEqual([]);
		});

		it("should return empty array when data.data is missing", async () => {
			const mockResponse = {
				data: {
					status: "success",
					message: "Success"
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			const result = await caseService.getCustomFieldsSummary(customerId);

			expect(result).toEqual([]);
		});

		it("should throw ApiError with NOT_FOUND when custom fields not found", async () => {
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.NOT_FOUND,
					statusText: "Not Found"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow(ApiError);
			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow(
				`Custom fields not found for customer ${customerId}`
			);
		});

		it("should throw ApiError for server errors (500+)", async () => {
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error"
				}
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow(ApiError);
			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow("Case Service error");
		});

		it("should throw ApiError for other errors", async () => {
			const error = new Error("Network error");

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(false);
			mockedAxios.request.mockRejectedValue(error as never);

			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow(ApiError);
			await expect(caseService.getCustomFieldsSummary(customerId)).rejects.toThrow(
				`Failed to fetch custom fields for customer ${customerId}`
			);
		});
	});
});

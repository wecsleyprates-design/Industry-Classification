import { AuthService } from "../authService";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
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

describe("AuthService", () => {
	let authService: AuthService;

	beforeEach(() => {
		authService = new AuthService();
		jest.clearAllMocks();
	});

	describe("getCustomerNames", () => {
		it("should successfully fetch customer names", async () => {
			// Arrange
			const customerIds = ["customer-1", "customer-2"];
			const mockResponse = {
				data: {
					status: "success",
					data: {
						"customer-1": "John Doe",
						"customer-2": "Jane Smith"
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await authService.getCustomerNames(customerIds);

			// Assert
			expect(result).toEqual({
				"customer-1": "John Doe",
				"customer-2": "Jane Smith"
			});
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "post",
					url: expect.stringContaining("/internal/customers/names/batch"),
					data: customerIds
				})
			);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Fetching customer names"), expect.any(Object));
		});

		it("should return empty object when customerIds array is empty", async () => {
			// Act
			const result = await authService.getCustomerNames([]);

			// Assert
			expect(result).toEqual({});
			expect(mockedAxios.request).not.toHaveBeenCalled();
		});

		it("should return empty object when response data is missing", async () => {
			// Arrange
			const customerIds = ["customer-1"];
			const mockResponse = {
				data: {
					status: "success"
					// data is missing
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await authService.getCustomerNames(customerIds);

			// Assert
			expect(result).toEqual({});
		});

		it("should return empty object and log error when Axios error with response occurs", async () => {
			// Arrange
			const customerIds = ["customer-1"];
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					statusText: "Internal Server Error",
					data: { error: "Server error" }
				},
				config: { url: "http://test.com/api", method: "post" },
				message: "Request failed"
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act
			const result = await authService.getCustomerNames(customerIds);

			// Assert
			expect(result).toEqual({});
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Auth Service returned error status"),
				expect.any(Object)
			);
		});

		it("should return empty object and log error when network error occurs", async () => {
			// Arrange
			const customerIds = ["customer-1"];
			const error = {
				isAxiosError: true,
				request: {},
				config: { url: "http://test.com/api", method: "post" },
				message: "Network Error",
				code: "ECONNREFUSED"
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act
			const result = await authService.getCustomerNames(customerIds);

			// Assert
			expect(result).toEqual({});
			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.anything() }),
				expect.stringContaining("Auth Service request failed (no response received)")
			);
		});

		it("should return empty object and log error when non-Axios error occurs", async () => {
			// Arrange
			const customerIds = ["customer-1"];
			const error = new Error("Unexpected error");

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(false);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act
			const result = await authService.getCustomerNames(customerIds);

			// Assert
			expect(result).toEqual({});
			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.anything() }),
				expect.stringContaining("Unexpected error when calling Auth Service when fetching customer names")
			);
		});
	});

	describe("getSubroleCode", () => {
		it("should successfully fetch subrole code for a user", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const mockResponse = {
				data: {
					status: "success",
					data: {
						id: userId,
						email: "user@example.com",
						first_name: "John",
						last_name: "Doe",
						status: "ACTIVE",
						subrole: {
							id: "subrole-123",
							code: "owner",
							label: "Owner",
							role_id: 2
						}
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await authService.getSubroleCode(userId, roleId);

			// Assert
			expect(result).toBe("owner");
			expect(mockedAxios.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "get",
					url: expect.stringContaining(`/internal/users/${userId}`),
					params: { role: roleId }
				})
			);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Fetching subrole code"), expect.any(Object));
		});

		it("should throw error when subrole code is missing in response", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const mockResponse = {
				data: {
					status: "success",
					data: {
						id: userId,
						email: "user@example.com",
						first_name: "John",
						last_name: "Doe",
						status: "ACTIVE"
						// subrole is missing
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act & Assert
			await expect(authService.getSubroleCode(userId, roleId)).rejects.toThrow("Subrole code not found for user");
		});

		it("should throw error when response data is missing", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const mockResponse = {
				data: {
					status: "success"
					// data is missing
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act & Assert
			await expect(authService.getSubroleCode(userId, roleId)).rejects.toThrow("Subrole code not found for user");
		});

		it("should handle Axios error with response", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const error = {
				isAxiosError: true,
				response: {
					status: StatusCodes.NOT_FOUND,
					statusText: "Not Found",
					data: { error: "User not found" }
				},
				config: { url: "http://test.com/api", method: "get" },
				message: "Request failed"
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(authService.getSubroleCode(userId, roleId)).rejects.toEqual(error);
		});

		it("should handle network error", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const error = {
				isAxiosError: true,
				request: {},
				config: { url: "http://test.com/api", method: "get" },
				message: "Network Error",
				code: "ECONNREFUSED"
			};

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(true);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(authService.getSubroleCode(userId, roleId)).rejects.toEqual(error);
		});

		it("should handle non-Axios error", async () => {
			// Arrange
			const userId = "user-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const error = new Error("Unexpected error");

			(mockedAxios.isAxiosError as unknown) = jest.fn().mockReturnValue(false);
			mockedAxios.request.mockRejectedValue(error as never);

			// Act & Assert
			await expect(authService.getSubroleCode(userId, roleId)).rejects.toEqual(error);
		});

		it("should fetch different subrole codes correctly", async () => {
			// Arrange - Test CRO subrole
			const userId = "user-cro-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const mockResponse = {
				data: {
					status: "success",
					data: {
						id: userId,
						email: "cro@example.com",
						first_name: "CRO",
						last_name: "User",
						status: "ACTIVE",
						subrole: {
							id: "subrole-cro-123",
							code: "cro",
							label: "CRO",
							role_id: 2
						}
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await authService.getSubroleCode(userId, roleId);

			// Assert
			expect(result).toBe("cro");
		});

		it("should fetch RISK_ANALYST subrole code correctly", async () => {
			// Arrange
			const userId = "user-risk-123";
			const roleId = 2; // ROLE_ID.CUSTOMER
			const mockResponse = {
				data: {
					status: "success",
					data: {
						id: userId,
						email: "risk@example.com",
						first_name: "Risk",
						last_name: "Analyst",
						status: "ACTIVE",
						subrole: {
							id: "subrole-risk-123",
							code: "risk_analyst",
							label: "Risk Analyst",
							role_id: 2
						}
					}
				}
			};

			mockedAxios.request.mockResolvedValue(mockResponse as never);

			// Act
			const result = await authService.getSubroleCode(userId, roleId);

			// Assert
			expect(result).toBe("risk_analyst");
		});
	});
});

import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import { ERROR_CODES } from "#constants";
import { envConfig } from "#configs";
import { CaseData, CaseServiceResponse, CaseServiceConfig, CustomFieldsResponse } from "./types";
import { ApiError } from "#types/common";
import { BaseHttpService } from "#services/base";
import { CustomFieldsSummaryResponse } from "#types/workflow-dtos";

export class CaseService extends BaseHttpService {
	private apiPrefix: string;
	private healthPath: string;

	constructor(config?: Partial<CaseServiceConfig>) {
		const baseURL = config?.baseURL ?? envConfig.CASE_SERVICE_URL ?? "http://localhost:3001";
		const timeout = config?.timeout ?? 10000;
		super(baseURL, timeout);
		this.apiPrefix = config?.apiPrefix ?? envConfig.CASE_API_PREFIX ?? "/api/v1";
		this.healthPath = config?.healthPath ?? envConfig.CASE_HEALTH_PATH ?? "/health";
	}

	/**
	 * Fetches case data from the Case Service
	 * @param caseId - The ID of the case to fetch
	 * @returns The case data
	 */
	async getCaseById(caseId: string): Promise<CaseData> {
		try {
			const config = {
				method: "get",
				url: `${this.baseURL}${this.apiPrefix}/internal/cases/${caseId}`,
				params: {
					include_custom_fields: true
				},
				headers: {
					"Content-Type": "application/json"
				},
				timeout: this.timeout
			};

			const response = await axios.request<CaseServiceResponse>(config);
			return response.data.data ?? (response.data as unknown as CaseData);
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.response?.status === StatusCodes.NOT_FOUND) {
					logger.warn(`Case ${caseId} not found in Case Service`);
					throw new ApiError(`Case ${caseId} not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}
				if (error.response && error.response.status >= 500) {
					this.handleError(error, "Case Service", `case ${caseId}`);
					throw new ApiError(
						`Case Service error: ${error.response.status} ${error.response.statusText}`,
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.UNKNOWN_ERROR
					);
				}
			}

			this.handleError(error, "Case Service", `case ${caseId}`);
			throw new ApiError(
				`Failed to fetch case ${caseId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Fetches cases by business ID from the Case Service
	 * @param businessId - The business ID to fetch cases for
	 * @param limit - Maximum number of cases to return (default: 10)
	 * @param offset - Number of cases to skip (default: 0)
	 * @returns Array of case data
	 */
	async getCasesByBusinessId(businessId: string, limit: number = 10, offset: number = 0): Promise<CaseData[]> {
		try {
			logger.debug(`Fetching cases for business ${businessId} from Case Service`);

			const config = {
				method: "get",
				url: `${this.baseURL}${this.apiPrefix}/internal/businesses/${businessId}/cases`,
				headers: {
					"Content-Type": "application/json"
				},
				timeout: this.timeout,
				params: {
					limit,
					offset
				}
			};

			const response = await axios.request<{
				status: string;
				message: string;
				data: { records: CaseData[]; total_pages: number; total_items: number };
			}>(config);

			const caseData = response.data.data?.records || [];

			if (caseData && caseData.length > 0) {
				logger.debug(`Found ${caseData.length} cases for business ${businessId}`);
			} else {
				logger.warn(`No cases found for business ${businessId}`);
			}

			return caseData;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.response?.status === StatusCodes.NOT_FOUND) {
					logger.warn(`No cases found for business ${businessId}`);
					return [];
				}
				if (error.response && error.response.status >= 500) {
					this.handleError(error, "Case Service", `business ${businessId}`);
					throw new ApiError(
						`Case Service error: ${error.response.status} ${error.response.statusText}`,
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.UNKNOWN_ERROR
					);
				}
			}

			this.handleError(error, "Case Service", `business ${businessId}`);
			throw new ApiError(
				`Failed to fetch cases for business ${businessId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Retrieves a summary of custom fields for a given customer.
	 * @param customerId - The ID of the customer.
	 * @returns A promise that resolves to an array of CustomFieldDefinition.
	 * @throws ApiError if the request to the Case Service fails.
	 */
	async getCustomFieldsSummary(customerId: string): Promise<CustomFieldsSummaryResponse> {
		try {
			logger.debug(`Fetching custom fields summary for customer ${customerId} from Case Service`);

			const config = {
				method: "get",
				url: `${this.baseURL}${this.apiPrefix}/internal/customers/${customerId}/custom-fields/summary`,
				headers: {
					"Content-Type": "application/json"
				},
				timeout: this.timeout
			};

			const response = await axios.request<CustomFieldsResponse>(config);
			const customFields = response.data;

			if (!customFields?.data) {
				logger.warn(`No custom fields data for customer ${customerId}`);
				return [];
			}

			logger.debug(`Successfully fetched ${customFields.data.length} custom fields for customer ${customerId}`);
			return customFields.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.response?.status === StatusCodes.NOT_FOUND) {
					logger.warn(`Custom fields not found for customer ${customerId}`);
					throw new ApiError(
						`Custom fields not found for customer ${customerId}`,
						StatusCodes.NOT_FOUND,
						ERROR_CODES.NOT_FOUND
					);
				}
				if (error.response && error.response.status >= 500) {
					this.handleError(error, "Case Service", `custom fields for customer ${customerId}`);
					throw new ApiError(
						`Case Service error: ${error.response.status} ${error.response.statusText}`,
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.UNKNOWN_ERROR
					);
				}
			}

			this.handleError(error, "Case Service", `custom fields for customer ${customerId}`);
			throw new ApiError(
				`Failed to fetch custom fields for customer ${customerId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Validates connectivity to the Case Service
	 * @returns Promise<boolean>
	 */
	async validateConnection(): Promise<boolean> {
		try {
			logger.debug("Validating Case Service connection");

			const response = await axios.get(`${this.baseURL}${this.healthPath}`, {
				timeout: 5000,
				headers: {
					"Content-Type": "application/json"
				}
			});

			const isHealthy = response.status === StatusCodes.OK;
			logger.debug(`Case Service health check: ${isHealthy ? "healthy" : "unhealthy"}`);
			return isHealthy;
		} catch (error) {
			logger.error({ error }, "Case Service health check failed");
			return false;
		}
	}
}

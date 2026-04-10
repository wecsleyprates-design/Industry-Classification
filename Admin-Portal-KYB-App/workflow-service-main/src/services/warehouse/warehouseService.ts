import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import { ERROR_CODES } from "#constants";
import { envConfig } from "#configs";
import { ApiError } from "#types/errors";
import { WarehouseServiceConfig, WarehouseFactsData, WarehouseFactsRequest, WarehouseFactResponse } from "./types";
import { BaseHttpService } from "#services/base";

export class WarehouseService extends BaseHttpService {
	private healthPath: string;

	constructor(config?: Partial<WarehouseServiceConfig>) {
		const baseURL = config?.baseURL ?? envConfig.WAREHOUSE_SERVICE_URL ?? "http://localhost:8000";
		const timeout = config?.timeout ?? 10000;
		super(baseURL, timeout);
		this.healthPath = config?.healthPath ?? envConfig.WAREHOUSE_HEALTH_PATH ?? "/api/health";
	}

	/**
	 * Fetches facts from the Warehouse Service for a specific business
	 * @param businessId - The business ID to fetch facts for
	 * @param factsRequired
	 * @returns The facts data
	 */
	async getFacts(businessId: string, factsRequired: string[]): Promise<WarehouseFactsData> {
		try {
			logger.debug(`Fetching facts for business ${businessId} from Warehouse Service`, { factsRequired });

			const payload: WarehouseFactsRequest = {
				facts_required: factsRequired
			};

			const response = await axios.post<WarehouseFactResponse[]>(`${this.baseURL}/facts/${businessId}`, payload, {
				timeout: this.timeout,
				headers: {
					"Content-Type": "application/json"
				}
			});

			const factsData: WarehouseFactsData = {};

			factsRequired.forEach(factName => {
				factsData[factName] = null;
			});

			response.data.forEach(fact => {
				if (factsRequired.includes(fact.name)) {
					factsData[fact.name] = fact.value.value;
				}
			});

			logger.debug(`Successfully fetched ${Object.keys(factsData).length} facts for business ${businessId}`);
			return factsData;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.response && error.response.status >= 500) {
					this.handleError(error, "Warehouse Service", `business ${businessId}`);
					throw new ApiError(
						`Warehouse Service error: ${error.response.status} ${error.response.statusText}`,
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.UNKNOWN_ERROR
					);
				}
			}

			// Handle other errors
			this.handleError(error, "Warehouse Service", `business ${businessId}`);
			throw new ApiError(
				`Failed to fetch facts for business ${businessId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Validates connectivity to the Warehouse Service
	 * @returns Promise<boolean>
	 */
	async validateConnection(): Promise<boolean> {
		try {
			logger.debug("Validating Warehouse Service connection");

			const response = await axios.get(`${this.baseURL}${this.healthPath}`, {
				timeout: 5000,
				headers: {
					"Content-Type": "application/json"
				}
			});

			const isHealthy = response.status === StatusCodes.OK;
			logger.debug(`Warehouse Service health check: ${isHealthy ? "healthy" : "unhealthy"}`);
			return isHealthy;
		} catch (error) {
			logger.error({ error }, "Warehouse Service health check failed");
			return false;
		}
	}
}

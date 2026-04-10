import axios from "axios";
import { logger } from "#helpers/logger";
import { envConfig } from "#configs";
import { CustomerNamesResponse, AuthServiceBatchResponse, AuthServiceConfig, AuthServiceUserResponse } from "./types";
import { BaseHttpService } from "#services/base";

export class AuthService extends BaseHttpService {
	private apiPrefix: string;

	constructor(config?: Partial<AuthServiceConfig>) {
		const baseURL = config?.baseURL ?? envConfig.AUTH_BASE_URL ?? "http://localhost:3000";
		const timeout = config?.timeout ?? 10000;
		super(baseURL, timeout);
		this.apiPrefix = config?.apiPrefix ?? "/api/v1";
	}

	/**
	 * Fetches customer names in batch from the Auth Service
	 * @param customerIds - Array of customer UUIDs to fetch names for
	 * @returns Map of customer ID to customer name
	 */
	async getCustomerNames(customerIds: string[]): Promise<CustomerNamesResponse> {
		try {
			if (customerIds.length === 0) {
				return {};
			}

			logger.debug(`Fetching customer names for ${customerIds.length} customers from Auth Service`, {
				url: `${this.baseURL}${this.apiPrefix}/internal/customers/names/batch`,
				customerIds
			});

			const config = {
				method: "post",
				url: `${this.baseURL}${this.apiPrefix}/internal/customers/names/batch`,
				headers: {
					"Content-Type": "application/json"
				},
				data: customerIds,
				timeout: this.timeout
			};

			const response = await axios.request<AuthServiceBatchResponse>(config);
			const customerNames = response.data?.data ?? {};

			logger.debug(`Successfully fetched ${Object.keys(customerNames).length} customer names from Auth Service`);
			return customerNames;
		} catch (error) {
			// Use base class error handling with custom context message
			this.handleError(error, "Auth Service", "fetching customer names");
			return {};
		}
	}

	/**
	 * Fetches subrole code for a user from the Auth Service internal endpoint
	 * Uses the internal endpoint pattern following project conventions
	 * @param userId - UUID of the user
	 * @param roleId - Role ID (e.g., ROLE_ID.CUSTOMER, ROLE_ID.ADMIN)
	 * @returns Subrole code (e.g., "owner", "cro", "risk_analyst")
	 */
	async getSubroleCode(userId: string, roleId: number): Promise<string> {
		try {
			logger.debug(`Fetching subrole code for user ${userId} from Auth Service`, {
				url: `${this.baseURL}${this.apiPrefix}/internal/users/${userId}`,
				userId,
				roleId
			});

			const config = {
				method: "get",
				url: `${this.baseURL}${this.apiPrefix}/internal/users/${userId}`,
				headers: {
					"Content-Type": "application/json"
				},
				params: {
					role: roleId
				},
				timeout: this.timeout
			};

			const response = await axios.request<AuthServiceUserResponse>(config);

			if (!response.data?.data?.subrole?.code) {
				throw new Error(`Subrole code not found for user: ${userId}`);
			}

			const subroleCode = response.data.data.subrole.code;
			logger.debug(`Successfully fetched subrole code '${subroleCode}' from Auth Service`);
			return subroleCode;
		} catch (error) {
			// Use base class error handling with custom context message
			this.handleError(error, "Auth Service", "fetching subrole code");
			throw error;
		}
	}
}

import axios from "axios";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { logger } from "#helpers/index";
import { InternalApiError } from "#helpers/api";
import type { GetCasesByBusinessIdResponse, GetBusinessByIdResponse } from "./types";

/**
 * Structured client for case-service internal API calls.
 *
 * Replaces ad-hoc helper functions in helpers/api.ts with a proper
 * service-client following the three-layer architecture pattern.
 */
export class CaseServiceClient {
	private readonly baseUrl: string;

	constructor() {
		this.baseUrl = envConfig.CASE_BASE_URL ?? "";
	}

	/**
	 * Keeps case-service `data_businesses.name` and DBA rows aligned with KYB fact overrides
	 * (`legal_name`, `dba`). Best-effort: logs and swallows errors so fact persistence still succeeds.
	 */
	async patchBusinessDisplayProfile(
		businessId: UUID,
		body: { userId: UUID; name?: string; dba_names?: { name: string }[] }
	): Promise<void> {
		const url = `${this.baseUrl}/api/v1/internal/businesses/${businessId}/display-profile`;
		try {
			await axios.patch(url, body, {
				headers: { "Content-Type": "application/json" }
			});
		} catch (error) {
			logger.error({
				message: `CaseServiceClient: Failed to PATCH display profile for business ${businessId}`,
				error
			});
		}
	}

	/** Get cases for a business, most-recently-created first */
	async getCasesByBusinessId(businessId: UUID): Promise<GetCasesByBusinessIdResponse[]> {
		const url = `${this.baseUrl}/api/v1/internal/businesses/${businessId}/cases`;
		try {
			const response = await axios.get(url, {
				headers: { "Content-Type": "application/json" }
			});
			const { data } = response.data;
			return data.records as GetCasesByBusinessIdResponse[];
		} catch (error) {
			logger.error({
				message: `CaseServiceClient: Failed to get cases for business ${businessId}`,
				error
			});
			throw new InternalApiError(
				`Failed to get cases for business ${businessId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	async getBusinessById(businessId: UUID): Promise<GetBusinessByIdResponse> {
		const url = `${this.baseUrl}/api/v1/internal/businesses/${businessId}`;
		try {
			const response = await axios.get<GetBusinessByIdResponse>(url, {
				headers: { "Content-Type": "application/json" }
			});
			return response.data;
		} catch (error) {
			logger.error({
				message: `CaseServiceClient: Failed to get business ${businessId}`,
				error
			});
			throw new InternalApiError(
				`Failed to get business ${businessId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

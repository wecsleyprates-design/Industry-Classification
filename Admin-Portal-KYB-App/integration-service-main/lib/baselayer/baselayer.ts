import { envConfig } from "#configs/index";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { logger } from "#helpers/index";
import { VerificationApiError } from "../../src/api/v1/modules/verification/error";
import { ERROR_CODES } from "#constants/error-codes.constant";
import type { BaselayerCreateSearchRequest } from "./schema";

/** Normalized Baselayer environment label (e.g. `sandbox`, `production`). */
export function getBaselayerEnvironment(): string {
	return (envConfig.BASELAYER_ENVIRONMENT || "sandbox").trim().toLowerCase();
}

export function isBaselayerSandbox(): boolean {
	return getBaselayerEnvironment() === "sandbox";
}

function getBaselayerApiKey(): string | undefined {
	const env = getBaselayerEnvironment();
	return env === "sandbox" ? envConfig.BASELAYER_API_KEY_SANDBOX : envConfig.BASELAYER_API_KEY;
}

class BaselayerClient {
	async call<T>({
		method,
		url,
		data = null
	}: {
		method: AxiosRequestConfig["method"];
		url: string;
		data?: AxiosRequestConfig["data"];
	}): Promise<T> {
		const apiKey = getBaselayerApiKey();
		if (!apiKey) {
			throw new Error("Baselayer API key is not configured for the current BASELAYER_ENVIRONMENT");
		}
		try {
			const config: AxiosRequestConfig = {
				method,
				url,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					"X-API-Key": apiKey
				}
			};
			if (data != null) {
				config.data = data;
			}
			const response = await axios.request<T>(config);
			return response.data;
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				logger.error({ error: error.response?.data ?? error.message }, "Baselayer API call failed");
				const typed = error as AxiosError<{ message?: string; detail?: string }>;
				const msg =
					typed.response?.data?.message ||
					typed.response?.data?.detail ||
					typed.message ||
					"Baselayer request failed";
				throw new VerificationApiError(msg, typed.response?.status ?? 500, ERROR_CODES.INVALID);
			}
			throw error;
		}
	}

	async createSearch(payload: BaselayerCreateSearchRequest): Promise<Record<string, unknown>> {
		const base = (envConfig.BASELAYER_BASE_URL || "https://api.baselayer.com").replace(/\/$/, "");
		return await this.call<Record<string, unknown>>({
			method: "post",
			url: `${base}/searches`,
			data: payload
		});
	}

	async getSearch(searchId: string): Promise<Record<string, unknown>> {
		const base = (envConfig.BASELAYER_BASE_URL || "https://api.baselayer.com").replace(/\/$/, "");
		return await this.call<Record<string, unknown>>({
			method: "get",
			url: `${base}/searches/${searchId}`
		});
	}

	async getBusiness(businessId: string): Promise<Record<string, unknown>> {
		const base = (envConfig.BASELAYER_BASE_URL || "https://api.baselayer.com").replace(/\/$/, "");
		return await this.call<Record<string, unknown>>({
			method: "get",
			url: `${base}/businesses/${businessId}`
		});
	}
}

export const baselayer = new BaselayerClient();

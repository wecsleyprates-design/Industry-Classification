import type {
	AxiosError,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from "axios";
import { MICROSERVICE, URL } from "../constants";
import { extractCaseIdFromUrl, extractSubroleIdFromUrl } from "./helper";
import { getItem } from "./localStorage";

import { envConfig } from "@/config/envConfig";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

export interface ConsoleError {
	status: number;
	data: unknown;
}

export const requestInterceptor = (
	config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
	const token = getItem<string>("token");
	if (token) {
		config.headers.set("Authorization", `Bearer ${token}`);
	}
	config.withCredentials = false;
	return config;
};

export const cookieRequestInterceptor = (
	config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
	const token = getItem<string>("token");
	if (token) {
		config.headers.set("Authorization", `Bearer ${token}`);
	}
	config.withCredentials = true;
	return config;
};

export const successInterceptor = (response: AxiosResponse): AxiosResponse => {
	return response;
};

export const errorInterceptor = async (
	error: AxiosError,
): Promise<AxiosError | ConsoleError | never> => {
	// 401 is handled by createAuthRefresh (see authRefresh.ts + api.ts)
	if (error.response?.status === 403) {
		const caseId = extractCaseIdFromUrl(window.location.pathname) ?? "";
		const subroleId = extractSubroleIdFromUrl(window.location.pathname) ?? "";
		const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
		const applicantId: string = getItem(LOCALSTORAGE.userId) ?? "";

		const normalizeUrl = (url: string) => url.replaceAll("//", "/");

		const allowedUrls = [
			`${
				String(envConfig.VITE_API_ENDPOINT) + MICROSERVICE.CASE
			}/customers/${customerId}/businesses/invite`,
			`${
				String(envConfig.VITE_API_ENDPOINT) + MICROSERVICE.CASE
			}/businesses/customers/${customerId}/bulk/process/${applicantId}`,
			`${
				String(envConfig.VITE_API_ENDPOINT) + MICROSERVICE.CASE
			}/customers/${customerId}/cases/${caseId}/application-edit/invite`,
			`${
				String(envConfig.VITE_API_ENDPOINT) + MICROSERVICE.AUTH
			}/permissions/customers/${customerId}/subroles/${subroleId}`,
			`${
				String(envConfig.VITE_API_ENDPOINT) + MICROSERVICE.INTEGRATION
			}/payment-processors/${customerId}/processors`,
		].map(normalizeUrl);

		const currentUrl = normalizeUrl(
			error?.response?.request?.responseURL || "",
		);

		if (!allowedUrls.includes(currentUrl)) {
			window.location.href = `${window.location.origin}${URL.AUTH_ERROR}`;
		}
	} else {
		if (error.response) {
			const errorMessage: ConsoleError = {
				status: error.response.status,
				data: error.response.data,
			};
			console.error(errorMessage);
		} else if (error.request) {
			console.error(error.request);
		} else {
			console.error("Error", error.message);
		}
	}
	return await Promise.reject(error);
};

import type {
	AxiosError,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from "axios";
import { getItem } from "./localStorage";

import { URL } from "@/constants";

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

// 401 is handled by createAuthRefresh (see authRefresh.ts + api.ts)
export const errorInterceptor = async (
	error: AxiosError,
): Promise<AxiosError | ConsoleError> => {
	if (error.response?.status === 403) {
		window.location.href = `${window.location.origin}${URL.AUTH_ERROR}`;
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

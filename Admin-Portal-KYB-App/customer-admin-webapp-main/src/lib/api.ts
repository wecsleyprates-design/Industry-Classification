import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { connectAppAuth } from "./appAuth";
import {
	cookieRequestInterceptor,
	errorInterceptor,
	requestInterceptor,
	successInterceptor,
} from "./interceptors";

import { envConfig } from "@/config/envConfig";

const axiosRequestConfig: AxiosRequestConfig = {
	baseURL: envConfig.VITE_API_ENDPOINT,
	responseType: "json",
	headers: {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": origin,
	},
};

const api: AxiosInstance = axios.create(axiosRequestConfig);
const cookiesApi: AxiosInstance = axios.create(axiosRequestConfig);

// Register auth-refresh (401) first so it runs before the app's errorInterceptor and we get a single refresh + queue
const { scheduleProactiveRefresh, clearProactiveRefresh } = connectAppAuth(
	api,
	cookiesApi,
);

api.interceptors.request.use(requestInterceptor);
api.interceptors.response.use(successInterceptor, errorInterceptor);

cookiesApi.interceptors.request.use(cookieRequestInterceptor);
cookiesApi.interceptors.response.use(successInterceptor, errorInterceptor);

export { api, cookiesApi, scheduleProactiveRefresh, clearProactiveRefresh };

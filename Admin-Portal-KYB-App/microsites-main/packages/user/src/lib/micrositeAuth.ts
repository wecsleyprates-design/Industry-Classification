import { toast } from "react-toastify";
import {
	getMicrositeAuthCookiesApi,
	wireMicrositeAuthRefresh,
} from "@joinworth/worth-core-utils";
import type { AxiosInstance } from "axios";
import useAuthStore from "@/store/useAuthStore";
import type { Permission } from "@/types/common";
import { getAllPermissions } from "./helper";
import { getItem } from "./localStorage";

import { URL } from "@/constants";
import MICROSERVICE from "@/constants/Microservices";
import { MODULES } from "@/constants/Modules";

function onRefreshTokenFailedToast(message: string): void {
	toast.error(message, { autoClose: 2000 });
}

export function connectMicrositeAuth(
	api: AxiosInstance,
	cookiesApi: AxiosInstance,
) {
	return wireMicrositeAuthRefresh(api, cookiesApi, {
		refreshToken: async () => {
			const { data } = await getMicrositeAuthCookiesApi().post(
				`${MICROSERVICE.AUTH}/refresh-token/customer`,
			);
			return data;
		},
		loginPath: URL.LOGIN,
		moduleCodes: Object.values(MODULES),
		getAllPermissions: (permissions: unknown, moduleCodes: string[]) =>
			getAllPermissions(permissions as Permission[], moduleCodes),
		clearAuthState: () => useAuthStore.getState().clearIsAuthenticated(),
		onRefreshTokenFailed: onRefreshTokenFailedToast,
		getToken: () => getItem<string>("token"),
	});
}

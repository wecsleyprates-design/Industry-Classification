import { toast } from "react-toastify";
import { wireMicrositeAuthRefresh } from "@joinworth/worth-core-utils";
import type { AxiosInstance } from "axios";
import useAuthStore from "@/store/useAuthStore";
import type { IPermission } from "@/types/auth";
import { URL } from "../constants";
import { getAllPermissions } from "./helper";
import { getItem } from "./localStorage";

import MICROSERVICE from "@/constants/Microservices";
import { MODULES } from "@/constants/Modules";

export function connectAppAuth(api: AxiosInstance, cookiesApi: AxiosInstance) {
	return wireMicrositeAuthRefresh(api, cookiesApi, {
		refreshToken: async () => {
			const response = await cookiesApi.post(
				`${MICROSERVICE.AUTH}/refresh-token/customer`,
			);
			return response.data;
		},
		loginPath: URL.LOGIN,
		moduleCodes: Object.values(MODULES),
		getAllPermissions: (permissions: unknown, moduleCodes: string[]) =>
			getAllPermissions(permissions as IPermission[], moduleCodes),
		clearAuthState: () => useAuthStore.getState().clearIsAuthenticated(),
		onRefreshTokenFailed: (msg: string) =>
			toast.error(msg, { autoClose: 2000 }),
		getToken: () => getItem<string>("token"),
	});
}

import { toast } from "react-toastify";
import { wireMicrositeAuthRefresh } from "@joinworth/worth-core-utils";
import type { AxiosInstance } from "axios";
import {
	refreshTokenAdmin,
	refreshTokenCustomer,
} from "@/services/api/auth.service";
import useAuthStore from "@/store/useAuthStore";
import { getAllPermissions } from "./helper";

import { URL } from "@/constants";
import { MODULES } from "@/constants/Modules";
import REGEX from "@/constants/Regex";

export function connectMicrositeAuth(
	api: AxiosInstance,
	cookiesApi: AxiosInstance,
) {
	return wireMicrositeAuthRefresh(api, cookiesApi, {
		refreshToken: async () =>
			REGEX.ADMIN_URL_REGEX.test(window.location.origin)
				? refreshTokenAdmin()
				: refreshTokenCustomer(),
		loginPath: URL.LOGIN,
		moduleCodes: Object.values(MODULES),
		getAllPermissions,
		clearAuthState: () => useAuthStore.getState().clearIsAuthenticated(),
		onRefreshTokenFailed: (msg: string) =>
			toast.error(msg, { autoClose: 2000 }),
	});
}

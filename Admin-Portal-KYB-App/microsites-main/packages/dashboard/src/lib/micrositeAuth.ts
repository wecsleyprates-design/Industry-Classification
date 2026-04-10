import { toast } from "react-toastify";
import { wireMicrositeAuthRefresh } from "@joinworth/worth-core-utils";
import type { AxiosInstance } from "axios";
import { refreshToken as refreshTokenApi } from "@/services/api/auth.service";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../constants";
import { getAllPermissions } from "./helper";

import { MODULES } from "@/constants/Modules";

export function connectMicrositeAuth(
	api: AxiosInstance,
	cookiesApi: AxiosInstance,
) {
	return wireMicrositeAuthRefresh(api, cookiesApi, {
		refreshToken: () => refreshTokenApi(),
		loginPath: URL.LOGIN,
		moduleCodes: Object.values(MODULES),
		getAllPermissions,
		clearAuthState: () => useAuthStore.getState().clearIsAuthenticated(),
		onRefreshTokenFailed: (msg: string) =>
			toast.error(msg, { autoClose: 2000 }),
	});
}

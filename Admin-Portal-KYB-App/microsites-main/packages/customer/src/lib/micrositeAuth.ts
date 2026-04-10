import { toast } from "react-toastify";
import { wireMicrositeAuthRefresh } from "@joinworth/worth-core-utils";
import type { AxiosInstance } from "axios";
import { postRefreshTokenCustomer } from "@/services/api/auth.service";
import useAuthStore from "@/store/useAuthStore";
import { type IPermission } from "@/types/auth";
import { getAllPermissions as mapPermissions } from "./helper";

import { URL } from "@/constants";
import { MODULES } from "@/constants/Modules";

/** Worth Admin customer microsite — refresh uses admin endpoint via postRefreshTokenCustomer. */
export function connectMicrositeAuth(
	api: AxiosInstance,
	cookiesApi: AxiosInstance,
) {
	return wireMicrositeAuthRefresh(api, cookiesApi, {
		refreshToken: () => postRefreshTokenCustomer(),
		loginPath: URL.LOGIN,
		moduleCodes: Object.values(MODULES),
		getAllPermissions: (permissions: unknown, moduleCodes: string[]) =>
			mapPermissions(permissions as IPermission[], moduleCodes),
		clearAuthState: () => useAuthStore.getState().clearIsAuthenticated(),
		onRefreshTokenFailed: (msg: string) =>
			toast.error(msg, { autoClose: 2000 }),
	});
}

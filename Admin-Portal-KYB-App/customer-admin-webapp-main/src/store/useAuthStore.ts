import { create } from "zustand";
import { clearLocalStorage, getItem, setItem } from "@/lib/localStorage";
import { type IAuthStore, type TAllPermissions } from "@/types/common";
import { logger } from "./logger";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface AuthState {
	isAuthenticated: boolean;
	loginData: IAuthStore | undefined;
	permissions: Partial<TAllPermissions>;
}

export interface AuthStore extends AuthState {
	setIsAuthenticated: (data: IAuthStore) => void;
	clearIsAuthenticated: () => void;
}

const initialState: Pick<AuthStore, keyof AuthState> = {
	isAuthenticated: getItem("token") ?? false,
	loginData: undefined,
	permissions: (getItem("permissions") as Partial<TAllPermissions>) ?? {},
};

const useAuthStore = create<AuthStore>()(
	logger<AuthStore>(
		(set) => ({
			...initialState,
			setIsAuthenticated: (data) => {
				set((state) => {
					// Keep the existing localStorage setters for backwards compatibility
					setItem("token", data.id_token);
					setItem("access_token", data.access_token);
					setItem(LOCALSTORAGE.customerId, data.customer_details?.id);
					setItem(LOCALSTORAGE.customerName, data.customer_details?.name);
					setItem(
						LOCALSTORAGE.customerType,
						data.customer_details?.customer_type,
					);
					setItem("userId", data.user_details?.id);
					setItem("userDetails", data.user_details ?? "");
					setItem("permissions", data.permissions ?? "");
					setItem("allPermissions", data.all_permissions ?? "");
					setItem("subrole", data.subrole ?? "");
					return {
						...state,
						isAuthenticated: true,
						permissions: data.permissions,
						loginData: data,
					};
				});
			},
			clearIsAuthenticated: () => {
				set((state) => {
					clearLocalStorage();
					return {
						...state,
						isAuthenticated: false,
						permissions: {},
						loginData: undefined,
					};
				});
			},
		}),
		"authStore",
	),
);

export default useAuthStore;

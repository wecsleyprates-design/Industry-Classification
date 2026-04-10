import { create } from "zustand";
import { clearLocalStorage, getItem, setItem } from "@/lib/localStorage";
import { type AllPermissions, type IAuthStore } from "@/types/common";
import { logger } from "./logger";

interface AuthState {
	isAuthenticated: boolean;
	permissions: Partial<AllPermissions>;
	customerId: string | null;
}

export interface AuthStore extends AuthState {
	setIsAuthenticated: (data: IAuthStore) => void;
	clearIsAuthenticated: () => void;
}

const initialState: Pick<AuthStore, keyof AuthState> = {
	isAuthenticated: true,
	permissions: (getItem("permissions") as Partial<AllPermissions>) ?? {},
	customerId: getItem<string>("customerId"),
};

const useAuthStore = create<AuthStore>()(
	logger<AuthStore>(
		(set) => ({
			...initialState,
			setIsAuthenticated: (data) => {
				set((state) => {
					setItem("token", data.id_token);
					setItem("access_token", data.access_token);
					setItem("customerId", data.customer_details?.id);
					setItem("customerName", data.customer_details?.name);
					setItem("userId", data.user_details?.id);
					setItem("userDetails", data.user_details ?? "");
					setItem("permissions", data.permissions ?? "");
					return {
						...state,
						isAuthenticated: true,
						permissions: data.permissions,
						customerId: data.customer_details?.id ?? null,
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
						customerId: null,
					};
				});
			},
		}),
		"authStore",
	),
);

export default useAuthStore;

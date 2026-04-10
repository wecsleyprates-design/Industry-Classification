import { create } from "zustand";
import { clearLocalStorage, getItem, setItem } from "@/lib/localStorage";
import { logger } from "./logger";

interface AuthState {
	isAuthenticated: boolean;
	loginData: any;
	permissions: any;
}

export interface AuthStore extends AuthState {
	setIsAuthenticated: (data: any) => void;
	clearIsAuthenticated: () => void;
}

const initialState: Pick<AuthStore, keyof AuthState> = {
	isAuthenticated: getItem("token") ?? false,
	loginData: undefined,
	permissions: (getItem("permissions") as Partial<any>) ?? {},
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
					setItem("userId", data.user_details?.id);
					setItem("userDetails", data.user_details ?? "");
					setItem("permissions", data.permissions ?? "");
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

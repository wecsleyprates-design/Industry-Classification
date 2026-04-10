import { create } from "zustand";
import { clearLocalStorage } from "@/lib/localStorage";
import { logger } from "./logger";

interface AuthState {
	isAuthenticated: boolean;
}

export interface AuthStore extends AuthState {
	setIsAuthenticated: (args: AuthState["isAuthenticated"]) => void;
	clearIsAuthenticated: () => void;
}

const initialState: Pick<AuthStore, keyof AuthState> = {
	isAuthenticated: true,
};

const useAuthStore = create<AuthStore>()(
	logger<AuthStore>(
		(set) => ({
			...initialState,
			setIsAuthenticated: (data) => {
				set((state) => {
					return {
						...state,
						isAuthenticated: true,
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

/**
 * Global application context store with localStorage persistence
 * Manages platform type, module type, and user identifiers
 * platformType: is either "customer" or "admin" for identifying if customer admin or worth admin
 * moduleType: is either "customer_case", "business_case" or "standalone_case" for identifying the different modules
 * customerId: stores the customer ID for customer_case module since it can be present from url or localStorage
 * businessId: stores the business ID for business_case module, null for others
 *
 * Usage:
 * - Access state: const { platformType, moduleType } = useAppContextStore();
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants";

export type PlatformType = "customer" | "admin";
export type ModuleType = "customer_case" | "business_case" | "standalone_case";

interface AppState {
	platformType: PlatformType;
	moduleType: ModuleType;
	customerId: string;
	businessId: string | null;

	setPlatformType: (platform: PlatformType) => void;
	setModuleType: (module: ModuleType) => void;
	setCustomerId: (customerId: string) => void;
	setBusinessId: (businessId: string | null) => void;
}

export const useAppContextStore = create<AppState>()(
	persist(
		(set) => ({
			platformType: "customer",
			moduleType: "customer_case",
			customerId: getItem(LOCALSTORAGE.customerId) ?? "",
			businessId: null,

			setPlatformType: (platform) => {
				set({ platformType: platform });
			},
			setModuleType: (module) => {
				set({ moduleType: module });
			},
			setCustomerId(customerId) {
				set({ customerId });
			},
			setBusinessId(businessId) {
				set({ businessId });
			},
		}),
		{
			name: "app-context-store", // localStorage key
		},
	),
);

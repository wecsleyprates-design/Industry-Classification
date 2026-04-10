import { type DateType } from "@/components/Filter/types";
import { type ILoginResponseUserDetails } from "./auth";

export type TOption = {
	label: string;
	value: string | Record<string, unknown>;
	disabled?: boolean;
	subLabel?: string;
};

export interface IPayload {
	page?: number;
	items_per_page?: number;
	pagination?: boolean;
	sort?: Record<string, unknown>;
	search?: Record<string, unknown>;
	filter?: Record<string, unknown>;
	filter_date?: Record<string, unknown>;
}

export interface GetAllBusinessesPayload {
	customerId: string;
	params?: IPayload;
}

// {
// 	read?: boolean;
// 	write?: boolean;
// 	create?: boolean;
// };

export type TPermissionResponse = Record<TAccessType, boolean>;

export type TCodeModule =
	| "customer_user"
	| "case"
	| "report"
	| "archived"
	| "profile"
	| "brand_settings"
	| "businesses"
	| "cro_dashboard"
	| "onboarding_module"
	| "white_labeling"
	| "risk_monitoring_module"
	| "email_notifications"
	| "roles";
export type TAccessType = "create" | "read" | "write";

export type TAllPermissions = Record<
	Partial<TCodeModule>,
	Partial<TPermissionResponse>
>;

export type SnakeDateType = { start_date: DateType; end_date: DateType };

export interface IAuthStore {
	access_token: string;
	id_token: string;
	refresh_token: string;
	user_details: ILoginResponseUserDetails;
	customer_details: {
		id: string;
		name: string;
		customer_type: string;
	};
	subrole: {
		code: string;
		id: string;
		label: string;
	};
	all_permissions: string[];
	permissions: Partial<TAllPermissions>;
}

export type TModulesName =
	| "all"
	| "attention"
	| "archived"
	| "businesses"
	| "archivedBusinessCases"
	| "onboardingattention";
export interface TabsInterface {
	id: number;
	name: string;
	moduleName: TModulesName;
}

export type ValueOf<T> = T[keyof T];

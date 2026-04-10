import { type TAccessType, type TCodeModule } from "@/constants/Modules";

export type DateType = string | null | Date;

export interface ILoginResponseUserDetails {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_email_verified: boolean;
}

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
	case_id?: string;
	suppress_pagination_error?: boolean;
}

export interface GetAllBusinessesPayload {
	customerId: string;
	params?: IPayload;
}

export type TPermissionResponse = Record<TAccessType, boolean>;

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
	};
	subrole: {
		code: string;
		id: string;
		label: string;
	};
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

export interface APIResponse<T = any> {
	status: string;
	message: string;
	data: T;
}

export type PaginatedAPIResponse<T> = APIResponse<{
	records: T[];
	total_pages: number;
	total_items: number;
}>;

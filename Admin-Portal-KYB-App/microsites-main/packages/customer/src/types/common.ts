export interface IPayload {
	page?: number;
	items_per_page?: number;
	pagination?: boolean;
	sort?: Record<string, unknown>;
	search?: Record<string, unknown>;
	filter?: Record<string, unknown>;
	filter_date?: Record<string, unknown>;
}

export type TPermissionResponse = Record<TAccessType, boolean>;

export type TCodeModule =
	| "customer_user"
	| "case"
	| "report"
	| "user"
	| "customer"
	| "profile"
	| "brand_settings"
	| "businesses"
	| "tenants";
export type TAccessType = "create" | "read" | "write";

export type TAllPermissions = Record<
	Partial<TCodeModule>,
	Partial<TPermissionResponse>
>;

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

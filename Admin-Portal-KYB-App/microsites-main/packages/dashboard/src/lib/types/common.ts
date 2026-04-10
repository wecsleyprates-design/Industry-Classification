export type TOption = {
	label: string;
	value: string | Record<string, unknown>;
	disabled?: boolean;
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

export interface ILoginResponseUserDetails {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_email_verified: boolean;
}

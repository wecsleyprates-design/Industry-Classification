export interface User {
	id: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile?: string;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	updated_at: string;
	status: string; // USER_STATUS values
	subrole: {
		id: string;
		code: string;
		display_name: string;
		label: string;
		description: string;
	};
	company_details?: {
		name: string;
	};
}

export interface UserInfo {
	first_name: string;
	last_name: string;
	email: string;
	phone_number: string;
	role: any;
	user_id: string | null;
}

export type ManageUserFormData = {
	first_name?: string;
	last_name?: string;
	email?: string;
	phone_number?: string | null;
	role?: {
		id?: string | undefined;
		label?: string | undefined;
		value?: string | undefined;
		description?: string | undefined;
	} | null;
	user_id?: string | null;
	status?: "ACTIVE" | "INACTIVE";
	customer?: string;
};

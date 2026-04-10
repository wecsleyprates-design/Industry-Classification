export interface ILoginResponseUserDetails {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_email_verified: boolean;
}

export interface IPermission {
	id: number;
	code: string;
	label: string;
}
export interface ILoginResponse {
	status: string;
	message: string;
	data: {
		access_token: string;
		id_token: string;
		refresh_token: string;
		user_details: ILoginResponseUserDetails;
		permissions: IPermission[];
	};
}

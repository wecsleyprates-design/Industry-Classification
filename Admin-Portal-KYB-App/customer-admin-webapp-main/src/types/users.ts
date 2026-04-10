import { type Maybe } from "yup";

export interface IUserForm {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: Maybe<string | undefined>;
	subrole: any;
}

export interface IUserFormBoolean {
	firstName?: boolean | undefined;
	lastName?: boolean | undefined;
	email?: boolean | undefined;
	mobile?: boolean | undefined;
	subrole?: boolean | undefined;
}

interface UserRequestBody {
	first_name?: string;
	last_name?: string;
	email?: string;
	mobile?: string;
	status?: string;
	subrole?: string | Record<string, any>;
}

export interface CreateUserRequest {
	customerId: string;
	body: UserRequestBody;
}

export interface IGetUsersRequest {
	customerId: string;
	params: string;
	// userId: string;
}

export interface IUpdateUserRequest {
	customerId: string;
	userId: string;
	body: UserRequestBody;
}

export interface ICustomerApiResponse {
	status: string;
	message: string;
	data: any;
}

export interface IGetCustomerUsersApiResponse {
	status: string;
	message: string;
	data: GetCustomerUserData;
}

export interface UserData {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile?: string;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	is_tc_accepted: boolean;
	tc_accepted_at?: string;
	ext_auth_ref_id: string;
	status: "INVITE_EXPIRED" | "ACTIVE" | "INACTIVE" | "INVITED";
	subrole: {
		id: string;
		code: string;
		display_name: string;
		label: string;
		description: string;
	};
}
export interface GetCustomerUserData {
	records: UserData[]; // Array<Record<string, unknown>>,
	total_pages: number;
	total_items: number;
}
export interface IResendUserInvite {
	customerId: string;
	userId: string;
}

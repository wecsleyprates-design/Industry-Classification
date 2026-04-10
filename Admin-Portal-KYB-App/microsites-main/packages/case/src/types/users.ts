export interface IUserForm {
	firstName: string;
	lastName: string;
	email: string;
	mobile?: string | null;
	subrole: any;
}

export interface IUserFormBoolean {
	firstName?: boolean;
	lastName?: boolean;
	email?: boolean;
	mobile?: boolean;
	subrole?: boolean;
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

export interface UserSubrole {
	id: string;
	code: string;
	display_name: string;
	label: string;
	description: string;
}

export interface UserData {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile: string | null;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	is_tc_accepted: boolean;
	tc_accepted_at: string | null;
	ext_auth_ref_id: string;
	status: "INVITE_EXPIRED" | "ACTIVE" | "INACTIVE" | "INVITED";
	subrole: UserSubrole;
}

export interface GetCustomerUserData {
	records: UserData[];
	total_pages: number;
	total_items: string;
}

export interface IGetCustomerUsersApiResponse {
	status: string;
	message: string;
	data: GetCustomerUserData;
}

export interface IResendUserInvite {
	customerId: string;
	userId: string;
}

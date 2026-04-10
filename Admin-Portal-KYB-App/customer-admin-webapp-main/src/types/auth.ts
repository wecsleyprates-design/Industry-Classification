import {
	type TAccessType,
	type TAllPermissions,
	type TCodeModule,
} from "./common";

export interface LoginBody {
	username: string;
	password: string;
}

export interface CustomerLogin {
	email: string;
	password: string;
}

export interface ResetPasswordBody {
	newPassword: string;
	confirmPassword: string;
}

export interface ForgotPasswordBody {
	email: string;
}

export interface UpdatePassword extends ResetPasswordBody {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export interface AcceptPassword {
	password: string;
	confirmPassword: string;
}

export interface UpdatePasswordRequest {
	old_password: string;
	new_password: string;
}

export interface ResetPasswordRequest {
	reset_token: string;
	password: string;
}

export interface ILoginResponseUserDetails {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_email_verified: boolean;
}

export interface IPermission {
	id: number;
	code: `${TCodeModule}:${TAccessType}`;
	label: string;
}

export interface LoginResponse {
	status: string;
	message: string;
	data: LoginResponseData;
}

export interface LoginResponseData {
	access_token: string;
	refresh_token: string;
	id_token: string;
	is_email_verified: boolean;
	user_details: ILoginResponseUserDetails;
	customer_details: any;
	subrole: {
		code: string;
		id: string;
		label: string;
	};
	permissions: IPermission[];
}

export interface LoginDataAuth extends LoginResponseData {
	access: Partial<TAllPermissions>;
}

export interface VerifyResetToken {
	email: string;
}

export interface VerifyResetTokenResponse {
	status: string;
	message: string;
	data: {
		access_token: string;
		is_email_verified: boolean;
	};
}

export interface LogOutResponse {
	status: string;
	message: string;
}

export interface AcceptTokenInviteResponse {
	status: string;
	message: string;
	data: any;
}

export interface AuthError {
	message: string;
	response: { data: any };
}

export interface ForgotPasswwordResponse {
	status: string;
	message: string;
}

export interface ResetPasswwordResponse {
	status: string;
	message: string;
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
		customer_details: ICustomerDetails;
	};
}

export interface GetInvite {
	customerId: string;
	applicantId: string;
	caseId: string;
	businessId: string;
}
export interface GetInviteRequestBody {
	case_id: string;
}
export interface ResendInvite {
	customerId: string;
	caseId: string;
	businessName: string;
	applicantId: string;
	businessId: string;
}
export interface ICustomerDetails {
	id: string;
	name: string;
}

export interface Field {
	description: any;
	step_name: string;
	values: any;
	internalName: string;
	id: string;
	label: string;
	property:
		| "text"
		| "dropdown"
		| "integer"
		| "full_text"
		| "phone_number"
		| "upload"
		| "email"
		| "boolean"
		| "alphanumeric"
		| "decimal"
		| "checkbox"
		| "date";
	value: string | string[];
	value_id: string[];
	is_sensitive_info: boolean;
	rules: Rule[] | null;
	field_options: Array<{
		checkbox_type: string;
		icon: string;
		icon_position: string;
		input_type: string;
		label: string;
		value: string;
	}>;
}

export interface Rule {
	rule:
		| "required"
		| "minimum"
		| "maximum"
		| "minLength"
		| "maxLength"
		| "format"
		| "fileType"
		| "maxFileSize"
		| "field_visibility"
		| "maxNumFiles"
		| "minNumFiles";
	value?: any;
	condition?: {
		visibility?: "TRUE" | "FALSE";
		dependency?: string;
		fields?: string[];
	};
}

export interface PreFilledData {
	templateId?: string;
	version?: number;
	name?: string;
	fields: Field[];
}

export interface SamlLoginResponseSuccess {
	status: "success";
	message: string;
	data: {
		redirect_url: string;
	};
}

export interface SamlLoginResponseError {
	status: "fail";
	message: string;
	errorCode: string;
	data: {
		errorName: string;
		details: unknown[];
	};
}

export type SamlLoginResponse =
	| SamlLoginResponseSuccess
	| SamlLoginResponseError;

export type CustomerSelectionResponseArray = {
	id: string;
	name: string;
	label: string;
	contact_number: string | null;
	is_active: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	customer_type: "PRODUCTION" | "SANDBOX";
	subrole: {
		id: string;
		code: string;
		label: string;
	};
};

export interface CustomerSelectionResponse {
	status: "success";
	message: string;
	data: CustomerSelectionResponseArray[];
}

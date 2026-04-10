import { getMicrositeAuthCookiesApi } from "@joinworth/worth-core-utils";
import { api } from "@/lib/api";

const cookiesApi = () => getMicrositeAuthCookiesApi();
import {
	type AcceptTokenInviteResponse,
	type CustomerLogin,
	type CustomerSelectionResponse,
	type ForgotPasswordBody,
	type ForgotPasswwordResponse,
	type GetInvite,
	type ILoginResponse,
	type LoginBody,
	type LoginResponse,
	type LogOutResponse,
	type ResendInvite,
	type ResetPasswordRequest,
	type ResetPasswwordResponse,
	type SamlLoginResponse,
	type UpdatePasswordRequest,
	type VerifyResetTokenResponse,
} from "@/types/auth";

import MICROSERVICE from "@/constants/Microservices";

export const login = async (body: LoginBody) => {
	const res = new Promise<boolean>((resolve, reject) => {
		if (body.username !== "user" || body.password !== "user") {
			reject(new Error("Invalid username or password"));
		}

		setTimeout(() => {
			resolve(true);
		}, 2000);
	});
	return await res;
};

export const loginCustomerAdmin = async (
	body: CustomerLogin,
): Promise<LoginResponse> => {
	const url: string = `${MICROSERVICE.AUTH_V2}/customer/sign-in`;
	const { data } = await cookiesApi().post<LoginResponse>(url, body);
	return data;
};

export const exchangeSSOCode = async (
	uuid: string,
	redirectUri?: string,
): Promise<LoginResponse> => {
	const url = `${MICROSERVICE.AUTH}/saml/token`;

	const { data } = await cookiesApi().post<LoginResponse>(url, {
		uuid,
		...(redirectUri ? { redirect_uri: redirectUri } : {}),
	});

	return data;
};

export const forgotPassword = async (
	body: ForgotPasswordBody,
): Promise<ForgotPasswwordResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/forgot-password`;
	const { data } = await api.post<ForgotPasswwordResponse>(url, body);
	return data;
};

export const updatePassword = async (
	body: UpdatePasswordRequest,
): Promise<ForgotPasswwordResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/update-password`;
	const { data } = await cookiesApi().post<ForgotPasswwordResponse>(url, body);
	return data;
};

export const resetPassword = async (
	body: ResetPasswordRequest,
): Promise<ResetPasswwordResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/reset-password`;
	const { data } = await api.post<ResetPasswwordResponse>(url, body);
	return data;
};

export const verifyResetToken = async (
	resetToken: string,
): Promise<VerifyResetTokenResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/reset-password/${resetToken}/verify`;
	const { data } = await api.post<VerifyResetTokenResponse>(url);
	return data;
};

export const logOutCustomerAdmin = async (): Promise<LogOutResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/customer/logout`;
	const { data } = await cookiesApi().post<LogOutResponse>(url);
	return data;
};

export const acceptInvite = async (body: {
	token: any;
	data: any;
}): Promise<AcceptTokenInviteResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/invite/${body.token}/accept`;
	const { data } = await api.post<AcceptTokenInviteResponse>(url, body.data);
	return data;
};

export const refreshToken = async (): Promise<ILoginResponse> => {
	const response = await cookiesApi().post(
		`${MICROSERVICE.AUTH}/refresh-token/customer`,
	);
	return response.data;
};

export const getInvite = async (payload: GetInvite): Promise<any> => {
	const { customerId, applicantId, caseId, businessId } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/applicants/${applicantId}/invite/`;
	const { data } = await api.post<any>(url, {
		case_id: caseId,
		business_id: businessId,
	});
	return data;
};
export const resendInvite = async (payload: ResendInvite): Promise<any> => {
	const { customerId, applicantId, caseId, businessName, businessId } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/applicants/${applicantId}/resend-invite`;
	const { data } = await api.post<any>(url, {
		case_id: caseId,
		business_name: businessName,
		business_id: businessId,
	});
	return data;
};

export const requestInvite = async (payload: {
	inviteToken: string;
	userType: "admin" | "users";
}) => {
	const { inviteToken, userType } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${inviteToken}/${userType}/request-invite`;
	const { data } = await api.post(url);
	return data;
};

export const samlLogin = async (email: string): Promise<SamlLoginResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/saml/login`;
	const { data } = await api.post<SamlLoginResponse>(url, { email });
	return data;
};

export const userCustomers = async (payload: {
	user_id: string | undefined;
}): Promise<CustomerSelectionResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/users/${payload.user_id}/customers`;
	const { data } = await api.get(url);
	return data;
};

export const getCustomerAccess = async (payload: {
	customer_id: string;
}): Promise<LoginResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/customers/${payload.customer_id}/access`;
	const { data } = await api.get<any>(url);
	return data;
};

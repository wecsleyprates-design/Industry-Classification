import { api } from "@/lib/api";
import {
	type CreateUserRequest,
	type ICustomerApiResponse,
	type IGetCustomerUsersApiResponse,
	type IGetUsersRequest,
	type IResendUserInvite,
	type IUpdateUserRequest,
} from "@/types/users";

import MICROSERVICE from "@/constants/Microservices";

export const createCustomerUser = async (
	payload: CreateUserRequest,
): Promise<ICustomerApiResponse> => {
	const { customerId, body } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users`;
	const { data } = await api.post<ICustomerApiResponse>(url, body);
	return data;
};

export const getCustomerUsers = async (
	payload: IGetUsersRequest,
): Promise<IGetCustomerUsersApiResponse> => {
	const { customerId, params } = payload;
	const { data } = await api.get<IGetCustomerUsersApiResponse>(
		`${MICROSERVICE.AUTH}/customers/${customerId}/users?${params}`,
	);
	return data;
};

export const getUserByUserId = async (customerId: string, userId: string) => {
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}`;
	const { data } = await api.get(url);
	return data;
};

export const updateUserByUserId = async (
	payload: IUpdateUserRequest,
): Promise<ICustomerApiResponse> => {
	const { customerId, userId, body } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}`;
	const { data } = await api.patch<ICustomerApiResponse>(url, body);
	return data;
};

export const getRoles = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}/subroles`,
	);
	return data;
};

export const resendUserInvite = async (payload: IResendUserInvite) => {
	const { customerId, userId } = payload;
	const { data } = await api.post(
		`${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}/resend-invite`,
	);
	return data;
};

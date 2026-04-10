import qs from "qs";
import { api } from "@/lib/api";
import {
	type GetCustomerUsersParams,
	type GetCustomerUsersResponse,
} from "@/types/GetCustomerUsers";
import { type GetUserResponse } from "@/types/GetUser";
import { type GetUsersResponse } from "@/types/GetUsers";
import {
	type PatchCustomerUserRequest,
	type PatchCustomerUserResponse,
} from "@/types/PatchCustomerUser";
import { type PostCustomerUserResponse } from "@/types/PostCustomerUser";
import { type GetRolesResponse } from "@/types/roles";

import MICROSERVICE from "@/constants/Microservices";

export const postCustomerUser = async (
	customerId: string,
	body: PatchCustomerUserRequest,
): Promise<PostCustomerUserResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users`;
	const { data } = await api.post<PostCustomerUserResponse>(url, body);
	return data;
};

export const getCustomerUsers = async (
	customerId: string,
	params: GetCustomerUsersParams | undefined = undefined,
): Promise<GetCustomerUsersResponse> => {
	const { data } = await api.get<GetCustomerUsersResponse>(
		`${MICROSERVICE.AUTH}/customers/${customerId}/users?${
			params ? qs.stringify(params) : ""
		}`,
	);
	return data;
};

export const getCustomerUser = async (customerId: string, userId: string) => {
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}`;
	const { data } = await api.get(url);
	return data;
};

export const patchCustomerUser = async (
	customerId: string,
	userId: string,
	body: PatchCustomerUserRequest,
): Promise<PatchCustomerUserResponse> => {
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}`;
	const { data } = await api.patch<PatchCustomerUserResponse>(url, body);
	return data;
};

export const getRoles = async (
	customerId: string,
): Promise<GetRolesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}/subroles`,
	);
	return data;
};

export const putResendUserInvite = async (
	customerId: string,
	userId: string,
) => {
	const { data } = await api.post(
		`${MICROSERVICE.AUTH}/customers/${customerId}/users/${userId}/resend-invite`,
	);
	return data;
};

export const getUsers = async (
	params: Record<string, any> | null | undefined = null,
): Promise<GetUsersResponse> => {
	const { data } = await api.get<GetUsersResponse>(
		`${MICROSERVICE.AUTH}/users${params ? `?${qs.stringify(params)}` : ""}`,
	);
	return data;
};

export const getUser = async (userId: string) => {
	const { data } = await api.get<GetUserResponse>(
		`${MICROSERVICE.AUTH}/users/${userId}`,
	);
	return data;
};

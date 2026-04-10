import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type CreateUserRequest,
	type IResendUserInvite,
	type IUpdateUserRequest,
} from "@/types/users";
import {
	createCustomerUser,
	getCustomerUsers,
	getRoles,
	getUserByUserId,
	resendUserInvite,
	updateUserByUserId,
} from "../api/users.service";

export const useCreateCustomerUserQuery = () =>
	useMutation({
		mutationFn: async (body: CreateUserRequest) => {
			const res = await createCustomerUser(body);
			return res;
		},
	});

export const useUpdateCustomerUserQuery = () =>
	useMutation({
		mutationFn: async (payload: IUpdateUserRequest) => {
			const res = await updateUserByUserId(payload);
			return res;
		},
	});

export const useGetUsers = (customerId: string, params: string) =>
	useQuery({
		queryKey: ["getUsers", customerId, params],
		queryFn: async () => {
			const res = await getCustomerUsers({ customerId, params });
			return res;
		},
		enabled: !!customerId,
	});

export const useGetUserDetailsByIdQuery = (
	customerId: string,
	userId: string,
) =>
	useQuery({
		queryKey: ["getUserByUserId", customerId, userId],
		queryFn: async () => {
			const res = await getUserByUserId(customerId, userId);
			return res;
		},
		enabled: !!customerId && !!userId,
		retry: 1,
	});

export const useGetRolesQuery = (customerId: string) =>
	useQuery({
		queryKey: ["getRoles", customerId],
		queryFn: async () => {
			const res = await getRoles(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useResendUserInviteQuery = () =>
	useMutation({
		mutationFn: async (payload: IResendUserInvite) => {
			const res = await resendUserInvite(payload);
			return res;
		},
	});

import { useMutation, useQuery } from "@tanstack/react-query";
import { checkFeatureAccess } from "@/lib/helper";
import {
	getCustomerUser,
	getCustomerUsers,
	getRoles,
	getUser,
	getUsers,
	patchCustomerUser,
	postCustomerUser,
	putResendUserInvite,
} from "@/services/api/users.service";
import { type ApiResponse } from "@/types/api";
import { type GetCustomerUserResponse } from "@/types/GetCustomerUser";
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

/** `/users/:customerId/users` endpoints */

export const usePostCustomerUserQuery = () =>
	useMutation<
		PostCustomerUserResponse,
		Error,
		{ customerId: string; body: PatchCustomerUserRequest }
	>({
		mutationKey: ["createUser"],
		mutationFn: async (request: {
			customerId: string;
			body: PatchCustomerUserRequest;
		}) => {
			const { customerId, body } = request;
			return await postCustomerUser(customerId, body);
		},
	});

export const usePatchCustomerUserQuery = () =>
	useMutation<
		PatchCustomerUserResponse,
		Error,
		{
			customerId: string;
			userId: string;
			body: PatchCustomerUserRequest;
		}
	>({
		mutationKey: ["patchCustomerUser"],
		mutationFn: async (request: {
			customerId: string;
			userId: string;
			body: PatchCustomerUserRequest;
		}) => {
			const { customerId, userId, body } = request;
			return await patchCustomerUser(customerId, userId, body);
		},
	});

export const useGetCustomerUsers = (
	customerId: string,
	params: GetCustomerUsersParams | undefined = undefined,
) => {
	return useQuery<GetCustomerUsersResponse>({
		queryKey: ["getCustomerUsers", customerId, params],
		queryFn: async () => {
			return await getCustomerUsers(customerId, params);
		},
		enabled: !!customerId,
	});
};

export const useGetCustomerUser = (customerId: string, userId: string) =>
	useQuery<GetCustomerUserResponse>({
		queryKey: ["useGetCustomerUser", customerId, userId],
		queryFn: async () => {
			return await getCustomerUser(customerId, userId);
		},
		enabled: !!customerId && !!userId,
		retry: 1,
	});

export const useResendUserInviteQuery = () =>
	useMutation<ApiResponse<any>, Error, { customerId: string; userId: string }>({
		mutationKey: ["putResendUserInvite"],
		mutationFn: async (payload: { customerId: string; userId: string }) => {
			return await putResendUserInvite(payload.customerId, payload.userId);
		},
	});

/** `/users` endpoints */

export const useGetUsers = (params: Record<string, any>) => {
	const hasPermission = checkFeatureAccess("customer_user:read");

	return useQuery<GetUsersResponse>({
		queryKey: ["getUsers", params, hasPermission],
		queryFn: async () => {
			return await getUsers(params);
		},
		enabled: hasPermission,
	});
};

export const useGetUser = (userId: string) =>
	useQuery<GetUserResponse>({
		queryKey: ["getUser", userId],
		queryFn: async () => {
			return await getUser(userId);
		},
		enabled: !!userId,
	});

export const useGetRolesQuery = (customerId: string) =>
	useQuery({
		queryKey: ["getRoles", customerId],
		queryFn: async () => {
			return await getRoles(customerId);
		},
		enabled: !!customerId,
	});

import { useMutation, useQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import {
	createCustomerUser,
	getCustomerUsers,
	getRoles,
	getUserByUserId,
	resendUserInvite,
	updateUserByUserId,
} from "@/services/api/users.service";
import {
	type CreateUserRequest,
	type IGetCustomerUsersApiResponse,
	type IResendUserInvite,
	type IUpdateUserRequest,
} from "@/types/users";

export const useCreateCustomerUserQuery = () =>
	useMutation({
		mutationKey: ["createUser"],
		mutationFn: async (body: CreateUserRequest) => {
			const res = await createCustomerUser(body);
			return res;
		},
	});

export const useUpdateCustomerUserQuery = () =>
	useMutation({
		mutationKey: ["updateCustomerUser"],
		mutationFn: async (payload: IUpdateUserRequest) => {
			const res = await updateUserByUserId(payload);
			return res;
		},
	});

export const useGetUsers = (customerId: string, params: string) => {
	const hasPermission = usePermission("customer_user:read");

	return useQuery<IGetCustomerUsersApiResponse>({
		queryKey: ["getUsers", customerId, params, hasPermission],
		queryFn: async () => {
			const res = await getCustomerUsers({ customerId, params });
			return res;
		},
		enabled: !!customerId && hasPermission,
	});
};

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
		mutationKey: ["resendUserInvite"],
		mutationFn: async (payload: IResendUserInvite) => {
			const res = await resendUserInvite(payload);
			return res;
		},
	});

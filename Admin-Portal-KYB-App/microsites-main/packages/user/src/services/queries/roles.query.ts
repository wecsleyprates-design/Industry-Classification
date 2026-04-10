import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createRole,
	type CreateRoleRequest,
	deleteRole,
	getAllRoles,
	getAllSubrolePermissions,
	getSubroleConfigs,
	updateRole,
} from "@/services/api/roles.service";
import { type ApiResponse } from "@/types/api";
import { type PaginatedApiRequest } from "@/types/PaginatedAPIRequest";
import {
	type GetAllSubrolePermissions,
	type SubroleConfigResponse,
} from "@/types/roles";

export const useGetCustomerRoles = (
	customerId: string,
	payload: PaginatedApiRequest,
) =>
	useQuery({
		queryKey: ["useGetCustomerRoles", customerId, JSON.stringify(payload)],
		queryFn: async () => await getAllRoles(customerId, payload),
		enabled: !!customerId,
		retry: 1,
	});

export const useGetSubroleConfigs = (subroleId?: string) =>
	useQuery<SubroleConfigResponse>({
		queryKey: ["useGetSubroleConfigs", subroleId],
		queryFn: async () => await getSubroleConfigs(subroleId),
		enabled: true,
		retry: 1,
	});

export const useCreateRole = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ApiResponse<any>,
		Error,
		{
			customerId: string;
			roleData: CreateRoleRequest;
		}
	>({
		mutationFn: async ({
			customerId,
			roleData,
		}: {
			customerId: string;
			roleData: CreateRoleRequest;
		}) => await createRole(customerId, roleData),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["useGetSubroleConfigs"],
			});
		},
	});
};

export const useUpdateRole = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ApiResponse<any>,
		Error,
		{
			customerId: string;
			subroleId: string;
			roleData: CreateRoleRequest;
		}
	>({
		mutationFn: async ({
			customerId,
			subroleId,
			roleData,
		}: {
			customerId: string;
			subroleId: string;
			roleData: CreateRoleRequest;
		}) => await updateRole(customerId, subroleId, roleData),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["useGetSubroleConfigs"],
			});
		},
	});
};

export const useDeleteRole = () => {
	return useMutation<
		ApiResponse<any>,
		Error,
		{
			customerId: string;
			subroleId: string;
		}
	>({
		mutationFn: async ({
			customerId,
			subroleId,
		}: {
			customerId: string;
			subroleId: string;
		}) => await deleteRole(customerId, subroleId),
	});
};

export const useAllSubrolePermissions = () =>
	useMutation<
		GetAllSubrolePermissions,
		Error,
		{
			customerId: string;
			subroleId: string;
		}
	>({
		mutationFn: async ({
			customerId,
			subroleId,
		}: {
			customerId: string;
			subroleId: string;
		}) => {
			return await getAllSubrolePermissions(customerId, subroleId);
		},
	});

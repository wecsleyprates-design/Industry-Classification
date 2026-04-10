import { api } from "@/lib/api";
import { type PaginatedApiRequest } from "@/types/PaginatedAPIRequest";
import {
	type GetAllSubrolePermissions,
	type RolesListingResponse,
	type SubroleConfigResponse,
} from "@/types/roles";

import MICROSERVICE from "@/constants/Microservices";

export const getAllRoles = async (
	customerId: string,
	payload: PaginatedApiRequest,
): Promise<RolesListingResponse> => {
	const url = `${MICROSERVICE.AUTH}/customers/${customerId}/roles`;
	const { data } = await api.get(url, { params: payload });
	return data;
};

export interface CreateRoleRequest {
	code?: string;
	label?: string;
	description?: string;
	permissions?: string[];
}

export const getSubroleConfigs = async (
	subroleId?: string,
): Promise<SubroleConfigResponse> => {
	const url = `${MICROSERVICE.AUTH}/permissions/subrole-configs`;
	const { data } = await api.get<SubroleConfigResponse>(url, {
		params: { subrole_id: subroleId },
	});
	return data;
};

export const createRole = async (
	customerId: string,
	body: CreateRoleRequest,
) => {
	const url = `${MICROSERVICE.AUTH}/permissions/customers/${customerId}/subrole`;
	const { data } = await api.post(url, body);
	return data;
};

export const updateRole = async (
	customerId: string,
	subroleId: string,
	body: CreateRoleRequest,
) => {
	const url = `${MICROSERVICE.AUTH}/permissions/customers/${customerId}/subroles/${subroleId}`;
	const { data } = await api.put(url, body);
	return data;
};

export const deleteRole = async (customerId: string, subroleId: string) => {
	const url = `${MICROSERVICE.AUTH}/permissions/customers/${customerId}/subroles/${subroleId}`;
	const { data } = await api.delete(url);
	return data;
};

export const getAllSubrolePermissions = async (
	customerId: string,
	subroleId: string,
): Promise<GetAllSubrolePermissions> => {
	const url = `${MICROSERVICE.AUTH}/permissions/customers/${customerId}/subroles/${subroleId}`;
	const { data } = await api.get(url);
	return data;
};

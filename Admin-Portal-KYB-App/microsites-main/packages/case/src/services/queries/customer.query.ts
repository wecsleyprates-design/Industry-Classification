import { useMutation, useQuery } from "@tanstack/react-query";
import { type IPayload } from "@/types/common";
import {
	getAllBusinesses,
	getBusinessByCustomerId,
	getCustomerById,
	getCustomersBusinessData,
} from "../api/customer.service";

export const useGetBusinesses = (params: IPayload) =>
	useQuery({
		queryKey: ["getAllBusinesses", params],
		queryFn: async () => {
			const res = await getAllBusinesses(params);
			return res;
		},
	});

export const useGetBusinessByCustomerId = (
	customerId: string,
	params: Record<string, any>,
) =>
	useQuery({
		queryKey: ["getBusinessByCustomerId", customerId, params],
		queryFn: async () => {
			const res = await getBusinessByCustomerId(customerId, params);
			return res;
		},
		enabled: Boolean(customerId),
	});

export const useGetCustomersBusinessData = () =>
	useMutation({
		mutationKey: ["getCustomersBusinessdata"],
		mutationFn: async (customerId: string) => {
			const res = await getCustomersBusinessData(customerId);
			return res;
		},
	});

export const useGetCustomerBusinesses = (params: Record<string, unknown>) =>
	useQuery({
		queryKey: ["getCustomerBusinesses", params],
		queryFn: async () => {
			const res = await getAllBusinesses(params);
			return res;
		},
	});
export const useGetCustomerById = (customerId: string) =>
	useQuery({
		queryKey: ["getCustomerById", customerId],
		queryFn: async () => {
			const res = await getCustomerById(customerId);
			return res;
		},
		retry: 1,
		enabled: Boolean(customerId),
	});

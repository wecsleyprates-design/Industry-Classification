import { useMutation, useQuery } from "@tanstack/react-query";
import { type ApiResponse } from "@/types/api";
import {
	type CustomerDetailsResponseData,
	type CustomerEntitlementsPayload,
	type CustomerIntegrationSettingsDataPayload,
	type CustomersResponse,
	type getCustomerIntegrationResponse,
	type getMonthlyLimitResponse,
	type UpdateCustomerByIdPayload,
	type updateCustomerIntegrationStatusBody,
} from "@/types/customer";
import {
	CreateOrUpdateCustomerIntegrationSettings,
	createPaymentProcessorEntitlements,
	getCustomerById,
	getCustomerIntegrationSettingsByCustomerId,
	getCustomerIntegrationStatus,
	getCustomers,
	getCustomerSettingById,
	getMonthlyOnboardingLimit,
	updateCustomerById,
	updateCustomerIntegrationStatus,
} from "../api/customer.service";

export const useCreateOrUpdateCustomerIntegrationSettings = () =>
	useMutation<{ data: any }, unknown, CustomerIntegrationSettingsDataPayload>({
		mutationKey: ["createOrUpdateCustomerIntegrationSettings"],
		mutationFn: async (payload: CustomerIntegrationSettingsDataPayload) => {
			const res = await CreateOrUpdateCustomerIntegrationSettings(payload);
			return res;
		},
	});

export const useGetCustomerIntegrationSettingsByCustomerId = (
	customerId: string,
) =>
	useQuery({
		queryKey: ["useGetCustomerIntegrationSettingsByCustomerId", customerId],
		queryFn: async () => {
			const res = await getCustomerIntegrationSettingsByCustomerId(customerId);
			return res;
		},
		retry: 1,
		enabled: !!customerId,
	});

export const useGetCustomerIntegrationStatus = (customerId: string) =>
	useQuery<getCustomerIntegrationResponse>({
		queryKey: ["getCustomerIntegrationStatus", customerId],
		queryFn: async () => {
			const res = await getCustomerIntegrationStatus(customerId);
			return res;
		},
		retry: 1,
	});

export const useGetCustomerSettingsById = (customerId: string) =>
	useQuery({
		queryKey: ["useGetCustomerSettingsById", customerId],
		queryFn: async () => {
			const res = await getCustomerSettingById(customerId);
			return res;
		},
		retry: 1,
	});

export const useUpdateCustomerIntegrationStatus = () =>
	useMutation<unknown, Error, updateCustomerIntegrationStatusBody>({
		mutationKey: ["updateCustomerIntegrationStatus"],
		mutationFn: async (payload: updateCustomerIntegrationStatusBody) => {
			const res = await updateCustomerIntegrationStatus(payload);
			return res;
		},
	});

export const useGetCustomers = (params: string) =>
	useQuery<CustomersResponse>({
		queryKey: ["getCustomers", params],
		queryFn: async () => {
			const res = await getCustomers(params);
			return res;
		},
	});

export const useGetCustomerById = (customerId: string) =>
	useQuery<ApiResponse<CustomerDetailsResponseData>>({
		queryKey: ["getCustomerById", customerId],
		queryFn: async () => {
			const res = await getCustomerById(customerId);
			return res;
		},
		retry: 1,
	});

export const useGetMonthlyOnboardingLimit = (customerId: string) =>
	useQuery<getMonthlyLimitResponse>({
		queryKey: ["getMonthlyOnboardingLimit", customerId],
		queryFn: async () => {
			const res = await getMonthlyOnboardingLimit(customerId);
			return res;
		},
		retry: 0,
		refetchOnWindowFocus: true,
		enabled: !!customerId,
		refetchOnMount: true,
		refetchOnReconnect: true,
	});

export const useCreatePaymentProcessorEntitlements = () =>
	useMutation<
		{ status: string; message: string },
		Error,
		{ customerId: string; payload: CustomerEntitlementsPayload }
	>({
		mutationKey: ["createPaymentProcessorEntitlements"],
		mutationFn: async ({
			customerId,
			payload,
		}: {
			customerId: string;
			payload: CustomerEntitlementsPayload;
		}) => {
			const res = await createPaymentProcessorEntitlements(customerId, payload);
			return res;
		},
	});

export const useUpdateCustomerById = () =>
	useMutation({
		mutationKey: ["updateCustomerById"],
		mutationFn: async (payload: UpdateCustomerByIdPayload) => {
			const res = await updateCustomerById(payload);
			return res;
		},
	});

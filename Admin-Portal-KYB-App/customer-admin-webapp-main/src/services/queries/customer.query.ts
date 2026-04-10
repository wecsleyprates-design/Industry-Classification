import {
	useMutation,
	useQuery,
	type UseQueryResult,
} from "@tanstack/react-query";
import {
	type CustomerUpdateSettingRequestBody,
	type DeleteCustomerSettingFileRequestBody,
	type GetCustomerBetaSettingsResponse,
	type UpdateCustomerBetaSettingsRequestBody,
	type UploadCustomerSettingFileRequestBody,
} from "@/types/customer";
import {
	createCustomerSetting,
	DeleteCustomerSettingFile,
	getCoreBetaSettings,
	getCustomerBetaSettings,
	getCustomerById,
	getCustomersBusinessData,
	getCustomerSettingById,
	updateCustomerBetaSettings,
	UpdateCustomerSetting,
	UploadCustomerSettingFile,
} from "../api/customer.service";

export const useCreateCustomerSettingQuery = () =>
	useMutation({
		mutationFn: async (payload: CustomerUpdateSettingRequestBody) => {
			const res = await createCustomerSetting(payload);
			return res;
		},
	});

export const useUpdateCustomerSettingQuery = () =>
	useMutation({
		mutationFn: async (payload: CustomerUpdateSettingRequestBody) => {
			const res = await UpdateCustomerSetting(payload);
			return res;
		},
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

export const useUploadCustomerSettingFile = () =>
	useMutation({
		mutationFn: async (payload: UploadCustomerSettingFileRequestBody) => {
			const res = await UploadCustomerSettingFile(payload);
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
	});

export const useDeleteCustomerSettingFile = () =>
	useMutation({
		mutationFn: async (payload: DeleteCustomerSettingFileRequestBody) => {
			const res = await DeleteCustomerSettingFile(payload);
			return res;
		},
	});

export const useGetCustomersBusinessData = () =>
	useMutation({
		mutationFn: async (customerId: string) => {
			const res = await getCustomersBusinessData(customerId);
			return res;
		},
	});

export const useGetCustomerBetaSetttngs = (
	customerId: string,
): UseQueryResult<GetCustomerBetaSettingsResponse> =>
	useQuery({
		queryKey: ["getCustomerBetaSettings", customerId],
		queryFn: async () => {
			const res = await getCustomerBetaSettings(customerId);
			return res;
		},
		retry: false,
		enabled: !!customerId,
	});

export const useUpdateCustomerBetaSettings = () =>
	useMutation({
		mutationFn: async (payload: UpdateCustomerBetaSettingsRequestBody) => {
			const res = await updateCustomerBetaSettings(payload);
			return res;
		},
	});

export const useGetCoreBetaSettings = () =>
	useQuery({
		queryKey: ["getCoreBetaSettings"],
		queryFn: async () => {
			const res = await getCoreBetaSettings();
			return res;
		},
		retry: false,
	});

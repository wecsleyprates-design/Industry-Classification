import { api } from "@/lib/api";
import {
	type CoreBeaSettingsResponse,
	type CustomerUpdateSettingRequestBody,
	type DeleteCustomerSettingFileRequestBody,
	type GetCustomerBetaSettingsResponse,
	type UpdateCustomerBetaSettingsRequestBody,
	type UploadCustomerSettingFileRequestBody,
} from "@/types/customer";

import MICROSERVICE from "@/constants/Microservices";

export const createCustomerSetting = async (
	payload: CustomerUpdateSettingRequestBody,
) => {
	const { customerId, body } = payload;
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/customers/${customerId}/settings`,
		body,
	);
	return data;
};

export const UpdateCustomerSetting = async (
	payload: CustomerUpdateSettingRequestBody,
) => {
	const { customerId, body } = payload;
	const { data } = await api.patch(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings`,
		body,
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
	return data;
};

export const getCustomerSettingById = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings`,
	);
	return data;
};

export const UploadCustomerSettingFile = async (
	payload: UploadCustomerSettingFileRequestBody,
) => {
	const { customerId, body } = payload;
	const { data } = await api.post(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings/upload`,
		body,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return data;
};

export const getCustomerById = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}`,
	);
	return data;
};

export const DeleteCustomerSettingFile = async (
	payload: DeleteCustomerSettingFileRequestBody,
) => {
	const { customerId, body } = payload;
	const { data } = await api.delete(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings/delete-file`,
		{
			data: body,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
	return data;
};

export const getCustomersBusinessData = async (customerId: string) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/customers/${customerId}/businesses-data`;
	const { data } = await api.get(url);
	return data;
};

export const getCustomerBetaSettings = async (
	customerId: string,
): Promise<GetCustomerBetaSettingsResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/customers/${customerId}/beta-settings`;
	const { data } = await api.get(url);
	return data;
};

export const updateCustomerBetaSettings = async (
	payload: UpdateCustomerBetaSettingsRequestBody,
) => {
	const { customerId, body } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/customers/${customerId}/beta-settings`;
	const { data } = await api.patch(url, body);
	return data;
};

export const getCoreBetaSettings =
	async (): Promise<CoreBeaSettingsResponse> => {
		const url: string = `${MICROSERVICE.NOTIFICATION}/core-beta-settings`;
		const { data } = await api.get(url);
		return data;
	};

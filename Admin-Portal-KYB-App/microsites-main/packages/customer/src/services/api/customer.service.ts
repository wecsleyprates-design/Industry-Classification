import { api } from "@/lib/api";
import { type ApiResponse } from "@/types/api";
import {
	type CustomerDetailsResponseData,
	type CustomerEntitlementsPayload,
	type CustomerIntegrationSettingResponse,
	type CustomerIntegrationSettingsDataPayload,
	type getCustomerIntegrationResponse,
	type getMonthlyLimitResponse,
	type UpdateCustomerByIdPayload,
	type updateCustomerIntegrationStatusBody,
} from "@/types/customer";

import MICROSERVICE from "@/constants/Microservices";

export const CreateOrUpdateCustomerIntegrationSettings = async (
	payload: CustomerIntegrationSettingsDataPayload,
) => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/customer-integration-settings`,
		payload,
	);
	return data;
};

export const getCustomerIntegrationSettingsByCustomerId = async (
	customerId: string,
): Promise<CustomerIntegrationSettingResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/customer-integration-settings/${customerId}`,
	);
	return data;
};

export const getCustomerIntegrationStatus = async (
	customerId: string,
): Promise<getCustomerIntegrationResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/integration-status/customers/${customerId}`,
	);
	return data;
};

export const updateCustomerIntegrationStatus = async (
	body: updateCustomerIntegrationStatusBody,
) => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/integration-status/customers/${body.customerId}`,
		body.payload,
	);
	return data;
};

export const getCustomerSettingById = async (customerId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.NOTIFICATION}/customers/${customerId}/settings`,
	);
	return data;
};

export const getCustomers = async (params: string) => {
	const { data } = await api.get(`${MICROSERVICE.AUTH}/customers?${params}`);
	return data;
};

export const getCustomerById = async (
	customerId: string,
): Promise<ApiResponse<CustomerDetailsResponseData>> => {
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}`,
	);
	return data;
};

export const getMonthlyOnboardingLimit = async (
	customerId: string,
): Promise<getMonthlyLimitResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding/limit`,
	);
	return data;
};

export const createPaymentProcessorEntitlements = async (
	customerId: string,
	payload: CustomerEntitlementsPayload,
): Promise<{ status: string; message: string }> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/payment-processors/${customerId}/entitlements`,
		payload,
	);
	return data;
};

export const updateCustomerById = async (
	payload: UpdateCustomerByIdPayload,
) => {
	const { customerId, body } = payload;
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}`;
	const { data } = await api.patch(url, body);
	return data;
};

import { api } from "@/lib/api";
import { type IntegrationSettingsResponse } from "@/types/IntegrationSettings";

import { MICROSERVICE } from "@/constants";

export const saveIntegrationSettings = async (
	customerId: string,
	payload: FormData,
): Promise<IntegrationSettingsResponse> => {
	const { data } = await api.post(
		`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		payload,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return data;
};

export const updateIntegrationSettings = async (
	customerId: string,
	payload: FormData,
): Promise<IntegrationSettingsResponse> => {
	const { data } = await api.put(
		`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		payload,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return data;
};

export const checkConnectionStatus = async (
	customerId: string,
	acquirerId?: string,
) => {
	try {
		const { data } = await api.get(
			`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/check-connection-status`,
			acquirerId ? { params: { acquirerId } } : undefined,
		);
		return data;
	} catch (error: unknown) {
		throw new Error("Error checking connection status");
	}
};

export const getCredentials = async (
	customerId: string,
): Promise<IntegrationSettingsResponse | null> => {
	try {
		const { data } = await api.get(
			`${MICROSERVICE.INTEGRATION}/match-pro/${customerId}/credentials`,
		);
		return data;
	} catch (error: unknown) {
		console.warn(error);
		return null;
	}
};

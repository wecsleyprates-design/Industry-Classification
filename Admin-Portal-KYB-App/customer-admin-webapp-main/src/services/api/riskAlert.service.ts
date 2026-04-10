import { api } from "@/lib/api";
import {
	type CustomerIntegrationSettingsResponse,
	type GetRiskAlertsResponse,
	type RiskAlertConfigBody,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

import MICROSERVICE from "@/constants/Microservices";

export const getRiskAlertConfig = async (
	customerId: string,
): Promise<RiskAlertConfigurationResponse> => {
	const url: string = `${MICROSERVICE.INTEGRATION}/risk-alerts/customers/${customerId}/configs`;
	const { data } = await api.get(url);
	return data;
};

export const updateRiskAlertConfig = async (paylaod: RiskAlertConfigBody) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/risk-alerts/configs`;
	const { data } = await api.patch(url, paylaod);
	return data;
};

export const getRiskAlertNotifications = async (
	customerId: string,
	businessId: string,
	params: {
		pagination: boolean;
		time_zone: string;
	},
): Promise<GetRiskAlertsResponse> => {
	const url: string = `${MICROSERVICE.CASE}/risk-alerts/customers/${customerId}/businesses/${businessId}`;
	const { data } = await api.get(url, {
		params,
	});
	return data;
};

export const getCustomerIntegrationSettingsByCustomerId = async (
	customerId: string,
): Promise<CustomerIntegrationSettingsResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/customer-integration-settings/${customerId}`,
	);
	return data;
};

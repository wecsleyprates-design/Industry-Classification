import { api } from "@/lib/api";
import {
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

export const updateRiskAlertConfig = async (payload: RiskAlertConfigBody) => {
	const url: string = `${MICROSERVICE.INTEGRATION}/risk-alerts/configs`;
	const { data } = await api.patch(url, payload);
	return data;
};

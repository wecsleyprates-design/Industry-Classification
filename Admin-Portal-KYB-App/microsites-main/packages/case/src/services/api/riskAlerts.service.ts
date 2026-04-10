import { api } from "@/lib/api";
import { type RiskAlertConfigurationResponse } from "@/types/riskAlert";

import MICROSERVICE from "@/constants/Microservices";

export const getRiskAlertConfig = async (
	customerId: string,
): Promise<RiskAlertConfigurationResponse> => {
	const url: string = `${MICROSERVICE.INTEGRATION}/risk-alerts/customers/${customerId}/configs`;
	const { data } = await api.get(url);
	return data;
};

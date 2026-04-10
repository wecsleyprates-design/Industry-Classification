import { api } from "@/lib/api";
import {
	type DecisioningConfigurationResponse,
	type UpdateDecisioningConfigurationPayload,
} from "@/types/decisioning";

import MICROSERVICE from "@/constants/Microservices";

export const getDecisioningConfiguration = async (
	customerId: string,
): Promise<DecisioningConfigurationResponse> => {
	// Default value: "worth_score" if no configuration exists.
	const url: string = `${MICROSERVICE.CASE}/case-decisioning/customers/${customerId}/configuration`;
	const { data } = await api.get(url);
	return data;
};

export const updateDecisioningConfiguration = async (
	payload: UpdateDecisioningConfigurationPayload,
): Promise<DecisioningConfigurationResponse> => {
	const url: string = `${MICROSERVICE.CASE}/case-decisioning/customers/${payload.customer_id}/configuration`;
	const { data } = await api.patch(url, {
		decisioning_type: payload.decisioning_type,
	});
	return data;
};

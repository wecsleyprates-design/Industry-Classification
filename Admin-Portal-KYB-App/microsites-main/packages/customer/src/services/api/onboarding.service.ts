import { api } from "@/lib/api";
import {
	type GetOnboardingSetupResponse,
	type UpdateOnboardingPayload,
} from "@/types/onboarding";

import { MICROSERVICE } from "@/constants";

export const getOnboardingSetup = async (
	customerId: string,
): Promise<GetOnboardingSetupResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding-setups`,
	);
	return data;
};

export const updateOnboardingSetup = async (
	payload: UpdateOnboardingPayload,
): Promise<{ message: string }> => {
	const { customerId, body } = payload;
	const { data } = await api.patch(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding-setups`,
		body,
	);
	return data;
};

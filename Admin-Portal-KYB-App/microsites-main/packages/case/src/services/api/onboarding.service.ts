import { api } from "@/lib/api";
import {
	type GetAllStagesResponse,
	type GetCustomerOnboardingStagesResponse,
} from "@/types/onboarding";

import MICROSERVICE from "@/constants/Microservices";

export const getCustomerOnboardingStages = async (
	customerId: string,
	params: Record<string, any>,
): Promise<GetCustomerOnboardingStagesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/customer-onboarding-stages`,
		{ params },
	);
	return data;
};

export const getAllStagesForCustomer = async (
	customerId: string,
): Promise<GetAllStagesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/stages`,
	);
	return data;
};

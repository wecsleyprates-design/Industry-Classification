// import axios from "axios";
import { api } from "@/lib/api";
import {
	type GetAllStagesResponse,
	type GetCustomerCountriesResponse,
	type GetCustomerOnboardingStagesResponse,
	type GetOnboardingSetupResponse,
} from "@/types/onboarding";

import MICROSERVICE from "@/constants/Microservices";

export const getOnboardingSetup = async (
	customerId: string,
): Promise<GetOnboardingSetupResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding-setups`,
	);
	return data;
};

export const getCustomerOnboardingStages = async (
	customerId: string,
	params: Record<string, any>,
): Promise<GetCustomerOnboardingStagesResponse> => {
	// TEMP CHANGE FOR DEV TESTING ONLY
	// const { data } = await axios.get("http://localhost:3000/pages");

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

export const getCustomerCountries = async (
	customerId: string,
	setupId: number,
): Promise<GetCustomerCountriesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding-setups/${setupId}/countries`,
	);
	return data;
};

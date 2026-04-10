import { useQuery } from "@tanstack/react-query";
import {
	getAllStagesForCustomer,
	getCustomerCountries,
	getCustomerOnboardingStages,
	getOnboardingSetup,
} from "../api/onboarding.service";

export const useGetOnboardingSetup = (customerId: string) =>
	useQuery({
		queryKey: ["getOnboardingSetup", customerId],
		queryFn: async () => {
			const res = await getOnboardingSetup(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useGetCustomerOnboardingStages = (
	customerId: string,
	params: Record<string, any>,
) =>
	useQuery({
		queryKey: ["getOnboardingStages", customerId, params],
		queryFn: async () => {
			const res = await getCustomerOnboardingStages(customerId, params);
			return res;
		},
		enabled: !!customerId,
	});

export const useGetAllStagesForCustomer = (customerId: string) =>
	useQuery({
		queryKey: ["getAllStages", customerId],
		queryFn: async () => {
			const res = await getAllStagesForCustomer(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useGetCustomerCountries = (customerId: string, setupId: number) =>
	useQuery({
		queryKey: ["getCustomerCountries", customerId, setupId],
		queryFn: async () => {
			const res = await getCustomerCountries(customerId, setupId);
			return res;
		},
		enabled: !!customerId && !!setupId,
	});

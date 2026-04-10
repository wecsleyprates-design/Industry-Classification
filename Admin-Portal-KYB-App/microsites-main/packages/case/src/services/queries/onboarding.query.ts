import { useQuery } from "@tanstack/react-query";
import {
	getAllStagesForCustomer,
	getCustomerOnboardingStages,
} from "@/services/api/onboarding.service";

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

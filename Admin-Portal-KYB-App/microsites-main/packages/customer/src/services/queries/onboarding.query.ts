import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type GetOnboardingSetupResponse,
	type UpdateOnboardingPayload,
} from "@/types/onboarding";
import {
	getOnboardingSetup,
	updateOnboardingSetup,
} from "../api/onboarding.service";

export const useGetOnboardingSetup = (customerId: string) =>
	useQuery<GetOnboardingSetupResponse>({
		queryKey: ["getOnboardingSetup", customerId],
		queryFn: async () => {
			const res = await getOnboardingSetup(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateOnboardingSetup = () =>
	useMutation<{ message: string }, Error, UpdateOnboardingPayload>({
		mutationKey: ["updateOnboardingSetup"],
		mutationFn: async (payload: UpdateOnboardingPayload) => {
			const res = await updateOnboardingSetup(payload);
			return res;
		},
	});

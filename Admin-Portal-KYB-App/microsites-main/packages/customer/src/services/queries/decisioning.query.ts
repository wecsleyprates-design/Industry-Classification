import { useMutation, useQuery } from "@tanstack/react-query";
import type { UpdateDecisioningConfigurationPayload } from "@/types/decisioning";
import {
	getDecisioningConfiguration,
	updateDecisioningConfiguration,
} from "../api/decisioning.service";

export const useGetDecisioningConfiguration = (customerId: string) =>
	useQuery({
		queryKey: ["getDecisioningConfiguration", customerId],
		queryFn: async () => await getDecisioningConfiguration(customerId),
		enabled: !!customerId,
		retry: 1,
	});

export const useUpdateDecisioningConfiguration = () =>
	useMutation({
		mutationKey: ["updateDecisioningConfiguration"],
		mutationFn: async (payload: UpdateDecisioningConfigurationPayload) => {
			const res = await updateDecisioningConfiguration(payload);
			return res;
		},
	});

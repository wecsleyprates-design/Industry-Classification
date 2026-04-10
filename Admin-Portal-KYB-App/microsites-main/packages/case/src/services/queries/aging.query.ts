import { useMutation, useQuery } from "@tanstack/react-query";
import { type BusinessApplicantConfigResponseDataConfig } from "@/types/aging";
import {
	getBusinessApplicantConfig,
	getCustomerApplicantConfig,
	postBusinessApplicantConfig,
	updateBusinessApplicantConfig,
} from "../api/aging.service";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export const useGetBusinessApplicantConfig = (businessId: string) => {
	return useQuery({
		queryKey: ["getBusinessApplicantConfig", businessId],
		queryFn: async () => {
			return await getBusinessApplicantConfig(businessId);
		},
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
	});
};

export const useGetCustomerApplicantConfig = (customerId: string) => {
	return useQuery({
		queryKey: ["getCustomerApplicantConfig", customerId],
		queryFn: async () => {
			return await getCustomerApplicantConfig(customerId);
		},
		enabled: !!customerId,
	});
};

export const usePostBusinessApplicantConfig = () => {
	return useMutation({
		mutationKey: ["postBusinessApplicantConfig"],
		mutationFn: async ({
			businessId,
			payload,
		}: {
			businessId: string;
			payload: { is_enabled: boolean };
		}) => await postBusinessApplicantConfig(businessId, payload),
	});
};

export const useUpdateBusinessApplicantConfig = () => {
	return useMutation({
		mutationKey: ["updateBusinessApplicantConfig"],
		mutationFn: async ({
			businessId,
			payload,
		}: {
			businessId: string;
			payload: BusinessApplicantConfigResponseDataConfig[];
		}) => await updateBusinessApplicantConfig(businessId, payload),
	});
};

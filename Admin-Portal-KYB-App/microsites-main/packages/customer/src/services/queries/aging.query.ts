import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type ApplicantConfigBody,
	type ApplicantDaysConfigBody,
	type CustomerApplicantConfigResponse,
} from "@/types/agingThreshold";
import {
	getCustomerApplicantConfig,
	updateCustomerApplicantConfig,
	updateCustomerApplicantDaysConfig,
} from "../api/aging.service";

export const useGetCustomerApplicantConfig = (customerId: string) =>
	useQuery<CustomerApplicantConfigResponse>({
		queryKey: ["getCustomerApplicantConfig", customerId],
		queryFn: async () => {
			const res = await getCustomerApplicantConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateCustomerApplicantConfig = () =>
	useMutation({
		mutationKey: ["updateCustomerApplicantConfig"],
		mutationFn: async (payload: ApplicantConfigBody) => {
			const res = await updateCustomerApplicantConfig(payload);
			return res;
		},
	});

export const useUpdateCustomerApplicantDaysConfig = () =>
	useMutation({
		mutationKey: ["updateCustomerApplicantDaysConfig"],
		mutationFn: async (payload: ApplicantDaysConfigBody) => {
			const res = await updateCustomerApplicantDaysConfig(payload);
			return res;
		},
	});

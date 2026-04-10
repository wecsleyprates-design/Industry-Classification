import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type RiskAlertConfigBody,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";
import {
	getRiskAlertConfig,
	updateRiskAlertConfig,
} from "../api/riskAlert.service";

export const useGetRiskAlertConfig = (customerId: string) =>
	useQuery<RiskAlertConfigurationResponse>({
		queryKey: ["getRiskAlertConfig", customerId],
		queryFn: async () => {
			const res = await getRiskAlertConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateRiskAlertConfig = () =>
	useMutation({
		mutationKey: ["updateRiskAlertConfig"],
		mutationFn: async (payload: RiskAlertConfigBody) => {
			const res = await updateRiskAlertConfig(payload);
			return res;
		},
	});

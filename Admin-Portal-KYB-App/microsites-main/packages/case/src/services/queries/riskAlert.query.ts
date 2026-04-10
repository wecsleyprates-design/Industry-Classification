import { useQuery } from "@tanstack/react-query";
import { getRiskAlertConfig } from "../api/riskAlerts.service";

export const useGetRiskAlertConfig = (customerId: string) =>
	useQuery({
		queryKey: ["getRiskAlertConfig", customerId],
		queryFn: async () => {
			const res = await getRiskAlertConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

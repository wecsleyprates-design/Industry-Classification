import { useMutation, useQuery } from "@tanstack/react-query";
import { type RiskAlertConfigBody } from "@/types/riskAlerts";
import {
	getCustomerIntegrationSettingsByCustomerId,
	getRiskAlertConfig,
	getRiskAlertNotifications,
	updateRiskAlertConfig,
} from "../api/riskAlert.service";

export const useGetRiskAlertConfig = (customerId: string) =>
	useQuery({
		queryKey: ["getRiskAlertConfig", customerId],
		queryFn: async () => {
			const res = await getRiskAlertConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useUpdateRiskAlertConfig = () =>
	useMutation({
		mutationFn: async (paylaod: RiskAlertConfigBody) => {
			const res = await updateRiskAlertConfig(paylaod);
			return res;
		},
	});

export const useGetRiskAlertNotifications = (
	customerId: string,
	businessId: string,
	params: {
		pagination: boolean;
		time_zone: string;
	},
) =>
	useQuery({
		queryKey: [`getRiskAlertNotifications`, businessId, customerId],
		queryFn: async () => {
			const res = await getRiskAlertNotifications(
				customerId,
				businessId,
				params,
			);
			return res;
		},
		enabled: !!(businessId && customerId),
	});

export const useGetCustomerIntegrationSettingsByCustomerId = (
	customerId: string,
	refetch: boolean = true,
) =>
	useQuery({
		queryKey: ["useGetCustomerIntegrationSettingsByCustomerId", customerId],
		queryFn: async () => {
			const res = await getCustomerIntegrationSettingsByCustomerId(customerId);
			return res;
		},
		retry: 1,
		refetchOnWindowFocus: refetch,
		enabled: !!customerId,
	});

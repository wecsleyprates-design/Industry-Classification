import { useQuery } from "@tanstack/react-query";
import {
	type AverageWorthScoreResponse,
	type BusinessesScoreStatsResponse,
	type CaseInProgressResponse,
	type CasesByApprovalStatusResponse,
	type CustomerPortfolioResponse,
	type IndustryExposureResponse,
	type RiskAlertsStats,
	type TeamPerformanceStats,
	type TimeToApprovalResponse,
	type TotalApplicationStatsResponse,
} from "@/lib/types";
import {
	getAverageWorthScore,
	getBusinessesScoreStats,
	getCaseInProgress,
	getCasesByApprovalstatus,
	getCustomerPortfolio,
	getCustomerUsers,
	getIndustryExposureData,
	getIndustryList,
	type GetIndustryResponse,
	getReceivedApprovedStats,
	getRiskAlertsStats,
	getTeamPerformanceStats,
	getTimeToApproval,
	getTotalApplicationStats,
	type IGetCustomerUsersApiResponse,
	type ReceivedApprovedStatsParams,
	type ReceivedApprovedStatsResponse,
} from "@/services/api/dashboard.service";

import { type TimeFilterPeriod } from "@/ui/cro";

export const useGetCasesByApprovalstatus = (customerId: string) =>
	useQuery<CasesByApprovalStatusResponse>({
		queryKey: ["getCasesByApprovalstatus", customerId],
		queryFn: async () => {
			const res = await getCasesByApprovalstatus(customerId);
			return res;
		},
	});

export const useGetCaseInProgress = (customerId: string) =>
	useQuery<CaseInProgressResponse>({
		queryKey: ["GetCaseInProgress", customerId],
		queryFn: async () => {
			const res = await getCaseInProgress(customerId);
			return res;
		},
	});

export const useGetAverageWorthScore = (customerId: string) =>
	useQuery<AverageWorthScoreResponse>({
		queryKey: ["getAverageWorthScore", customerId],
		queryFn: async () => {
			const res = await getAverageWorthScore(customerId);
			return res;
		},
	});

export const useGetBusinessesScoreStats = (customerId: string) =>
	useQuery<BusinessesScoreStatsResponse>({
		queryKey: ["getBusinessesScoreStats", customerId],
		queryFn: async () => {
			const res = await getBusinessesScoreStats(customerId);
			return res;
		},
	});

export const useGetIndustryExposureData = (customerId: string) =>
	useQuery<IndustryExposureResponse>({
		queryKey: ["getIndustryExposureData", customerId],
		queryFn: async () => {
			const res = await getIndustryExposureData(customerId);
			return res;
		},
	});

export const useGetCustomerPortfolio = (payload: {
	customerId: string;
	period?: Date;
}) =>
	useQuery<CustomerPortfolioResponse>({
		queryKey: ["getCustomerPortfolio", payload],
		queryFn: async () => {
			const res = await getCustomerPortfolio(payload);
			return res;
		},
	});

export const useRiskAlertStats = (payload: {
	customerId: string;
	params?: Record<string, any>;
}) =>
	useQuery<RiskAlertsStats>({
		queryKey: ["getRiskAlertsStats", payload],
		queryFn: async () => {
			const res = await getRiskAlertsStats(payload);
			return res;
		},
	});

export const useGetTeamPerformanceStats = (customerId: string) =>
	useQuery<TeamPerformanceStats>({
		queryKey: ["getTeamPerformanceStats", customerId],
		queryFn: async () => {
			const res = await getTeamPerformanceStats({ customerId });
			return res;
		},
	});

export const useGetTimeToApproval = (
	customerId: string,
	params: {
		period: TimeFilterPeriod;
		industries?: string[];
		assignees?: string[];
	},
) =>
	useQuery<TimeToApprovalResponse>({
		queryKey: [
			"getTimeToApproval",
			customerId,
			params.period,
			params.industries,
			params.assignees,
		],
		queryFn: async () => {
			const res = await getTimeToApproval({
				customerId,
				period: params.period,
				industries: params.industries,
				assignees: params.assignees,
			});
			return res;
		},
	});

export const useGetTotalApplicationStats = (
	customerId: string,
	params: {
		period: TimeFilterPeriod;
		industries?: string[];
		assignees?: string[];
		teamPerformance?: boolean;
	},
) =>
	useQuery<TotalApplicationStatsResponse>({
		queryKey: [
			"getTotalApplicationStats",
			customerId,
			params.period,
			params.assignees,
			params.industries,
			params.teamPerformance,
		],
		queryFn: async () => {
			const res = await getTotalApplicationStats({
				customerId,
				period: params.period,
				industries: params.industries,
				assignees: params.assignees,
				teamPerformance: params.teamPerformance,
			});
			return res;
		},
	});

export const useGetReceivedApprovedStats = (
	customerId: string,
	params: ReceivedApprovedStatsParams,
) =>
	useQuery<ReceivedApprovedStatsResponse>({
		queryKey: [
			"getReceivedApprovedStats",
			customerId,
			params?.filterDate,
			params?.industries,
			params?.assignees,
		],
		queryFn: async () => {
			const res = await getReceivedApprovedStats({ customerId, ...params });
			return res;
		},
		enabled: !!customerId && !!params?.filterDate,
	});

export const useGetIndustryList = () =>
	useQuery<GetIndustryResponse>({
		queryKey: ["getIndustry"],
		queryFn: async () => {
			const res = await getIndustryList();
			return res;
		},
		retry: 3,
	});

export const useGetUsers = (
	customerId: string,
	params: string,
	enabled: boolean = true,
) =>
	useQuery<IGetCustomerUsersApiResponse>({
		queryKey: ["getUsers", customerId, params, enabled],
		queryFn: async () => {
			const res = await getCustomerUsers({ customerId, params });
			return res;
		},
		enabled: !!customerId && enabled,
	});

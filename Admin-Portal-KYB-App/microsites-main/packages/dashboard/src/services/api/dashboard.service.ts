import dayjs from "dayjs";
import queryString from "query-string";
import { api } from "@/lib/api";
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

import MICROSERVICE from "@/constants/Microservices";
import { type TimeFilterPeriod } from "@/ui/cro";

export const getCasesByApprovalstatus = async (
	customerId: string,
): Promise<CasesByApprovalStatusResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/decision-stats`,
	);
	return data;
};

export const getCaseInProgress = async (
	customerId: string,
): Promise<CaseInProgressResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/decision-stats`,
		{
			params: {
				require_in_progress_stats: true,
			},
		},
	);
	return data;
};

export const getAverageWorthScore = async (
	customerId: string,
): Promise<AverageWorthScoreResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/average-score-stats`,
	);
	return data;
};

export const getBusinessesScoreStats = async (
	customerId: string,
): Promise<BusinessesScoreStatsResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/businesses/score-stats`,
	);
	return data;
};

export const getIndustryExposureData = async (
	customerId: string,
): Promise<IndustryExposureResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/industry-exposure`,
	);
	return data;
};

export const getCustomerPortfolio = async (payload: {
	customerId: string;
	period?: Date;
}): Promise<CustomerPortfolioResponse> => {
	const { customerId, period } = payload;

	const params = period
		? queryString.stringify({
				period: dayjs(period).utc().get("year").toString(),
			})
		: "";

	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/portfolio${
			params ? `?${params}` : ""
		}`,
	);
	return data;
};

export const getRiskAlertsStats = async (payload: {
	customerId: string;
	params?: any;
}): Promise<RiskAlertsStats> => {
	const { customerId, params } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.INTEGRATION}/risk-alerts/customers/${customerId}/reasons/stat`,
		{
			params,
		},
	);
	return data;
};

export const getTeamPerformanceStats = async (payload: {
	customerId: string;
}): Promise<TeamPerformanceStats> => {
	const { customerId } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/team-performance/stats`,
	);
	return data;
};

export const getTimeToApproval = async (payload: {
	customerId: string;
	period: TimeFilterPeriod;
	industries?: string[];
	assignees?: string[];
}): Promise<TimeToApprovalResponse> => {
	const { customerId, period, industries, assignees } = payload;
	const params = {
		filter_date: {
			period,
		},
		filter: {
			"db.industry": industries,
			"dc.assignee": assignees,
		},
	};

	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/time-to-approval`,
		{
			params,
		},
	);
	return data;
};

export const getTotalApplicationStats = async (payload: {
	customerId: string;
	period: TimeFilterPeriod;
	industries?: string[];
	assignees?: string[];
	teamPerformance?: boolean;
}): Promise<TotalApplicationStatsResponse> => {
	const { customerId, period, industries, assignees, teamPerformance } =
		payload;
	const params = {
		filter_date: {
			period,
		},
		filter: {
			"db.industry": industries,
			"dc.assignee": assignees,
		},
		team_performance: !!teamPerformance,
	};

	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/total-application-stats`,
		{
			params,
		},
	);
	return data;
};

export interface FilterDate {
	period: "DAY" | "WEEK" | "MONTH" | "YEAR";
	timezone?: string;
	last?: number;
	interval?: number;
}

export interface ReceivedApprovedStatsResponse {
	data: {
		data: {
			application_count: number;
			percentage_change: number;
			chart_data: Array<{
				label:
					| "ONBOARDING"
					| "UNDER_MANUAL_REVIEW"
					| "MANUALLY_APPROVED"
					| "MANUALLY_REJECTED"
					| "AUTO_APPROVED"
					| "SCORE_CALCULATED"
					| "ARCHIVED"
					| "SUBMITTED"
					| "AUTO_REJECTED"
					| "INFORMATION_REQUESTED"
					| "RISK_ALERT"
					| "INVESTIGATING"
					| "DISMISSED"
					| "ESCALATED"
					| "PAUSED"
					| "INFORMATION_UPDATED";
				percentage: number;
				current: {
					count: number;
					period: string; // date
				};
				previous: {
					count: number;
					period: string; // date
				};
			}>;
		};
	};
}

// const buildQueryParams = (
// 	params: Record<string, string | number | undefined>
// ): string => {
// 	const searchParams = new URLSearchParams();

// 	Object.entries(params).forEach(([key, value]) => {
// 		if (value !== undefined) {
// 			searchParams.append(key, value.toString());
// 		}
// 	});

// 	return decodeURIComponent(searchParams.toString());
// };

export interface ReceivedApprovedStatsParams {
	filterDate: FilterDate;
	industries?: string[];
	assignees?: string[];
}

// /customers/:customerID/dashboard/applications/stats/received-approved
export const getReceivedApprovedStats = async (
	payload: {
		customerId: string;
	} & ReceivedApprovedStatsParams,
): Promise<ReceivedApprovedStatsResponse> => {
	const { customerId, filterDate, industries, assignees } = payload;

	const params = {
		filter_date: {
			period: filterDate.period,
			timezone: filterDate.timezone,
			last: filterDate.last,
			interval: filterDate.interval,
		},
		filter: {
			"db.industry": industries,
			"dc.assignee": assignees,
		},
	};

	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/dashboard/applications/stats/received-approved`,
		{
			params,
		},
	);
	return data;
};

export interface GetIndustryResponse {
	status: string;
	message: string;
	data: GetIndustryData;
}

export interface GetIndustryData {
	records: Industry[];
}

export interface Industry {
	value: string;
	label: string;
	id: string;
	name: string;
	code: string;
	sector_code: string;
	created_at: Date;
	updated_at: Date;
}

export const getIndustryList = async (): Promise<GetIndustryResponse> => {
	const response = await api.get(
		`${MICROSERVICE.CASE}/core/business-industries`,
	);
	return response.data;
};

export interface IGetCustomerUsersApiResponse {
	status: string;
	message: string;
	data: GetCustomerUserData;
}

export interface UserData {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile?: string;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	is_tc_accepted: boolean;
	tc_accepted_at?: string;
	ext_auth_ref_id: string;
	status: "INVITE_EXPIRED" | "ACTIVE" | "INACTIVE" | "INVITED";
	subrole: {
		id: string;
		code: string;
		display_name: string;
		label: string;
		description: string;
	};
}
export interface GetCustomerUserData {
	records: UserData[]; // Array<Record<string, unknown>>,
	total_pages: number;
	total_items: number;
}
export interface IResendUserInvite {
	customerId: string;
	userId: string;
}
export interface IGetUsersRequest {
	customerId: string;
	params: string;
	// userId: string;
}
export const getCustomerUsers = async (
	payload: IGetUsersRequest,
): Promise<IGetCustomerUsersApiResponse> => {
	const { customerId, params } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.AUTH}/customers/${customerId}/users?${params}`,
	);
	return data;
};

import { useMutation, useQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import {
	createBusinesses,
	getAllBusinesses,
	getBusinessApplicants,
	getBusinessById,
	getBusinessCases,
	getBusinessInvites,
	getBusinessOwners,
	getCustomerBusinessCases,
	getInviteById,
	getOwnerApplicant,
	getRelatedBusinesses,
	getScoreTrendChart,
	getStandaloneCaseByCaseId,
	getWorthScore,
	getWorthScoreDate,
	resendBusinessInvite,
	sentInvitation,
	updateRiskMonitoring,
} from "@/services/api/businesses.service";
import {
	type IGetBusinessCases,
	type NewBusinessPayload,
	type ResendBusinessInvite,
	type UpdateRiskMonitoring,
} from "@/types/business";
import { type SendInvitationPayload } from "@/types/case";
import { type GetAllBusinessesPayload, type IPayload } from "@/types/common";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export const useGetBusinesses = (payload: GetAllBusinessesPayload) =>
	useQuery({
		queryKey: ["getAllBusinesses", payload],
		queryFn: async () => {
			const res = await getAllBusinesses(payload);
			return res;
		},
	});

export const useGetBusinessById = (payload: {
	businessId: string;
	fetchOwnerDetails?: boolean;
}) => {
	const { businessId, fetchOwnerDetails } = payload;
	return useQuery({
		queryKey: ["getBusinessById", businessId, fetchOwnerDetails],
		queryFn: async () => {
			const res = await getBusinessById(payload);
			return res;
		},
		retry: 1,
	});
};

export const useGetBusinessCasesQuery = (payload: IGetBusinessCases) => {
	const { businessId, platformType } = payload;

	return useQuery({
		queryKey: ["getBusinessApplicantCases", payload],
		queryFn: async () => {
			if (platformType === "admin") {
				return await getBusinessCases(payload);
			} else {
				return await getCustomerBusinessCases(payload);
			}
		},
		enabled: !!businessId,
	});
};

export const useGetCaseByIdQuery = (caseId: string, queryParams?: IPayload) => {
	return useQuery({
		queryKey: ["getCaseByCaseId", caseId],
		queryFn: async () => {
			const res = await getStandaloneCaseByCaseId(caseId, queryParams);
			return res;
		},
		enabled: !!caseId,
		retry: 1,
	});
};

export const useGetWorthScore = (payload: {
	businessId: string;
	customerId: string;
	month: string;
	year: string;
	scoreTriggerId?: string;
}) =>
	useQuery({
		queryKey: ["worth_score", payload],
		queryFn: async () => await getWorthScore(payload),
		enabled: !!payload.businessId,
	});

export const useGetWorthScoreDate = (
	businessId: string,
	params?: Record<string, any>,
) =>
	useQuery({
		queryKey: ["worth_score_date", businessId, params],
		queryFn: async () => await getWorthScoreDate(businessId, params),
		enabled: !!businessId && businessId !== "",
	});

export const useGetScoreTrendChart = (
	businessId: string,
	params?: { year: number },
) =>
	useQuery({
		queryKey: ["get_score_trend_chart", businessId, params],
		queryFn: async () => await getScoreTrendChart(businessId, params),
		enabled: !!businessId,
	});

export const useSendInvitation = () =>
	useMutation({
		mutationKey: ["sendInvitation"],
		mutationFn: async (body: SendInvitationPayload) => {
			const res = await sentInvitation(body);
			return res;
		},
	});

export const useGetApplicant = (customerId: string, businessId: string) =>
	useQuery({
		queryKey: ["getApplicants", businessId],
		queryFn: async () => {
			const res = await getBusinessApplicants(customerId, businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetBusinessInvites = (
	customerId: string,
	businessId: string,
	params: string,
) =>
	useQuery({
		queryKey: ["getBusinessInvites", businessId, customerId, params],
		queryFn: async () => {
			const res = await getBusinessInvites(
				customerId,
				businessId,
				params,
			);
			return res;
		},
		enabled: !!businessId && !!customerId,
	});

export const useGetInviteById = (parmas: string) =>
	useQuery({
		queryKey: ["getInvitesById", parmas],
		queryFn: async () => {
			const res = await getInviteById(parmas);
			return res;
		},

		retry: 1,
	});

export const useResendBusinessInviteQuery = () =>
	useMutation({
		mutationKey: ["resendBusinessInvite"],
		mutationFn: async (body: ResendBusinessInvite) => {
			const res = await resendBusinessInvite(body);
			return res;
		},
	});

export const useUpdateRiskMonitoring = () =>
	useMutation({
		mutationKey: ["updateRiskMonitoring"],
		mutationFn: async (payload: UpdateRiskMonitoring) => {
			const res = await updateRiskMonitoring(payload);
			return res;
		},
	});

export const useCreateBusiness = () =>
	useMutation({
		mutationKey: ["createBusiness"],
		mutationFn: async (payload: NewBusinessPayload) => {
			const res = await createBusinesses(payload);
			return res;
		},
	});

export const useGetBusinessOwners = (businessId: string) =>
	useQuery({
		queryKey: ["getBusinessOwners", businessId],
		queryFn: async () => {
			const res = await getBusinessOwners(businessId);
			return res;
		},
		retry: 1,
	});

export const useGetOwnerApplicant = (businessId: string) =>
	useQuery({
		queryKey: ["getOwnerApplicant", businessId],
		queryFn: async () => {
			const res = await getOwnerApplicant(businessId);
			return res;
		},

		retry: false,
		refetchOnMount: true,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		enabled: !!businessId && businessId !== VALUE_NOT_AVAILABLE,
	});

export const useGetRelatedBusinesses = (
	customerId: string,
	businessId: string,
	params?: string,
) => {
	const hasAccess = usePermission("businesses:read");
	return useQuery({
		queryKey: ["getRelatedBusinesses", customerId, businessId, params],
		queryFn: async () =>
			await getRelatedBusinesses(customerId, businessId, params),
		enabled: !!customerId && !!businessId && hasAccess,
	});
};

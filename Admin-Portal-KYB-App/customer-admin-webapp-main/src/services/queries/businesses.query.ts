import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type GetRelatedBusienssesPayload,
	type IGetBusinessCases,
	type NewBusinessPayload,
	type ResendBusinessInvite,
	type UpdateRiskMonitoring,
} from "@/types/business";
import { type SendInvitationPayload } from "@/types/case";
import { type GetAllBusinessesPayload, type IPayload } from "@/types/common";
import {
	archiveBusiness,
	createBusinesses,
	getAllBusinesses,
	getAllBusinessesCustom,
	getBusinessApplicants,
	getBusinessById,
	getBusinessCases,
	getBusinessInvites,
	getBusinessOwners,
	getCustomerBusinessConfigs,
	getInviteById,
	getOwnerApplicant,
	getRelatedBusinesses,
	getScoreTrendChart,
	getStandaloneCaseByCaseId,
	getWorthScore,
	getWorthScoreDate,
	purgeBusiness,
	resendBusinessInvite,
	sentInvitation,
	unArchiveBusiness,
	updateRiskMonitoring,
} from "../api/businesses.service";

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
	const { businessId } = payload;
	return useQuery({
		queryKey: ["getBusinessApplicantCases", payload],
		queryFn: async () => {
			const res = await getBusinessCases(payload);
			return res;
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
			const res = await getBusinessInvites(customerId, businessId, params);
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
		mutationFn: async (body: ResendBusinessInvite) => {
			const res = await resendBusinessInvite(body);
			return res;
		},
	});

export const useUpdateRiskMonitoring = () =>
	useMutation({
		mutationFn: async (payload: UpdateRiskMonitoring) => {
			const res = await updateRiskMonitoring(payload);
			return res;
		},
	});

export const useCreateBusiness = () =>
	useMutation({
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

export const usePurgeBusiness = () =>
	useMutation({
		mutationFn: async (businessId: string[]) => {
			const res = await purgeBusiness(businessId);
			return res;
		},
	});

export const useArchiveBusiness = () =>
	useMutation({
		mutationFn: async (businessId: string[]) => {
			const res = await archiveBusiness(businessId);
			return res;
		},
	});

export const useUnArchiveBusiness = () =>
	useMutation({
		mutationFn: async (businessId: string[]) => {
			const res = await unArchiveBusiness(businessId);
			return res;
		},
	});

export const useGetBusinessesCustomFields = (customerId: string) =>
	useQuery({
		queryKey: ["getAllBusinessesCustom", customerId],
		queryFn: async () => {
			const res = await getAllBusinessesCustom(customerId);
			return res;
		},
		retry: false,
	});

export const useGetRelatedBusinesses = (
	businessId: string,
	customerId: string,
	params: GetRelatedBusienssesPayload,
) =>
	useQuery({
		queryKey: ["getRelatedBusinesses", businessId, customerId, params],
		queryFn: async () => {
			const res = await getRelatedBusinesses(businessId, customerId, params);
			return res;
		},
		enabled: !!businessId,
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
		enabled: !!businessId,
	});

export const useGetCustomerBusinessConfigs = (
	customerId: string,
	businessId: string,
) =>
	useQuery({
		queryKey: ["getCustomerBusinessConfigs", customerId, businessId],
		queryFn: async () => {
			const res = await getCustomerBusinessConfigs(customerId, businessId);
			return res;
		},
		enabled: !!customerId && !!businessId,
	});

import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type AddCaseAuditTrailCommentPayload,
	type AdditionalInformationRequest,
	type ArchiveCaseBody,
	type CreateBusinessRequest,
	type CustomerOnboardingInvitePayload,
	type ESignDocumentPayload,
	type GetCaseRequest,
	type GetCasesRequest,
	type RefreshScorePayload,
	type UpdateCase,
} from "@/types/case";
import { type IPayload } from "@/types/common";
import {
	addCaseAuditTrailComment,
	additionalInformationRequest,
	archiveCase,
	createBusiness,
	getCaseByCaseId,
	getCases,
	getCaseStatuses,
	getCaseTypes,
	getCustomerOnboardingInvite,
	getCustomerOnboardingInviteStatus,
	getCustomerOnboardingStages,
	getESignDocument,
	getESignTemplate,
	getOnboardingSetup,
	getWorthScoreByCaseId,
	refreshScore,
	scoreRefreshTime,
	updateCaseByCaseId,
	updateCaseStatus,
} from "../api/case.service";
import { type UpdateCaseByCaseId } from "./../../types/case";

export const useCreateBusinessQuery = () =>
	useMutation({
		mutationFn: async (body: CreateBusinessRequest) => {
			const res = await createBusiness(body);
			return res;
		},
	});

export const useGetCasesQuery = (payload: GetCasesRequest) => {
	const { customerId } = payload;
	return useQuery({
		queryKey: ["getcases", payload],
		queryFn: async () => {
			const res = await getCases(payload);
			return res;
		},
		enabled: !!customerId,
	});
};

export const useGetCaseByIdQuery = (body: GetCaseRequest) => {
	const { caseId } = body;
	return useQuery({
		queryKey: ["getCasebyId", caseId],
		queryFn: async () => {
			const res = await getCaseByCaseId(body);
			return res;
		},
		enabled: !!caseId,
		retry: 1,
	});
};

export const useUpdateCaseByCaseIdQuery = () =>
	useMutation({
		mutationFn: async (body: UpdateCaseByCaseId) => {
			const res = await updateCaseByCaseId(body);
			return res;
		},
	});

export const useGetWorthScoreByCaseId = (
	caseId: string,
	params?: Record<string, any>,
) => {
	return useQuery({
		queryKey: ["getScoreByCaseId", caseId, params],
		queryFn: async () => {
			const res = await getWorthScoreByCaseId(caseId, params);
			return res;
		},
	});
};

export const useGetCaseTypes = (payload: IPayload) =>
	useQuery({
		queryKey: ["getCaseTypes", payload],
		queryFn: async () => {
			const res = await getCaseTypes(payload);
			return res;
		},
	});

export const useUpdateCaseQuery = () =>
	useMutation({
		mutationFn: async (body: UpdateCase) => {
			const res = await updateCaseStatus(body);
			return res;
		},
	});

export const useArchiveCaseQuery = () =>
	useMutation({
		mutationFn: async (body: ArchiveCaseBody) => {
			const res = await archiveCase(body);
			return res;
		},
	});

export const useGetCaseStatuses = () =>
	useQuery({
		queryKey: ["getCaseStatuses"],
		queryFn: async () => {
			const res = await getCaseStatuses();
			return res;
		},
	});

export const useAddCaseAuditTrailComment = () =>
	useMutation({
		mutationFn: async (body: AddCaseAuditTrailCommentPayload) => {
			const res = await addCaseAuditTrailComment(body);
			return res;
		},
	});

export const useScoreRefresh = () =>
	useMutation({
		mutationFn: async (payload: RefreshScorePayload) => {
			const res = await refreshScore(payload);
			return res;
		},
	});

export const useScoreRefreshTime = (businessId: string) =>
	useQuery({
		queryKey: ["scoreRefreshTime"],
		queryFn: async () => {
			const res = await scoreRefreshTime(businessId);
			return res;
		},
		enabled: !!businessId,
	});

export const useGetOnboardingSetup = (customerId: string) =>
	useQuery({
		queryKey: ["getOnboardingSetup", customerId],
		queryFn: async () => {
			const res = await getOnboardingSetup(customerId);
			return res;
		},
		enabled: !!customerId,
	});

export const useGetCustomerOnboardingStages = (
	customerId: string,
	enabled: any,
	params: Record<string, any>,
) =>
	useQuery({
		queryKey: ["getOnboardingStages", customerId, enabled, params],
		queryFn: async () => {
			const res = await getCustomerOnboardingStages(customerId, params);
			return res;
		},
		enabled: !!customerId && enabled === true,
		retry: enabled === undefined,
	});

export const useAdditionalInformationRequest = () =>
	useMutation({
		mutationFn: async (body: AdditionalInformationRequest) => {
			const res = await additionalInformationRequest(body);
			return res;
		},
	});

export const useGetESignDocument = ({
	businessId,
	caseId,
}: ESignDocumentPayload) =>
	useQuery({
		queryKey: ["getESignDocument", businessId, caseId],
		queryFn: async () => {
			const res = await getESignDocument({ businessId, caseId });
			return res;
		},
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!businessId,
	});

export const useGetCustomerOnboardingInvite = () =>
	useMutation({
		mutationFn: async (body: CustomerOnboardingInvitePayload) => {
			const res = await getCustomerOnboardingInvite(body);
			return res;
		},
	});

export const useGetCustomerOnboardingInviteStatus = (
	payload: CustomerOnboardingInvitePayload,
) =>
	useQuery({
		queryKey: [
			"getCustomerOnboardingInviteStatus",
			payload?.caseId,
			payload?.customerId,
		],
		queryFn: async () => {
			const res = await getCustomerOnboardingInviteStatus(payload);
			return res;
		},
	});

export const useGetESignTemplate = (customerId: string) =>
	useQuery({
		queryKey: ["getESignTemplate", customerId],
		queryFn: async () => {
			const res = await getESignTemplate(customerId);
			return res;
		},
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		retry: 0,
	});

import qs from "qs";
import { api } from "@/lib/api";
import {
	type AddCaseAuditTrailCommentPayload,
	type AdditionalInformationRequest,
	type ArchiveCaseBody,
	type CreateBusinessRequest,
	type CustomerOnboardingInvitePayload,
	type CustomerOnboardingInviteResponse,
	type CustomerOnboardingInviteStatusResponse,
	type ESignDocumentPayload,
	type ESignDocumentsResponse,
	type ESignTemplateResponse,
	type GetCaseRequest,
	type GetCaseseByIdResponseBody,
	type GetCasesRequest,
	type GetCustomerOnboardingStagesResponse,
	type GetOnboardingSetupResponse,
	type ICaseApiResponse,
	type RefreshProcessingTime,
	type RefreshScorePayload,
	type UpdateCaseByCaseId,
} from "@/types/case";
import { type IPayload } from "@/types/common";

import MICROSERVICE from "@/constants/Microservices";

export const createBusiness = async (
	payload: CreateBusinessRequest,
): Promise<ICaseApiResponse> => {
	const { body } = payload;
	const url: string = `${MICROSERVICE.AUTH}/businesses`;
	const { data } = await api.post(url, body);
	return data;
};
export const getCases = async (payload: GetCasesRequest) => {
	const { customerId, params } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases${
		params ? `?${qs.stringify(params)}` : ""
	}`;
	const { data } = await api.get(url);
	return data;
};

export const getCaseByCaseId = async (payload: GetCaseRequest) => {
	const { customerId, caseId, params } = payload;
	const url: string = `${
		MICROSERVICE.CASE
	}/customers/${customerId}/cases/${caseId}${
		params ? `?${qs.stringify(params)}` : ""
	}`;
	const { data } = await api.get<GetCaseseByIdResponseBody>(url);
	return data;
};

export const updateCaseByCaseId = async (
	payload: UpdateCaseByCaseId,
): Promise<GetCaseseByIdResponseBody> => {
	const { customerID, caseID, body } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerID}/cases/${caseID}`;
	const { data } = await api.patch(url, body);
	return data;
};

export const getWorthScoreByCaseId = async (
	caseId: string,
	params?: Record<string, any>,
) => {
	const url: string = `${MICROSERVICE.SCORE}/score/cases/${caseId}`;
	const { data } = await api.get(url, { params });
	return data;
};

export const getCaseTypes = async (payload: IPayload) => {
	const url: string = `${MICROSERVICE.CASE}/case-types?${qs.stringify(
		payload,
	)}`;
	const { data } = await api.get(url);
	return data;
};

export const getCaseStatuses = async () => {
	const url: string = `${MICROSERVICE.CASE}/statuses`;
	const { data } = await api.get(url);
	return data;
};

export const updateCaseStatus = async (payload: any): Promise<any> => {
	const { newStatus, caseId, userId } = payload;
	const url: string = `${MICROSERVICE.CASE}/case/updateCase`;
	const { data } = await api.post<any>(url, {
		status: newStatus,
		user_id: userId,
		case_id: caseId,
	});
	return data;
};

export const archiveCase = async (payload: ArchiveCaseBody): Promise<any> => {
	const { customerId, caseId, body } = payload;
	const { data } = await api.patch(
		`${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}`,
		body,
	);
	return data;
};

export const addCaseAuditTrailComment = async (
	payload: AddCaseAuditTrailCommentPayload,
): Promise<any> => {
	const { comment, caseId, file, businessId } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/cases/${caseId}/comment`;
	const requestData: any = {};
	if (comment) {
		requestData.comment = comment;
	}
	if (file) {
		requestData.file = file;
	}
	if (businessId) {
		requestData.business_id = businessId;
	}
	const { data } = await api.post<any>(url, requestData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const refreshScore = async ({
	customerId,
	businessId,
}: RefreshScorePayload) => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/businesses/${businessId}/refresh-score`;
	const { data } = await api.post(url);
	return data;
};

export const scoreRefreshTime = async (
	businessId: string,
): Promise<RefreshProcessingTime> => {
	const url: string = `${MICROSERVICE.CASE}/score/businesses/${businessId}/refresh-processing-time`;
	const { data } = await api.get(url);
	return data;
};

export const getOnboardingSetup = async (
	customerId: string,
): Promise<GetOnboardingSetupResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/onboarding-setups`,
	);
	return data;
};

export const getCustomerOnboardingStages = async (
	customerId: string,
	params: Record<string, any>,
): Promise<GetCustomerOnboardingStagesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/customer-onboarding-stages`,
		{ params },
	);
	return data;
};

export const additionalInformationRequest = async (
	body: AdditionalInformationRequest,
): Promise<any> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${body.customerId}/cases/${body.caseId}/information-request`;
	const { data } = await api.post<any>(url, body.payload);
	return data;
};

export const getESignDocument = async ({
	businessId,
	caseId,
}: ESignDocumentPayload): Promise<ESignDocumentsResponse> => {
	const url: string = `${MICROSERVICE.CASE}/business/${businessId}/esign`;
	const { data } = await api.get(url, { params: { case_id: caseId } });
	return data;
};

export const getCustomerOnboardingInvite = async ({
	customerId,
	caseId,
}: CustomerOnboardingInvitePayload): Promise<CustomerOnboardingInviteResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}/application-edit/invite`;
	const { data } = await api.post(url);
	return data;
};

export const getCustomerOnboardingInviteStatus = async ({
	customerId,
	caseId,
}: CustomerOnboardingInvitePayload): Promise<CustomerOnboardingInviteStatusResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}/application-edit/sessions`;
	const { data } = await api.get(url);
	return data;
};

export const getESignTemplate = async (
	customerId: string,
): Promise<ESignTemplateResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/esign/templates`;
	const { data } = await api.get(url);
	return data;
};

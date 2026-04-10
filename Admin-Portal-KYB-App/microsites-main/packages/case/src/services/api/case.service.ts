import qs from "qs";
import { api } from "@/lib/api";
import { type ApiResponse } from "@/types/api";
import {
	type AdditionalInformationRequestPayload,
	type ArchiveCaseBody,
	type CaseApiResponse,
	type CloneBusinessPayload,
	type CloneBusinessResponse,
	type CreateBusinessRequest,
	type CreateCaseAuditTrailCommentPayload,
	type CustomerApplicantConfigResponse,
	type CustomerOnboardingInvitePayload,
	type CustomerOnboardingInviteResponse,
	type CustomerOnboardingInviteStatusResponse,
	type DecryptSSNPayload,
	type DecryptSSNResponse,
	type exportCasesResponse,
	type GetCaseByIdResponse,
	type GetCaseRequest,
	type GetCasesRequest,
	type GetCasesResponse,
	type GetCaseStatusesResponse,
	type GetCaseTypesResponse,
	type GetCustomerUserResponse,
	type GetCustomerWorkflowsListResponse,
	type GetOnboardingSetupResponse,
	type GetOwnerTitlesResponse,
	type GetWorkflowConditionsRequest,
	type GetWorkflowConditionsResponse,
	type GetWorthScoreByCaseIdResponse,
	type PatchBusinessFactsOverrideRequestPayload,
	type PatchBusinessFactsOverrideResponse,
	type RefreshProcessingTime,
	type RefreshScorePayload,
	type SelectAssigneeUserPayload,
	type SelectAssigneeUserResponse,
	type UpdateCaseByCaseIdRequestPayload,
	type UpdateCustomFieldsRequestPayload,
	type UpdateCustomFieldsResponse,
} from "@/types/case";
import { type IPayload } from "@/types/common";

import MICROSERVICE from "@/constants/Microservices";

export const createBusiness = async (
	payload: CreateBusinessRequest,
): Promise<CaseApiResponse> => {
	const { body } = payload;
	const url: string = `${MICROSERVICE.AUTH}/businesses`;
	const { data } = await api.post(url, body);
	return data;
};
export const getCases = async (
	payload: GetCasesRequest,
): Promise<GetCasesResponse> => {
	const { customerId, params } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases${
		params ? `?${qs.stringify(params)}` : ""
	}`;
	const { data } = await api.get<GetCasesResponse>(url);
	return data;
};

export const getCustomerCaseById = async (
	payload: GetCaseRequest,
): Promise<GetCaseByIdResponse> => {
	const { customerId, caseId, params } = payload;
	const url = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}`;
	const { data } = await api.get(url, { params });
	return data;
};

export const getCaseById = async (payload: GetCaseRequest) => {
	const { caseId, params } = payload;
	const url = `${MICROSERVICE.CASE}/cases/${caseId}`;
	const { data } = await api.get(url, { params });
	return data;
};

export const updateCaseByCaseId = async (
	payload: UpdateCaseByCaseIdRequestPayload,
): Promise<GetCaseByIdResponse> => {
	const { customerId, caseId, body } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}`;
	const { data } = await api.patch(url, body);
	return data;
};

export const getWorthScoreByCaseId = async (
	caseId: string,
	params?: Record<string, any>,
) => {
	const url: string = `${MICROSERVICE.SCORE}/score/cases/${caseId}`;
	const { data } = await api.get<GetWorthScoreByCaseIdResponse>(url, {
		params,
	});
	return data;
};

/**
 * Updates the "values generated at" date for case results (Re-verify Data Now).
 * Stored in the same place as the Worth Score date (score service).
 * PATCH /score/cases/:caseId with body { values_generated_at: ISO8601 }.
 */
export const updateCaseValuesGeneratedAt = async (
	caseId: string,
	valuesGeneratedAt: string,
): Promise<GetWorthScoreByCaseIdResponse> => {
	const url = `${MICROSERVICE.SCORE}/score/cases/${caseId}`;
	const { data } = await api.patch<GetWorthScoreByCaseIdResponse>(url, {
		values_generated_at: valuesGeneratedAt,
	});
	return data;
};

export const getCaseTypes = async (
	payload: IPayload,
): Promise<GetCaseTypesResponse> => {
	const url: string = `${MICROSERVICE.CASE}/case-types?${qs.stringify(
		payload,
	)}`;
	const { data } = await api.get<GetCaseTypesResponse>(url);
	return data;
};

export const getCaseStatuses = async (): Promise<GetCaseStatusesResponse> => {
	const url: string = `${MICROSERVICE.CASE}/statuses`;
	const { data } = await api.get<GetCaseStatusesResponse>(url);
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

export const createCaseAuditTrailComment = async (
	payload: CreateCaseAuditTrailCommentPayload,
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

export const getAllStandaloneCases = async (
	params: IPayload,
): Promise<GetCasesResponse> => {
	const response = await api.get<GetCasesResponse>(
		`${MICROSERVICE.CASE}/cases${params ? `?${qs.stringify(params)}` : ""}`,
	);
	return response.data;
};

export const getStandaloneCaseByCaseId = async (
	caseId: string,
): Promise<GetCaseByIdResponse> => {
	const url: string = `${MICROSERVICE.CASE}/cases/${caseId}`;
	const { data } = await api.get<GetCaseByIdResponse>(url);
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

export const createAdditionalInformationRequest = async (
	payload: AdditionalInformationRequestPayload,
): Promise<any> => {
	const { customerId, caseId, body } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}/information-request`;
	const { data } = await api.post<any>(url, body);
	return data;
};

export const exportCases = async (
	customerId: string,
): Promise<exportCasesResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/export`;
	const { data } = await api.get<any>(url);
	return data;
};

export const createTransactionExportAuditTrail = async (params: {
	caseID: string;
	businessID: string;
}): Promise<any> => {
	const url: string = `${MICROSERVICE.CASE}/cases/${params.caseID}/businesses/${params.businessID}/transactions/export-audit`;
	const { data } = await api.post<any>(url);
	return data;
};

export const getCustomerUsers = async (params: {
	customerId: string;
}): Promise<GetCustomerUserResponse> => {
	const { customerId } = params;

	const queryParams = {
		filter: {
			status: ["ACTIVE"],
		},
		owner_required: true,
		pagination: false,
	};
	const url: string = `${MICROSERVICE.AUTH}/customers/${customerId}/users`;
	const { data } = await api.get(url, {
		params: queryParams,
	});
	return data;
};

export const selectAssigneeUser = async (
	payload: SelectAssigneeUserPayload,
): Promise<SelectAssigneeUserResponse> => {
	const { customerId, caseId, body } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/cases/${caseId}/re-assign`;
	const { data } = await api.patch(url, body);
	return data;
};

export const getDecryptSSN = async (
	payload: DecryptSSNPayload,
): Promise<DecryptSSNResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${payload.customerId}/cases/${payload.caseId}/decrypt-ssn`;
	const { data } = await api.get(url, { params: payload.query });
	return data;
};

export const cloneBusiness = async (
	payload: CloneBusinessPayload,
): Promise<CloneBusinessResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${payload.customerId}/businesses/${payload.businessId}/cases/${payload.caseId}/clone`;
	const { data } = await api.post(url, payload.body);
	return data;
};

export const getCustomerApplicantConfig = async (
	customerId: string,
): Promise<CustomerApplicantConfigResponse> => {
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/applicant-config/1`;
	const { data } = await api.get(url);
	return data;
};

export const patchBusinessFactsOverride = async (
	payload: PatchBusinessFactsOverrideRequestPayload,
): Promise<PatchBusinessFactsOverrideResponse> => {
	const { businessId, overrides } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/override`;
	const { data } = await api.patch<PatchBusinessFactsOverrideResponse>(
		url,
		overrides,
	);
	return data;
};

/**
 * Fetch owner titles from the case management API.
 * @param sort - If true, titles are sorted alphabetically with numbers last
 * @returns List of owner titles with id and title
 */
export const getOwnerTitles = async (
	sort = true,
): Promise<GetOwnerTitlesResponse> => {
	const url = `${MICROSERVICE.CASE}/titles${sort ? "?sort=true" : ""}`;
	const { data } = await api.get<GetOwnerTitlesResponse>(url);
	return data;
};

export const getWorkflowConditions = async (
	payload: GetWorkflowConditionsRequest,
): Promise<GetWorkflowConditionsResponse> => {
	const { caseId } = payload;
	const url = `${MICROSERVICE.WORKFLOW}/audit/executions/latest`;
	const { data } = await api.get<GetWorkflowConditionsResponse>(url, {
		params: { case_id: caseId },
	});
	return data;
};

/**
 * Fetches workflows list for a customer (workflow-service).
 * Used to determine if customer has at least one workflow properly set up (existence, not execution).
 */
export const getCustomerWorkflows = async (
	customerId: string,
): Promise<GetCustomerWorkflowsListResponse> => {
	const url = `${MICROSERVICE.WORKFLOW}/workflows/customers/${customerId}/workflows`;
	const { data } = await api.get<GetCustomerWorkflowsListResponse>(url, {
		params: { items_per_page: 1, page: 1 },
	});
	return data;
};

/**
 * Update custom field values for a case.
 * This endpoint allows internal users (admin, customer) to update custom fields
 * directly from case management (inline editing).
 *
 * Note: This endpoint is now in integration-service following the facts override pattern.
 * The backend automatically fetches caseId and templateId from the businessId.
 */
export interface CurrentTemplateField {
	field_id: string;
	field_code: string;
}

/**
 * Fetch the current template's custom field definitions for a business.
 * Returns only fields that belong to the currently active template.
 */
export const getCurrentTemplateFields = async (
	businessId: string,
): Promise<ApiResponse<CurrentTemplateField[]>> => {
	const url = `${MICROSERVICE.INTEGRATION}/custom-fields/business/${businessId}/override`;
	const { data } = await api.get<ApiResponse<CurrentTemplateField[]>>(url);
	return data;
};

export const updateCustomFields = async (
	payload: UpdateCustomFieldsRequestPayload,
): Promise<UpdateCustomFieldsResponse> => {
	const { businessId, overrides } = payload;
	const url = `${MICROSERVICE.INTEGRATION}/custom-fields/business/${businessId}/override`;
	const { data } = await api.patch<UpdateCustomFieldsResponse>(
		url,
		overrides,
	);
	return data;
};

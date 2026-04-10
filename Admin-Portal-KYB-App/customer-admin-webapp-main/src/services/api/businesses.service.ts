import qs from "qs";
import { api } from "@/lib/api";
import {
	type GetBusinessByIdResponse,
	type IGetBusinessCases,
	type NewBusinessPayload,
	type RelatedBusinessesResponse,
	type ResendBusinessInvite,
	type UpdateRiskMonitoring,
} from "@/types/business";
import {
	type GetCaseseByIdResponseBody,
	type SendInvitationPayload,
} from "@/types/case";
import { type GetAllBusinessesPayload, type IPayload } from "@/types/common";
import {
	type ScoreTrendResponse,
	type WorthScoreDateResponse,
	type WorthScoreWaterfallResponse,
} from "@/types/worthScore";

import { CREATE_BUSINESSES_TIMEOUT } from "@/constants/ConstantValues";
import MICROSERVICE from "@/constants/Microservices";

export const getAllBusinesses = async (payload: GetAllBusinessesPayload) => {
	const { customerId, params } = payload;
	const response = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses${
			params ? `?${qs.stringify(params)}` : ""
		}`,
	);
	return response.data;
};

export const getBusinessById = async (payload: {
	businessId: string;
	fetchOwnerDetails?: boolean;
}): Promise<GetBusinessByIdResponse> => {
	const { businessId, fetchOwnerDetails } = payload;
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/businesses/${businessId}`,
		{
			params: {
				...(fetchOwnerDetails && { fetch_owner_details: fetchOwnerDetails }),
			},
		},
	);
	return data;
};

export const getBusinessCases = async (payload: IGetBusinessCases) => {
	const { businessId, customerID, params } = payload;
	const { data } = await api.get(
		`${
			MICROSERVICE.CASE
		}/customers/${customerID}/businesses/${businessId}/cases?${qs.stringify(
			params,
		)}`,
	);
	return data;
};

export const getStandaloneCaseByCaseId = async (
	caseId: string,
	params?: IPayload,
): Promise<GetCaseseByIdResponseBody> => {
	const url: string = `${MICROSERVICE.CASE}/cases/${caseId}${
		params ? `?${qs.stringify(params)}` : ""
	}`;
	const { data } = await api.get(url);
	return data;
};

export const getWorthScore = async (payload: {
	businessId: string;
	customerId: string;
	month: string;
	year: string;
	scoreTriggerId?: string;
}): Promise<WorthScoreWaterfallResponse> => {
	const { businessId, month, year, scoreTriggerId } = payload;
	const params = {
		...(scoreTriggerId
			? { score_trigger_id: scoreTriggerId }
			: month && year && { month, year }),
	};
	const response = await api.get(
		`${MICROSERVICE.SCORE}/score/business/${businessId}`,
		{
			params,
		},
	);
	return response.data;
};

export const getWorthScoreDate = async (
	businessId: string,
	params?: Record<string, any>,
): Promise<WorthScoreDateResponse> => {
	const response = await api.get(
		`${MICROSERVICE.SCORE}/score/business/${businessId}/date`,
		{ params },
	);
	return response.data;
};

export const getScoreTrendChart = async (
	businessId: string,
	params?: { year: number },
): Promise<ScoreTrendResponse> => {
	const url = `${MICROSERVICE.SCORE}/score/business/${businessId}/score-trend-chart`;
	const { data } = await api.get(url, {
		params,
	});
	return data;
};

export const sentInvitation = async (body: SendInvitationPayload) => {
	const { customerId, payload } = body;
	const response = await api.post(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses/invite`,
		payload,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return response.data;
};

export const getBusinessApplicants = async (
	customerId: string,
	businessId: string,
) => {
	const response = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses/${businessId}/applicants`,
	);

	return response.data;
};

export const getBusinessInvites = async (
	customerId: string,
	businessId: string,
	params: string,
) => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customer/${customerId}/business/${businessId}/invites?${params}`,
	);
	return data;
};

export const getInviteById = async (params: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/business/invitation/details?${params}`,
	);
	return data;
};

export const resendBusinessInvite = async (
	payload: ResendBusinessInvite,
): Promise<any> => {
	const { customerId, businessId, invitationId } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/business/${businessId}/invitations/${invitationId}/resend`;
	const { data } = await api.post<any>(url);
	return data;
};

export const updateRiskMonitoring = async (payload: UpdateRiskMonitoring) => {
	const { customerId, businessId, body } = payload;
	const url: string = `${MICROSERVICE.CASE}/customers/${customerId}/business/${businessId}/monitoring`;
	const { data } = await api.patch(url, body);
	return data;
};

export const createBusinesses = async (payload: NewBusinessPayload) => {
	const { customerId, body, applicantId } = payload;
	const url: string = `${MICROSERVICE.CASE}/businesses/customers/${customerId}/bulk/process/${applicantId}`;
	const { data } = await api.post(url, body, {
		timeout: CREATE_BUSINESSES_TIMEOUT,
	});
	return data;
};

export const getBusinessOwners = async (businessId: string) => {
	const url: string = `${MICROSERVICE.CASE}/businesses/${businessId}/owners`;
	const { data } = await api.get(url);
	return data;
};

export const purgeBusiness = async (businessIds: string[]) => {
	const { data } = await api.post(`${MICROSERVICE.CASE}/businesses/purge`, {
		business_ids: businessIds,
	});
	return data;
};

export const archiveBusiness = async (businessIds: string[]) => {
	const { data } = await api.post(`${MICROSERVICE.CASE}/businesses/archive`, {
		business_ids: businessIds,
	});
	return data;
};

export const unArchiveBusiness = async (businessIds: string[]) => {
	const { data } = await api.post(`${MICROSERVICE.CASE}/businesses/unarchive`, {
		business_ids: businessIds,
	});
	return data;
};

export const getAllBusinessesCustom = async (customerId: string) => {
	const response = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/custom-templates/editable-fields/customer`,
	);
	return response.data;
};

export const getRelatedBusinesses = async (
	businessId: string,
	customerId: string,
	params: IPayload,
): Promise<RelatedBusinessesResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses/${businessId}/related-businesses`,
		{
			params,
		},
	);
	return data;
};

export const getOwnerApplicant = async (businessId: string) => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/businesses/${businessId}/applicant`,
	);
	return data;
};

export const getCustomerBusinessConfigs = async (
	customerId: string,
	businessId: string,
) => {
	const { data } = await api.get(
		`${MICROSERVICE.CASE}/customers/${customerId}/businesses/${businessId}/configs`,
	);
	return data;
};

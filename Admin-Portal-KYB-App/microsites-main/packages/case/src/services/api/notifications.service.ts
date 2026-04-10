import qs from "qs";
import { api } from "@/lib/api";
import { type UpdateCaseAuditTrailCommentPayload } from "@/types/case";
import {
	type GetAuditTrailActionsResponse,
	type GetAuditTrailPayload,
	type GetAuditTrailResponse,
	type GetEmailConfig,
	type UpdateEmailConfigBody,
} from "@/types/notifications";

import MICROSERVICE from "@/constants/Microservices";

export const getEmailConfig = async (
	customerId: string,
): Promise<GetEmailConfig> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/customers/${customerId}/email-config`;
	const { data } = await api.get(url);
	return data;
};

export const updateEmailConfig = async (payload: UpdateEmailConfigBody) => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/email-types/config `;

	const { data } = await api.patch(url, payload);
	return data;
};

export const getAuditTrailActions =
	async (): Promise<GetAuditTrailActionsResponse> => {
		const url: string = `${MICROSERVICE.NOTIFICATION}/core/audit-trail/actions`;
		const { data } = await api.get(url);
		return data;
	};

export const getAuditTrail = async (payload: GetAuditTrailPayload) => {
	const { businessID, params } = payload;
	const response = await api.get<GetAuditTrailResponse>(
		`${MICROSERVICE.NOTIFICATION}/businesses/${businessID}/audit-trails${
			params ? `?${qs.stringify(params)}` : ""
		}`,
	);
	return response.data;
};

export const updateCaseAuditTrailComment = async (
	payload: UpdateCaseAuditTrailCommentPayload,
): Promise<any> => {
	const { caseId, commentId, body } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/cases/${caseId}/comments/${commentId}/comment`;

	const { data } = await api.post<any>(url, body);
	return data;
};

import qs from "qs";
import { api } from "@/lib/api";
import {
	type DownloadReportType,
	type GetCasesRequest,
	type GetCasesResponse,
	type GetCaseTypesResponse,
} from "@/lib/types/case";
import { type ReportStatusType } from "@/lib/types/case";
import { type IPayload } from "@/lib/types/common";

import MICROSERVICE from "@/constants/Microservices";

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

export const getCaseTypes = async (
	payload: IPayload,
): Promise<GetCaseTypesResponse> => {
	const url: string = `${MICROSERVICE.CASE}/case-types?${qs.stringify(
		payload,
	)}`;
	const { data } = await api.get<GetCaseTypesResponse>(url);
	return data;
};

export const generateReport = async (body: {
	customerId: string;
	businessId: string;
	caseId?: string;
}): Promise<ReportStatusType> => {
	const { customerId, businessId, caseId } = body;
	const { data } = await api.post<ReportStatusType>(
		`${MICROSERVICE.REPORT}/reports/customers/${customerId}/businesses/${businessId}`,
		{
			...(caseId ? { case_id: caseId } : {}),
		},
	);
	return data;
};

export const downloadReport = async (
	reportId: string,
): Promise<DownloadReportType> => {
	const { data } = await api.post(
		`${MICROSERVICE.REPORT}/reports/${reportId}/download`,
	);
	return data;
};

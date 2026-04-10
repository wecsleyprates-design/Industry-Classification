import { api } from "@/lib/api";
import {
	type BulkReportStatusResponse,
	type DownloadReportType,
	type GenerateReportRequestBody,
	type ReportStatusType,
} from "@/types/report";

import MICROSERVICE from "@/constants/Microservices";

export const getBusinessReportStatus = async (payload: {
	businessId: string;
	caseId?: string;
}): Promise<ReportStatusType> => {
	const { businessId, caseId } = payload;
	const params = {
		...(caseId ? { case_id: caseId } : {}),
	};
	const { data } = await api.get(
		`${MICROSERVICE.REPORT}/reports/businesses/${businessId}/status`,
		{
			params,
		},
	);
	return data;
};

export const generateCustomerBusinessReportById = async (
	body: GenerateReportRequestBody,
) => {
	const { customerId, businessId, caseId } = body;
	const url = `${MICROSERVICE.REPORT}/reports/customers/${customerId}/businesses/${businessId}`;
	const { data } = await api.post(url, {
		...(caseId ? { case_id: caseId } : {}),
	});
	return data;
};

export const generateBusinessReportById = async (
	body: GenerateReportRequestBody,
) => {
	const { businessId, caseId } = body;
	const url = `${MICROSERVICE.REPORT}/reports/businesses/${businessId}`;
	const { data } = await api.post(url, {
		...(caseId ? { case_id: caseId } : {}),
	});
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

export const getReportsBusinessesBulkGenerateStatus = async (
	businessId: string,
	customerId: string,
): Promise<BulkReportStatusResponse> => {
	const { data } = await api.get(
		`${MICROSERVICE.REPORT}/reports/businesses/${businessId}/bulk-generate/status`,
		{
			params: {
				customer_id: customerId,
			},
		},
	);
	return data;
};

export const postReportsBusinessesBulkGenerate = async (
	businessId: string,
	customerId: string,
) => {
	const { data } = await api.post(
		`${MICROSERVICE.REPORT}/reports/businesses/${businessId}/bulk-generate`,
		{ customer_id: customerId },
	);
	return data;
};

export const getReportsBusinessesBulkDownload = async (
	businessId: string,
	customerId: string,
) => {
	const { data, headers } = await api.get(
		`${MICROSERVICE.REPORT}/reports/businesses/${businessId}/bulk-download`,
		{
			responseType: "blob",
			params: {
				customer_id: customerId,
			},
		},
	);
	// Optional: get filename from header
	const contentDisposition = headers["content-disposition"];
	const match = contentDisposition?.match(/filename="?([^"]+)"?/);
	const fileName =
		match?.[1] ||
		`RelatedBusinessesReports-${new Date().toISOString()}.zip`;

	// Create Blob and download
	const url = window.URL.createObjectURL(new Blob([data]));
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", fileName);
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url); // cleanup
};

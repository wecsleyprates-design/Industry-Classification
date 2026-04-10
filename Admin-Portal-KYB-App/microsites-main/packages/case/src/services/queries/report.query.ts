import { useMutation, useQuery } from "@tanstack/react-query";
import {
	downloadReport,
	generateBusinessReportById,
	generateCustomerBusinessReportById,
	getBusinessReportStatus,
	getReportsBusinessesBulkDownload,
	getReportsBusinessesBulkGenerateStatus,
	postReportsBusinessesBulkGenerate,
} from "@/services/api/report.service";
import { type GenerateReportRequestBody } from "@/types/report";

export const useGetBusinessReportStatus = (body: {
	businessId: string;
	caseId?: string;
}) =>
	useQuery({
		queryKey: ["getBusinessReportStatus", body.businessId, body.caseId],
		queryFn: async () => {
			const res = await getBusinessReportStatus(body);
			return res;
		},
		enabled: !!body && !!body.businessId,
	});

export const useGenerateReport = () => {
	return useMutation({
		mutationKey: ["generateReport"],
		mutationFn: async (body: GenerateReportRequestBody) => {
			const { moduleType } = body;
			if (moduleType === "standalone_case") {
				return await generateBusinessReportById(body);
			} else {
				return await generateCustomerBusinessReportById(body);
			}
		},
	});
};

export const useDownloadReport = () => {
	return useMutation({
		mutationKey: ["downloadReport"],
		mutationFn: async (reportId: string) => {
			const res = await downloadReport(reportId);
			return res;
		},
	});
};

export const useGetReportsBusinessesBulkGenerateStatus = (
	businessId: string,
	customerId: string,
) =>
	useQuery({
		queryKey: [
			"getReportsBusinessesBulkGenerateStatus",
			businessId,
			customerId,
		],
		queryFn: async () =>
			await getReportsBusinessesBulkGenerateStatus(
				businessId,
				customerId,
			),
		enabled: !!businessId && !!customerId,
	});

export const useGetReportsBusinessesBulkDownload = () =>
	useMutation({
		mutationKey: ["getReportsBusinessesBulkDownload"],
		mutationFn: async (payload: {
			businessId: string;
			customerId: string;
		}) => {
			await getReportsBusinessesBulkDownload(
				payload.businessId,
				payload.customerId,
			);
		},
	});

export const usePostReportsBusinessesBulkGenerate = () =>
	useMutation({
		mutationKey: ["postReportsBusinessesBulkGenerate"],
		mutationFn: async (payload: {
			businessId: string;
			customerId: string;
		}) => {
			await postReportsBusinessesBulkGenerate(
				payload.businessId,
				payload.customerId,
			);
		},
	});

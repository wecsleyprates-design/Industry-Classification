import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type DownloadReportType,
	type GetCasesRequest,
	type GetCasesResponse,
	type GetCaseTypesResponse,
	type ReportStatusType,
} from "@/lib/types/case";
import { type IPayload } from "@/lib/types/common";
import {
	downloadReport,
	generateReport,
	getCases,
	getCaseTypes,
} from "../api/case.service";

export const useGetCasesQuery = (payload: GetCasesRequest) => {
	const { customerId } = payload;
	return useQuery<GetCasesResponse>({
		queryKey: ["getcases", payload],
		queryFn: async () => {
			const res = await getCases(payload);
			return res;
		},
		enabled: !!customerId,
	});
};

export const useGetCaseTypes = (payload: IPayload) =>
	useQuery<GetCaseTypesResponse>({
		queryKey: ["getCaseTypes", payload],
		queryFn: async () => {
			const res = await getCaseTypes(payload);
			return res;
		},
	});

export const useGenerateReport = () => {
	return useMutation<
		ReportStatusType,
		Error,
		{
			customerId: string;
			businessId: string;
			caseId?: string;
		}
	>({
		mutationKey: ["generateReport"],
		mutationFn: async (body: {
			customerId: string;
			businessId: string;
			caseId?: string;
		}) => {
			const res = await generateReport(body);
			return res;
		},
	});
};

export const useDownloadReport = () => {
	return useMutation<DownloadReportType, Error, string>({
		mutationKey: ["downloadReport"],
		mutationFn: async (reportId: string) => {
			const res = await downloadReport(reportId);
			return res;
		},
	});
};

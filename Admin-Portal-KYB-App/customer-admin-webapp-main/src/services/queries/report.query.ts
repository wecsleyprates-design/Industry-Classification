import { useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReportStatus, ReportStatusType } from "@/types/report";
import {
	downloadBulkReport,
	downloadReport,
	generateBulkReport,
	generateReport,
	getBulkReportStatus,
	getBusinessReportStatus,
} from "../api/report.service";

const PENDING_STATUSES: ReportStatus[] = [
	"REQUESTED",
	"IN_PROGRESS",
	"REGENERATION_IN_PROGRESS",
];

export const useGetBusinessReportStatus = (body: {
	businessId: string;
	caseId?: string;
}) => {
	const POLLING_TIMEOUT_MS = 30 * 1000; // stop polling after 30 s if the report is stuck (e.g. missing data)
	const startTimeRef = useRef(Date.now());

	return useQuery({
		queryKey: ["getBusinessReportStatus", body.businessId, body.caseId],
		queryFn: async () => {
			const res = await getBusinessReportStatus(body);
			return res;
		},
		enabled: !!body && !!body.businessId,
		// Poll the status while the report is being generated.
		// Automatically updates the UI with the report when it's ready.
		refetchInterval: (query) => {
			const data = query.state.data as ReportStatusType | undefined;
			// First interval (before the initial response) → 5 s
			if (!data) return 5000;

			// Stop polling once the timeout is reached.
			if (Date.now() - startTimeRef.current > POLLING_TIMEOUT_MS) return false;

			const currentStatus = data.data.status;

			// Subsequent intervals while pending → 3 s
			return PENDING_STATUSES.includes(currentStatus) ? 3000 : false;
		},
	});
};

export const useGenerateReport = () => {
	return useMutation({
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
	return useMutation({
		mutationFn: async (reportId: string) => {
			const res = await downloadReport(reportId);
			return res;
		},
	});
};

export const useGenerateBulkReport = () =>
	useMutation({
		mutationFn: async (payload: { businessId: string; customerId: string }) => {
			const res = await generateBulkReport(
				payload.businessId,
				payload.customerId,
			);
			return res;
		},
	});

export const useGetBulkReportStatus = (
	businessId: string,
	customerId: string,
) =>
	useQuery({
		queryKey: ["getBulkReportStatus", businessId, customerId],
		queryFn: async () => {
			const res = await getBulkReportStatus(businessId, customerId);
			return res;
		},
		enabled: !!businessId && !!customerId,
	});

export const useDownloadBulkReport = () =>
	useMutation({
		mutationFn: async (payload: { businessId: string; customerId: string }) => {
			await downloadBulkReport(payload.businessId, payload.customerId);
		},
	});

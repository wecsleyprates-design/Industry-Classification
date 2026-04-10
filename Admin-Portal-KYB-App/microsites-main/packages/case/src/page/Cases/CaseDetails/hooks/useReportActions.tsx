import { useMemo } from "react";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	EyeIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
	useDownloadReport,
	useGenerateReport,
	useGetBusinessReportStatus,
} from "@/services/queries/report.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type CaseData } from "@/types/case";
import useRegenerateReport from "./useRegenerateReport";

type ReportAction = {
	label: string;
	icon: React.ReactNode;
	onClick?: () => void;
	isDisabled: boolean;
};

type UseReportMenuProps = {
	caseData?: CaseData;
};

export const useReportActions = ({
	caseData,
}: UseReportMenuProps): ReportAction[] => {
	const { moduleType } = useAppContextStore();
	const {
		data: businessReportStatusData,
		refetch: refetchBusinessReportStatus,
	} = useGetBusinessReportStatus({
		businessId: caseData?.business_id ?? "",
		caseId: caseData?.id,
	});

	const { mutateAsync: generateReport, isPending: isLoadingGenerateReport } =
		useGenerateReport();

	const { regenerateReport, isLoading: isLoadingRegenerateReport } =
		useRegenerateReport(caseData);

	const { mutateAsync: downloadReport, isPending: isLoadingDownloadReport } =
		useDownloadReport();

	const handleDownloadReport = async () => {
		try {
			const downloadReportData = await downloadReport(
				businessReportStatusData?.data?.report_details?.id ?? "",
			);
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		} catch (error) {
			toast.error("Error downloading report");
		}
	};

	const handleGenerateReport = async () => {
		try {
			await generateReport({
				customerId: caseData?.customer_id ?? "",
				businessId: caseData?.business_id ?? "",
				caseId: caseData?.id,
				moduleType,
			});
			toast.success("Report generation in progress");
			await refetchBusinessReportStatus();
		} catch (error) {
			toast.error("Error generating report");
		}
	};

	const reportStatus = businessReportStatusData?.data?.status;

	return useMemo(() => {
		if (!caseData) {
			return [
				{
					label: "Report Unavailable",
					icon: <ArrowDownTrayIcon className="size-4" />,
					isDisabled: true,
				},
			];
		}

		switch (reportStatus) {
			case "COMPLETED":
			case "REGENERATED_SUCCESSFULLY":
				return [
					{
						label: "View Report",
						icon: <EyeIcon className="size-4" />,
						onClick: () => {
							void handleDownloadReport();
						},
						isDisabled: isLoadingDownloadReport,
					},
					{
						label: "Regenerate Report",
						icon: <ArrowPathRoundedSquareIcon className="size-4" />,
						onClick: () => {
							void regenerateReport();
						},
						isDisabled: false,
						loading: isLoadingRegenerateReport,
					},
				];

			case "REQUESTED":
				return [
					{
						label: "Report Processing",
						icon: <ClockIcon className="size-4" />,
						isDisabled: true,
					},
				];

			case "IN_PROGRESS":
			case "REGENERATION_IN_PROGRESS":
				return [
					{
						label: "Request Processing",
						icon: <ClockIcon className="size-4" />,
						isDisabled: true,
					},
				];

			case "DOWNLOAD_REPORT_AVAILABLE":
				return [
					{
						label: "Download Report",
						icon: <ArrowDownTrayIcon className="size-4" />,
						onClick: () => {
							void handleGenerateReport();
						},
						isDisabled: isLoadingGenerateReport,
					},
				];

			case "DOWNLOAD_REPORT_UNAVAILABLE":
			case "FAILED":
			case "FAILED_SECOND_TIME":
			default:
				return [
					{
						label: "Report Unavailable",
						icon: <ArrowDownTrayIcon className="size-4" />,
						isDisabled: true,
					},
					{
						label: "Regenerate Report",
						icon: <ArrowPathRoundedSquareIcon className="size-4" />,
						onClick: () => {
							void regenerateReport();
						},
						isDisabled: false,
						loading: isLoadingRegenerateReport,
					},
				];
		}
	}, [
		reportStatus,
		isLoadingDownloadReport,
		isLoadingGenerateReport,
		isLoadingRegenerateReport,
		caseData,
	]);
};

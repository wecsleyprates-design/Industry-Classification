import { useEffect, useState } from "react";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	DocumentCheckIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import ArrowDownTrayErrorIcon from "@/assets/ArrowDownTrayErrorIcon";
import { WarningModal } from "@/components/Modal/WarningModal";
import {
	useDownloadReport,
	useGenerateReport,
} from "@/services/queries/report.query";
import { useAppContextStore } from "@/store/useAppContextStore";

import { Tooltip } from "@/ui/tooltip";

interface Props {
	status:
		| "REQUESTED"
		| "IN_PROGRESS"
		| "COMPLETED"
		| "FAILED"
		| "FAILED_SECOND_TIME"
		| "REGENERATION_IN_PROGRESS"
		| "REGENERATED_SUCCESSFULLY"
		| "DOWNLOAD_REPORT_AVAILABLE"
		| "DOWNLOAD_REPORT_UNAVAILABLE";
	caseId: string;
	businessId: string;
	reportId: string | null;
	onModalClose?: () => void;
}

const EXCLUDED_STATUSES = [
	"REQUESTED",
	"IN_PROGRESS",
	"REGENERATION_IN_PROGRESS",
	"DOWNLOAD_REPORT_AVAILABLE",
	"FAILED", // handled by ArrowDownTrayErrorIcon and generateReport callback
];

export const DownloadReportButtons: React.FC<Props> = ({
	status,
	caseId,
	businessId,
	reportId,
	onModalClose,
}) => {
	const { customerId, moduleType } = useAppContextStore();
	const [isModalOpen, setIsModalOpen] = useState(false);

	const { mutateAsync: generateReport, data: generateReportData } =
		useGenerateReport();
	const { mutateAsync: downloadReport, data: downloadReportData } =
		useDownloadReport();

	useEffect(() => {
		if (generateReportData) {
			setIsModalOpen(true);
		}
	}, [generateReportData]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);
	const getTooltip = (status: Props["status"]) => {
		let tooltip = "";
		switch (status) {
			case "DOWNLOAD_REPORT_AVAILABLE":
				tooltip = "Download Report";
				break;
			case "DOWNLOAD_REPORT_UNAVAILABLE":
				tooltip = "Report unavailable";
				break;
			case "REQUESTED":
				tooltip = "Report Processing";
				break;
			case "IN_PROGRESS":
				tooltip = "Report Processing";
				break;
			case "REGENERATION_IN_PROGRESS":
				tooltip = "Report Regenerating";
				break;
			case "COMPLETED":
				tooltip = "View Report";
				break;
			case "REGENERATED_SUCCESSFULLY":
				tooltip = "View Report";
				break;
			case "FAILED":
				tooltip = "Error downloading report. Please try again.";
				break;
			case "FAILED_SECOND_TIME":
				tooltip =
					"Unable to download report. Please contact support at support@joinworth.com";
				break;
		}
		return tooltip;
	};

	const getIcon: any = (status: Props["status"]) => {
		switch (status) {
			case "DOWNLOAD_REPORT_AVAILABLE":
				return (
					<ArrowDownTrayIcon className="text-[#2563EB] h-5 w-5 cursor-pointer" />
				);
			case "DOWNLOAD_REPORT_UNAVAILABLE":
				return (
					<ArrowDownTrayIcon className="text-[#9CA3AF] h-5 w-5 cursor-not-allowed" />
				);
			case "REQUESTED":
				return (
					<ClockIcon className="text-[#6B7280] h-5 w-5 cursor-not-allowed" />
				);
			case "IN_PROGRESS":
				return (
					<ClockIcon className="text-[#6B7280] h-5 w-5 cursor-not-allowed" />
				);
			case "REGENERATION_IN_PROGRESS":
				return (
					<ClockIcon className="text-[#6B7280] h-5 w-5 cursor-not-allowed" />
				);
			case "REGENERATED_SUCCESSFULLY":
				return (
					<DocumentCheckIcon className="text-[#2563EB] h-5 w-5 cursor-pointer" />
				);
			case "COMPLETED":
				return (
					<DocumentCheckIcon className="text-[#2563EB] h-5 w-5 cursor-pointer" />
				);
			case "FAILED":
				return <ArrowDownTrayErrorIcon />;
			case "FAILED_SECOND_TIME":
				return (
					<ExclamationCircleIcon className="text-[#B91C1C] h-5 w-5 cursor-not-allowed" />
				);
			default:
				return <></>;
		}
	};

	const getCallbackMethod = async (status: Props["status"]) => {
		switch (status) {
			case "DOWNLOAD_REPORT_AVAILABLE":
				await generateReport({
					businessId,
					customerId,
					caseId,
					moduleType,
				});
				break;
			case "DOWNLOAD_REPORT_UNAVAILABLE":
				break;
			case "REQUESTED":
				break;
			case "REGENERATED_SUCCESSFULLY":
			case "COMPLETED":
				if (reportId) await downloadReport(reportId);
				break;
			case "FAILED":
				await generateReport({
					businessId,
					customerId,
					caseId,
					moduleType,
				});
				break;
			case "FAILED_SECOND_TIME":
				break;
			default:
				return <></>;
		}
	};

	const regenerateOptionAvailable = !EXCLUDED_STATUSES.includes(status);

	return (
		<>
			<Tooltip
				trigger={
					<p
						id={`download_report-${caseId}`}
						onClick={async () => {
							await getCallbackMethod(status);
						}}
					>
						{getIcon(status)}
					</p>
				}
				content={<p>{getTooltip(status)}</p>}
			/>
			{regenerateOptionAvailable && (
				<Tooltip
					trigger={
						<p
							id={`regenerate_report-${caseId}`}
							onClick={async () => {
								await generateReport({
									businessId,
									customerId,
									caseId,
									moduleType,
								});
							}}
						>
							{
								<ArrowPathRoundedSquareIcon className="text-[#2563EB] h-5 w-5 cursor-pointer" />
							}
						</p>
					}
					content={<p>Regenerate Report</p>}
				/>
			)}
			{isModalOpen && (
				<WarningModal
					type="success"
					isOpen={isModalOpen}
					onClose={async () => {
						setIsModalOpen(false);
						onModalClose?.();
					}}
					title="360 Report Request Received"
					description="This report can take a few minutes to generate. We'll send you an email with your full 360 report when it's ready to be viewed."
					onSuccess={async () => {
						setIsModalOpen(false);
						onModalClose?.();
					}}
					showIcon={true}
					buttonText={"Close"}
					showCancel={false}
				/>
			)}
		</>
	);
};

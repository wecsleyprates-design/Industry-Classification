import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	DocumentCheckIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { type UseMutateAsyncFunction } from "@tanstack/react-query";
import ArrowDownTrayErrorIcon from "assets/ArrowDownTrayErrorIcon";
import { getItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
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
	generateReport: UseMutateAsyncFunction<
		any,
		unknown,
		{
			customerId: string;
			businessId: string;
			caseId?: string;
		},
		unknown
	>;
	downloadReport: UseMutateAsyncFunction<any, unknown, string, unknown>;
	caseId: string;
	businessId: string;
	reportId: string | null;
}

const ReportStatus: React.FC<Props> = ({
	status,
	generateReport,
	downloadReport,
	caseId,
	businessId,
	reportId,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
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
				// User can generate a new report
				await generateReport({ businessId, customerId, caseId });
				break;
			case "COMPLETED":
				// User can download the completed report
				if (reportId) await downloadReport(reportId);
				break;
			case "FAILED":
				// Allow user to retry generating the report
				await generateReport({ businessId, customerId, caseId });
				break;
			case "DOWNLOAD_REPORT_UNAVAILABLE":
			case "REQUESTED":
			case "FAILED_SECOND_TIME":
			case "IN_PROGRESS":
			case "REGENERATION_IN_PROGRESS":
			case "REGENERATED_SUCCESSFULLY":
			default:
				// No action for these statuses
				break;
		}
	};
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
			{(status === "COMPLETED" || status === "REGENERATED_SUCCESSFULLY") && (
				<Tooltip
					trigger={
						<p
							id={`regenerate_report-${caseId}`}
							onClick={async () => {
								await generateReport({ businessId, customerId, caseId });
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
		</>
	);
};

export default ReportStatus;

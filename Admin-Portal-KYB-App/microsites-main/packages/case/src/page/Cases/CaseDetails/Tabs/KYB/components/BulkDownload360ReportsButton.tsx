import React, { useEffect, useMemo } from "react";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
} from "@heroicons/react/24/outline";
import { useCustomToast } from "@/hooks/useCustomToast";
import {
	useGetReportsBusinessesBulkDownload,
	useGetReportsBusinessesBulkGenerateStatus,
	usePostReportsBusinessesBulkGenerate,
} from "@/services/queries/report.query";
import type { ReportStatus } from "@/types/report";

import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";

export const isStatusCompleted = (
	status: ReportStatus | undefined,
): boolean => {
	const COMPLETED_STATUSES: ReportStatus[] = [
		"COMPLETED",
		"REGENERATED_SUCCESSFULLY",
	];
	return status ? COMPLETED_STATUSES.includes(status) : false;
};

export const isStatusGenerating = (
	status: ReportStatus | undefined,
): boolean => {
	const INCOMPLETE_STATUSES: ReportStatus[] = [
		"IN_PROGRESS",
		"REGENERATION_IN_PROGRESS",
		"REQUESTED",
	];
	return status ? INCOMPLETE_STATUSES.includes(status) : false;
};

export const isStatusUnavailable = (
	status: ReportStatus | undefined,
): boolean => {
	const UNAVAILABLE_STATUSES: ReportStatus[] = [
		"DOWNLOAD_REPORT_UNAVAILABLE",
		"FAILED_SECOND_TIME",
		"FAILED",
	];
	return status ? UNAVAILABLE_STATUSES.includes(status) : false;
};

const UI_CONSTANTS = {
	TOAST_MESSAGES: {
		BULK_GENERATE_SUCCESS:
			"Bulk 360 Report generation request has been successfully submitted.",
		STATUS_REFRESH_ERROR:
			"Failed to refresh report status. Please try again.",
	},
	TOOLTIP_CONTENT:
		"Only reports that are available for download and contain data will be included in the download.",
	BUTTON_TEXT: {
		BULK_DOWNLOAD: "Bulk Download 360 Reports",
		BULK_GENERATE: "Bulk Generate 360 Reports",
		GENERATING: "Generating Reports",
		REGENERATE: "Regenerate Bulk Reports",
		UNAVAILABLE: "Bulk Download Unavailable",
	},
} as const;

interface BulkDownload360ReportsButtonProps {
	businessId?: string;
	customerId: string;
	onRefetchBulkReportStatus?: () => void;
}

export const BulkDownload360ReportsButton: React.FC<
	BulkDownload360ReportsButtonProps
> = ({ businessId = "", customerId, onRefetchBulkReportStatus }) => {
	const { successToast, errorToast } = useCustomToast();

	const {
		data: bulkReportStatusData,
		isLoading: isBulkReportStatusLoading,
		refetch: refetchBulkStatus,
	} = useGetReportsBusinessesBulkGenerateStatus(businessId, customerId);

	const bulkReportStatus = useMemo(
		() => bulkReportStatusData?.data?.status,
		[bulkReportStatusData],
	);

	const {
		mutateAsync: bulkGenerateReport,
		data: bulkGenerateReportData,
		isPending: isBulkGenerateLoading,
	} = usePostReportsBusinessesBulkGenerate();

	const {
		mutateAsync: downloadBulkReport,
		isPending: isDownloadBulkReportLoading,
	} = useGetReportsBusinessesBulkDownload();

	const isGenerating =
		isBulkGenerateLoading || isStatusGenerating(bulkReportStatus);
	const isCompleted = isStatusCompleted(bulkReportStatus);
	const isLoading = isDownloadBulkReportLoading || isBulkGenerateLoading;

	useEffect(() => {
		if (bulkGenerateReportData) {
			onRefetchBulkReportStatus?.();
			refetchBulkStatus().catch((error) => {
				console.error("Failed to refetch bulk status:", error);
				errorToast(UI_CONSTANTS.TOAST_MESSAGES.STATUS_REFRESH_ERROR);
			});
		}
	}, [
		bulkGenerateReportData,
		onRefetchBulkReportStatus,
		refetchBulkStatus,
		errorToast,
	]);

	const onDownloadClick = async () => {
		if (isStatusCompleted(bulkReportStatus)) {
			try {
				await downloadBulkReport({ businessId, customerId });
			} catch (error) {
				console.error("Failed to download bulk report:", error);
				errorToast(
					"Failed to download bulk reports. Please try again.",
				);
			}
		}
	};

	const onGenerateClick = async () => {
		const isInitialGeneration =
			bulkReportStatus === "DOWNLOAD_REPORT_AVAILABLE";
		const verb = isInitialGeneration ? "generate" : "regenerate";

		try {
			await bulkGenerateReport({ businessId, customerId });
			successToast(UI_CONSTANTS.TOAST_MESSAGES.BULK_GENERATE_SUCCESS);
			refetchBulkStatus().catch((error) => {
				console.error("Failed to refetch bulk status:", error);
				errorToast(UI_CONSTANTS.TOAST_MESSAGES.STATUS_REFRESH_ERROR);
			});
		} catch (error) {
			console.error(`Failed to ${verb} bulk report:`, error);
			errorToast(`Failed to ${verb} bulk reports. Please try again.`);
		}
	};

	if (isBulkReportStatusLoading) {
		return (
			<Button
				variant="outline"
				size="lg"
				disabled
				aria-label="Loading report status"
			>
				<ArrowDownTrayIcon aria-hidden="true" />
				{UI_CONSTANTS.BUTTON_TEXT.BULK_DOWNLOAD}
			</Button>
		);
	}

	// Generating state
	if (isGenerating) {
		return (
			<Button
				variant="outline"
				size="lg"
				disabled
				aria-label={UI_CONSTANTS.BUTTON_TEXT.GENERATING}
			>
				<ClockIcon className="w-4 h-4" aria-hidden="true" />
				{UI_CONSTANTS.BUTTON_TEXT.GENERATING}
				{/** Text only for screen readers */}
				<span className="sr-only">
					Bulk reports are currently being generated. Please wait.
				</span>
			</Button>
		);
	}

	// Completed state - show download + regenerate buttons
	if (isCompleted) {
		return (
			<div
				className="flex gap-x-2"
				role="group"
				aria-label="Bulk report actions"
			>
				<Tooltip
					content={UI_CONSTANTS.TOOLTIP_CONTENT}
					trigger={
						<Button
							variant="outline"
							size="lg"
							onClick={onDownloadClick}
							disabled={isDownloadBulkReportLoading}
							aria-label={UI_CONSTANTS.BUTTON_TEXT.BULK_DOWNLOAD}
						>
							{isLoading ? (
								<span className="animate-spin size-4 border-[3px] border-gray-600 border-t-transparent rounded-full" />
							) : (
								<ArrowDownTrayIcon aria-hidden="true" />
							)}
							{UI_CONSTANTS.BUTTON_TEXT.BULK_DOWNLOAD}
						</Button>
					}
				/>
				<Button
					variant="outline"
					size="lg"
					onClick={onGenerateClick}
					disabled={isBulkGenerateLoading}
					aria-label={UI_CONSTANTS.BUTTON_TEXT.REGENERATE}
				>
					{isBulkGenerateLoading ? (
						<ClockIcon className="w-4 h-4" aria-hidden="true" />
					) : (
						<ArrowPathRoundedSquareIcon aria-hidden="true" />
					)}
					{UI_CONSTANTS.BUTTON_TEXT.REGENERATE}
				</Button>
			</div>
		);
	}

	if (isStatusUnavailable(bulkReportStatus)) {
		return (
			<Button
				variant="outline"
				size="lg"
				disabled
				aria-label={UI_CONSTANTS.BUTTON_TEXT.UNAVAILABLE}
			>
				{UI_CONSTANTS.BUTTON_TEXT.UNAVAILABLE}
			</Button>
		);
	}

	// Generate button
	return (
		<Button
			variant="outline"
			size="lg"
			onClick={onGenerateClick}
			disabled={isDownloadBulkReportLoading}
			aria-label={UI_CONSTANTS.BUTTON_TEXT.BULK_GENERATE}
		>
			{isLoading ? (
				<ClockIcon className="w-4 h-4" aria-hidden="true" />
			) : (
				<ArrowDownTrayIcon aria-hidden="true" />
			)}
			{UI_CONSTANTS.BUTTON_TEXT.BULK_GENERATE}
		</Button>
	);
};

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	EyeIcon,
} from "@heroicons/react/24/outline";
import { type UseMutateAsyncFunction } from "@tanstack/react-query";
import { DownloadReport } from "@/components/Actions";
import Button from "@/components/Button";
import LongTextWrapper from "@/components/LongTextWrapper";
import { WarningModal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import Table from "@/components/Table";
import { type column } from "@/components/Table/types";
import { ReactCustomTooltip } from "@/components/Tooltip";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate, getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetRelatedBusinesses } from "@/services/queries/businesses.query";
import {
	useDownloadBulkReport,
	useDownloadReport,
	useGenerateBulkReport,
	useGenerateReport,
	useGetBulkReportStatus,
} from "@/services/queries/report.query";
import useGlobalStore from "@/store/useGlobalStore";
import { type BusinessRecord } from "@/types/business";
import { type ReportStatus } from "@/types/report";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

export const Bulk360Button: React.FC<{
	bulkReportStatusLoading: boolean;
	bulkReportStatus?: ReportStatus;
	bulkGenerateReport: UseMutateAsyncFunction<
		any,
		unknown,
		{
			businessId: string;
			customerId: string;
		},
		unknown
	>;
	downloadBulkReport: UseMutateAsyncFunction<
		void,
		unknown,
		{
			businessId: string;
			customerId: string;
		},
		unknown
	>;
	downloadBulkReportLoading?: boolean;
	bulkGenerateLoading?: boolean;
}> = ({
	bulkGenerateReport,
	bulkReportStatus,
	bulkReportStatusLoading,
	downloadBulkReport,
	downloadBulkReportLoading,
	bulkGenerateLoading,
}) => {
	const { slug } = useParams();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [isRegenerating, setIsRegenerating] = useState(false);
	const { successHandler } = useCustomToast();
	const incompleteStatuses = [
		"IN_PROGRESS",
		"REGENERATION_IN_PROGRESS",
		"REQUESTED",
	];
	const unavailableStatuses = [
		"DOWNLOAD_REPORT_UNAVAILABLE",
		"FAILED_SECOND_TIME",
		"FAILED",
	];
	const buttonClassName =
		bulkReportStatus && unavailableStatuses.includes(bulkReportStatus)
			? "rounded-md bg-[#F3F4F6] cursor-not-allowed"
			: "rounded-md";

	const onDownloadClick = async () => {
		if (bulkReportStatus === "COMPLETED") {
			await downloadBulkReport({ businessId: slug ?? "", customerId });
		}
	};

	const onRegenerateClick = async () => {
		setIsRegenerating(true);
		await bulkGenerateReport({ businessId: slug ?? "", customerId });
		successHandler({
			message:
				"Bulk 360 Report generation request has been successfully submitted.",
		});
	};

	const onGenerateClick = async () => {
		if (bulkReportStatus === "DOWNLOAD_REPORT_AVAILABLE") {
			await bulkGenerateReport({ businessId: slug ?? "", customerId });
			successHandler({
				message:
					"Bulk 360 Report generation request has been successfully submitted.",
			});
		}
	};

	useEffect(() => {
		if (!incompleteStatuses.includes(bulkReportStatus ?? "")) {
			setIsRegenerating(false);
		}
	}, [bulkReportStatus]);

	const loader = (
		<span className="inline-block w-4 h-4 border-2 border-current rounded-full animate-spin border-t-transparent"></span>
	);

	const buttonText = useMemo(
		() =>
			bulkReportStatus && (
				<>
					{bulkReportStatus === "COMPLETED" ? (
						<div className="flex text-[#1F2937] text-sm font-medium gap-x-2">
							{(downloadBulkReportLoading ?? bulkGenerateLoading) ? (
								loader
							) : (
								<ArrowDownTrayIcon className="w-5 h-5" />
							)}
							Bulk Download 360 Reports
						</div>
					) : bulkReportStatus === "DOWNLOAD_REPORT_AVAILABLE" ? (
						<div className="flex text-[#1F2937] text-sm font-medium gap-x-2">
							{(downloadBulkReportLoading ?? bulkGenerateLoading) ? (
								loader
							) : (
								<ArrowDownTrayIcon className="w-5 h-5" />
							)}
							Bulk Generate 360 Reports
						</div>
					) : incompleteStatuses.includes(bulkReportStatus) ? (
						<div className="text-[#6B7280] flex text-sm font-medium gap-x-2">
							<ClockIcon className="w-5 h-5" /> Generating Reports
						</div>
					) : unavailableStatuses.includes(bulkReportStatus) ? (
						<>Bulk Download Unavailable</>
					) : null}
				</>
			),
		[bulkReportStatus, downloadBulkReportLoading, bulkGenerateLoading],
	);

	const isGenerating = useMemo(
		() => isRegenerating || incompleteStatuses.includes(bulkReportStatus ?? ""),
		[isRegenerating, bulkReportStatus],
	);

	if (!bulkReportStatusLoading) {
		if (bulkReportStatus === "COMPLETED" && !isRegenerating) {
			return (
				<div className="flex gap-x-2">
					<Button
						outline
						color="grey"
						className={buttonClassName}
						onClick={onDownloadClick}
						disabled={downloadBulkReportLoading}
					>
						<ReactCustomTooltip
							id={"tooltip"}
							key={"tooltip"}
							tooltip={
								<>
									Only reports that are available for download and contain data
									will be included in the download.
								</>
							}
						>
							<>{buttonText}</>
						</ReactCustomTooltip>
					</Button>
					<Button
						outline
						color="grey"
						className={buttonClassName}
						onClick={onRegenerateClick}
						disabled={bulkGenerateLoading}
					>
						<div className="flex text-[#1F2937] text-sm font-medium gap-x-2">
							{bulkGenerateLoading ? (
								loader
							) : (
								<ArrowPathRoundedSquareIcon className="w-5 h-5" />
							)}
							Regenerate Bulk Reports
						</div>
					</Button>
				</div>
			);
		}

		if (isGenerating) {
			return (
				<Button
					outline
					color="grey"
					className="rounded-md cursor-not-allowed"
					disabled
				>
					<div className="text-[#6B7280] flex text-sm font-medium gap-x-2">
						<ClockIcon className="w-5 h-5" /> Generating Reports
					</div>
				</Button>
			);
		}
		return (
			<Button
				outline
				color="grey"
				className={buttonClassName}
				onClick={onGenerateClick}
				disabled={downloadBulkReportLoading}
			>
				<>{buttonText}</>
			</Button>
		);
	} else {
		return <Skeleton className="h-10 w-52" />;
	}
};
const RelatedBusinesses = () => {
	const { slug } = useParams();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { savedNormalPayload } = useGlobalStore((store) => store);
	const [page, setPage] = useState<number>(
		(savedNormalPayload?.relatedBusinesses?.page as number) ?? 1,
	);
	const [itemsPerPage, setItemsPerPage] = useState<number>(
		(savedNormalPayload?.relatedBusinesses?.items_per_page as number) ?? 10,
	);
	const [payload, setPayload] = useState<Record<string, any>>(
		savedNormalPayload?.relatedBusinesses ?? {
			pagination: true,
			page,
			items_per_page: itemsPerPage,
		},
	);

	const sortHandler = (order: string, alias: string) => {
		setPayload((val) => {
			return {
				...val,
				sort: {
					[alias]: order,
				},
			};
		});
	};

	const paginationHandler = (pageVal: number) => {
		setPayload((val) => {
			return {
				...val,
				page: pageVal,
			};
		});
		setPage(pageVal);
	};

	const itemsPerPageHandler = (itemsPerPageVal: number) => {
		setPayload((val) => {
			return {
				...val,
				page: 1,
				items_per_page: itemsPerPageVal,
			};
		});
		setPage(1);
		setItemsPerPage(itemsPerPageVal);
	};

	const [reportRequestedModal, setReportRequestedModal] = useState(false);
	const [tableData, setTableData] = useState<{
		records: BusinessRecord[];
		total_items: number;
		total_pages: number;
	}>({
		records: [],
		total_items: 0,
		total_pages: 1,
	});

	const {
		data: relatedBusinessesData,
		isLoading,
		refetch,
	} = useGetRelatedBusinesses(slug ?? "", customerId, payload);

	// Bulk 360 Functions
	const {
		data: bulkReportStatusData,
		isLoading: bulkReportStatusLoading,
		refetch: refetchBulkStatus,
	} = useGetBulkReportStatus(slug ?? "", customerId);

	const bulkReportStatus = useMemo(
		() => bulkReportStatusData?.data?.status,
		[bulkReportStatusData],
	);

	const {
		mutateAsync: bulkGenerateReport,
		data: bulkGenerateReportData,
		isPending: bulkGenerateLoading,
	} = useGenerateBulkReport();
	const {
		mutateAsync: downloadBulkReport,
		isPending: downloadBulkReportLoading,
	} = useDownloadBulkReport();

	const { mutateAsync: generateReport, data: generateReportData } =
		useGenerateReport();
	const { mutateAsync: downloadReport, data: downloadReportData } =
		useDownloadReport();

	useEffect(() => {
		if (bulkGenerateReportData) {
			refetch().catch(() => {});
			refetchBulkStatus().catch(() => {});
		}
	}, [bulkGenerateReportData]);

	useEffect(() => {
		if (relatedBusinessesData) {
			setTableData({
				records: relatedBusinessesData.data.records,
				total_items: relatedBusinessesData.data.total_items,
				total_pages: relatedBusinessesData.data.total_pages,
			});
		}
	}, [relatedBusinessesData]);

	useEffect(() => {
		if (generateReportData) {
			setReportRequestedModal(true);
		}
	}, [generateReportData]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);

	const columns: column[] = [
		{
			title: "Business ID #",
			path: "id",
			content: (item) => (
				<Link
					to={getSlugReplacedURL(URL.BUSINESS_DETAILS, item?.id)}
					target={"_blank"}
					rel={"noopener noreferrer"}
					className="overflow-visible text-blue-600 truncate cursor-pointer hover:text-blue-400"
				>
					<LongTextWrapper text={item?.id} />
				</Link>
			),
		},
		{
			title: "Business name",
			path: "name",
			content: (item) => {
				return (
					<span className="md:max-w-[200px]">
						<LongTextWrapper text={item?.name ?? "-"} />
					</span>
				);
			},
		},
		{
			title: "Onboarding date",
			path: "created_at",
			alias: "db.created_at",
			sort: true,
			content: (item) => {
				return (
					<span className="truncate">
						{convertToLocalDate(item?.created_at, "MM-DD-YYYY - h:mmA")}
					</span>
				);
			},
		},
		{
			title: "Actions",
			path: "",
			content: (item) => (
				<div className="flex gap-x-3">
					<ReactCustomTooltip
						id={"view_case"}
						tooltip={<>View Case</>}
						place="top"
					>
						<Link
							to={getSlugReplacedURL(URL.BUSINESS_DETAILS, item?.id)}
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-600 truncate cursor-pointer hover:text-blue-400 max-w-fit"
						>
							<EyeIcon className="text-[#2563EB] h-5 w-5" />
						</Link>
					</ReactCustomTooltip>
					<DownloadReport
						status={item?.report_status}
						generateReport={generateReport}
						downloadReport={downloadReport}
						businessId={item?.id}
						reportId={item?.report_id}
					/>
				</div>
			),
		},
	];

	return (
		<React.Fragment>
			{tableData?.records?.length ? (
				<div className="mt-8 bg-white border rounded-lg shadow">
					<div className="flex justify-end w-full min-w-full px-4 py-2 border-b max-w-7xl sm:px-2 lg:px-4">
						<div className="flex flex-col justify-between w-full sm:flex-grow sm:items-center sm:flex-row">
							<div className="pt-1 sm:w-1/5 ">
								<h1 className="text-base font-semibold leading-6 text-gray-900">
									Related Businesses
								</h1>
							</div>
							<Bulk360Button
								bulkReportStatusLoading={bulkReportStatusLoading}
								bulkReportStatus={bulkReportStatus}
								bulkGenerateReport={bulkGenerateReport}
								downloadBulkReport={downloadBulkReport}
								downloadBulkReportLoading={downloadBulkReportLoading}
								bulkGenerateLoading={bulkGenerateLoading}
							/>
						</div>
					</div>
					<Table
						columns={columns}
						isLoading={isLoading}
						tableData={tableData}
						page={payload.page ?? 1}
						itemsPerPage={payload.items_per_page ?? 10}
						paginationHandler={paginationHandler}
						itemsPerPageHandler={itemsPerPageHandler}
						sortHandler={sortHandler}
					/>
				</div>
			) : null}
			{reportRequestedModal && (
				<WarningModal
					type="success"
					isOpen={reportRequestedModal}
					onClose={async () => {
						setReportRequestedModal(false);
						await refetch?.();
					}}
					title="360 Report Request Received"
					description="This report can take a few minutes to generate. We’ll send you an email with your full 360 report when it’s ready to be viewed."
					onSucess={async () => {
						setReportRequestedModal(false);
						await refetch?.();
					}}
					buttonText={"Close"}
					showCancel={false}
				/>
			)}
		</React.Fragment>
	);
};

export default RelatedBusinesses;

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useSearchParams } from "react-router-dom";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	DocumentCheckIcon,
	FolderIcon,
	PencilSquareIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { useFlags } from "launchdarkly-react-client-sdk";
import queryString from "query-string";
import { twMerge } from "tailwind-merge";
import DownIcon from "@/assets/DownIcon";
import LinkIcon from "@/assets/LinkIcon";
import RotateOutline from "@/assets/RotateOutline";
import Button from "@/components/Button";
import Card from "@/components/Card";
import SparklinesChart from "@/components/Charts/SparklinesChart";
import AlertsDropdown from "@/components/Dropdown/AlertsDropdown";
import { WarningModal } from "@/components/Modal";
import ArchiveBusinessModal from "@/components/Modal/ArchiveBusinessModal";
import CustomWarningModal from "@/components/Modal/CustomWarningModal";
import PurgeBusinessModal from "@/components/Modal/PurgeBusinessModal";
import { Skeleton } from "@/components/Skeleton";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title/PageTitle";
import { RiskMonitoringToggle } from "@/components/Toggle";
import { TooltipV3 } from "@/components/Tooltip";
import { WorthScoreTooltip } from "@/components/WorthScore";
import useAutoRegenerateReport from "@/hooks/useAutoRegenerateReport";
import useCustomToast from "@/hooks/useCustomToast";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import {
	convertToLocalDate,
	getCurrentTimezone,
	getSlugReplacedURL,
	hasAccess,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetCustomerApplicantConfig } from "@/services/queries/aging.query";
import {
	useGetBusinessById,
	useGetScoreTrendChart,
	useGetWorthScore,
	useGetWorthScoreDate,
	useUpdateRiskMonitoring,
} from "@/services/queries/businesses.query";
import {
	useScoreRefresh,
	useScoreRefreshTime,
} from "@/services/queries/case.query";
import {
	useDownloadReport,
	useGenerateReport,
	useGetBusinessReportStatus,
} from "@/services/queries/report.query";
import {
	useGetCustomerIntegrationSettingsByCustomerId,
	useGetRiskAlertNotifications,
} from "@/services/queries/riskAlert.query";
import useAuthStore from "@/store/useAuthStore";
import {
	type GetBusinessByIdData,
	type UpdateRiskMonitoring,
} from "@/types/business";
import { type RefreshProcessingTime } from "@/types/case";
import { STATUS_CODES } from "../../constants/StatusCodes";
import RemoteBusinessDetailTable from "./Business/RemoteBusinessDetailTable";
import RemoteMerchantProfilesTable from "./Business/RemoteMerchantProfileTable";
import { Invitations } from "./Business";
import RelatedBusinesses from "./RelatedBusinesses";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";
interface ContentProps {
	slug: string;
	businessData?: GetBusinessByIdData;
	setRiskMonitoringStatus?: React.Dispatch<
		React.SetStateAction<boolean | null>
	>;
	isRiskMonitoringLoading: boolean;
	setIsRiskedModalOpened?: React.Dispatch<React.SetStateAction<boolean>>;
	setIsScoreRefreshOpened?: React.Dispatch<React.SetStateAction<boolean>>;
	scroeRefreshTimeLoading?: boolean;
	scoreRefreshTimeData?: RefreshProcessingTime;
}

const Content: React.FC<ContentProps> = ({
	businessData,
	slug, // businessId
	setIsRiskedModalOpened,
	setRiskMonitoringStatus,
	isRiskMonitoringLoading,
	setIsScoreRefreshOpened,
	scoreRefreshTimeData,
}) => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [datePosition, setDatePosition] = useState<number>(0);
	const [month, setMonth] = useState<string>("");
	const [year, setYear] = useState<string>("");
	const [scoreTriggerId, setScoreTriggerId] = useState<string>();
	const [scoreIdsData, setScoreIdsData] = useState<
		Array<{
			date: Date;
			score_trigger_id: string;
		}>
	>([]);

	const { data: wortScoreData, isLoading } = useGetWorthScore({
		businessId: slug ?? "",
		customerId,
		month,
		year,
		scoreTriggerId,
	});

	const timeZone = getCurrentTimezone();

	const { data: riskAlertsData } = useGetRiskAlertNotifications(
		customerId,
		slug,
		{
			pagination: false,
			time_zone: timeZone,
		},
	);

	const { highRiskCount, moderateRiskCount } = useMemo(
		() => ({
			highRiskCount: riskAlertsData?.data.records.filter(
				(item) => item.risk_level === "HIGH",
			).length,
			moderateRiskCount: riskAlertsData?.data.records.filter(
				(item) => item.risk_level === "MODERATE",
			).length,
		}),
		[riskAlertsData],
	);

	const { refetch, data: worthScoreDate } = useGetWorthScoreDate(slug ?? "");

	function setDateSearchParameters(year: string, month: string) {
		setMonth(month);
		setYear(year);
	}

	useEffect(() => {
		void refetch();
	}, [year, month]);

	useEffect(() => {
		if (worthScoreDate?.data?.length) {
			const getLatestPosition = worthScoreDate.data.length - 1;
			const scoreDate = worthScoreDate.data[getLatestPosition];
			setScoreTriggerId(
				worthScoreDate.data[getLatestPosition].score_trigger_id,
			);
			setDatePosition(getLatestPosition);
			const scores = worthScoreDate.data.map((item) => ({
				date: item.fullDate,
				score_trigger_id: item.score_trigger_id,
			}));
			setScoreIdsData(scores);
			setDateSearchParameters(scoreDate.year, scoreDate.month);
		}
	}, [worthScoreDate]);

	const { data: scoreTrendData, isLoading: scoreTrendLoading } =
		useGetScoreTrendChart(slug ?? "");

	const scoreTrendParsedData = useMemo(() => {
		const resArray: any = [{ x: 0, y: 0 }]; // to start at 0
		scoreTrendData?.data?.score_data?.forEach((item) => {
			const month = dayjs(item?.created_at).utc().format("MMM");
			if (month === "Jan") {
				// if score present for Jan then replace 0 with Jan Object
				resArray[0] = {
					x: month,
					y: Number(item.weighted_score_850),
				};
			} else {
				resArray.push({
					x: month,
					y: Number(item.weighted_score_850),
				});
			}
		});
		return resArray;
	}, [scoreTrendData]);

	const updateScoreId = (id?: string) => {
		setScoreTriggerId(id);
	};

	return (
		<>
			<div>
				<div className="grid grid-flow-row mx-2 overflow-visible sm:grid-flow-col">
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Onboarding date
						</p>
						<p className="overflow-hidden text-sm font-medium tracking-tight break-words text-slate-800">
							{convertToLocalDate(
								businessData?.created_at ?? null,
								"MM-DD-YYYY - h:mmA",
							)}
						</p>
					</div>
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Worth score
						</p>
						<div>
							<div className="flex">
								<WorthScoreTooltip
									worthScore={wortScoreData?.data}
									type="month"
									showTooltip={
										isLoading || !!wortScoreData?.data?.is_score_calculated
									}
									date={
										new Date(
											wortScoreData?.data.created_at ??
												new Date(
													worthScoreDate?.data[datePosition]?.fullDate ??
														new Date(),
												),
										)
									}
									updateDate={(_, value) => {
										const newDatePosition = datePosition + Number(value);
										setDatePosition(newDatePosition);
										const date: any = worthScoreDate?.data?.[newDatePosition];
										setDateSearchParameters(date?.year, date?.month);
										setScoreTriggerId(date?.score_trigger_id);
									}}
									key={"tooltip"}
									hasNext={
										datePosition < Number(worthScoreDate?.data?.length ?? 0) - 1
									}
									hasPrevious={datePosition > 0}
									scoreIds={scoreIdsData}
									updateScoreId={updateScoreId}
								>
									{wortScoreData?.data.is_score_calculated ? (
										<div className="text-sm font-medium text-[#266EF1] tracking-tight overflow-hidden break-words">
											<div className="flex flex-row gap-x-1">
												<span className="font-semibold">
													{wortScoreData?.data?.weighted_score_850}&nbsp;
												</span>
												/&nbsp;850
												<InformationCircleIcon className="w-5 h-5 text-black" />
											</div>
										</div>
									) : (
										<p className="pr-1 text-sm font-medium tracking-tight text-slate-800">
											Pending
										</p>
									)}
								</WorthScoreTooltip>
								{scoreRefreshTimeData?.data?.is_refresh_score_enable ? (
									<>
										<div
											className={twMerge(
												"z-50 rounded-full cursor-pointer hover:bg-blue-100",
												scoreRefreshTimeData?.data?.is_refresh_score_enable
													? "cursor-pointer"
													: "cursor-not-allowed",
											)}
											onClick={() => {
												if (scoreRefreshTimeData?.data?.is_refresh_score_enable)
													setIsScoreRefreshOpened?.(true);
											}}
										>
											<RotateOutline />
										</div>
									</>
								) : (
									<>
										<TooltipV3
											tooltip={`Score refresh in progress. Try again in ${String(
												scoreRefreshTimeData?.data?.waiting_time ?? "",
											)} ${String(
												scoreRefreshTimeData?.data?.processing_time_unit ?? "",
											)}.`}
										>
											<div
												className={twMerge(
													"z-50 rounded-full cursor-pointer hover:bg-blue-100",
													scoreRefreshTimeData?.data?.is_refresh_score_enable
														? "cursor-pointer"
														: "cursor-not-allowed",
												)}
												onClick={() => {
													if (
														scoreRefreshTimeData?.data?.is_refresh_score_enable
													)
														setIsScoreRefreshOpened?.(true);
												}}
											>
												<RotateOutline />
											</div>
										</TooltipV3>
									</>
								)}
							</div>
							{wortScoreData?.data.is_score_calculated && (
								<span className="text-xs">
									{wortScoreData?.data.created_at
										? ` Generated on ${convertToLocalDate(
												wortScoreData?.data.created_at,
												"MM/DD/YYYY",
											)}`
										: null}
								</span>
							)}
						</div>
					</div>
					{scoreTrendData?.data?.is_score_data_available ? (
						<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
							<p className="text-[10px] font-normal text-gray-500 tracking-tight">
								Score History
							</p>
							<p
								className="flex flex-row items-center text-sm font-medium tracking-tight break-words cursor-pointer gap-x-1"
								onClick={() => {
									navigate(
										getSlugReplacedURL(
											URL.BUSINESS_HISTORICAL_SCORE_DATA,
											slug,
										),
									);
								}}
							>
								{!scoreTrendLoading ? (
									<SparklinesChart data={scoreTrendParsedData} />
								) : (
									<>
										<Skeleton className="h-12 w-14" />
									</>
								)}
							</p>
						</div>
					) : null}
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Risk monitoring
						</p>
						<RiskMonitoringToggle
							value={!!businessData?.is_monitoring_enabled}
							onChange={async () => {
								setIsRiskedModalOpened?.(true);
								setRiskMonitoringStatus?.(!businessData?.is_monitoring_enabled);
							}}
							disabled={
								isRiskMonitoringLoading ||
								!hasAccess(
									permissions,
									[MODULES.RISK_MONITORING_MODULE, MODULES.BUSINESS],
									["write", "write"],
								)
							}
						/>
					</div>
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] text-[#5E5E5E] font-normal  tracking-tight">
							Alerts
						</p>
						<p className="flex flex-row items-center text-sm font-medium tracking-tight break-words gap-x-1">
							<AlertsDropdown
								options={riskAlertsData?.data?.records}
								value={
									<div className="flex flex-row items-center gap-x-1">
										{highRiskCount ? (
											<div
												className={twMerge(
													"bg-[#C81E1E] h-5 w-5 rounded-full text-white justify-center text-center text-sm",
													Number(highRiskCount ?? 0)?.toString()?.length > 2
														? "h-7 w-7 py-1"
														: "",
												)}
											>
												<p>{Number(highRiskCount ?? 0)}</p>
											</div>
										) : null}
										{moderateRiskCount ? (
											<div
												className={twMerge(
													"bg-[#FF9900] h-5 w-5 rounded-full text-white justify-center text-center text-sm",
													Number(moderateRiskCount ?? 0)?.toString()?.length > 2
														? "h-7 w-7 py-1"
														: "",
												)}
											>
												<p>{Number(moderateRiskCount ?? 0)}</p>
											</div>
										) : null}
										{riskAlertsData?.data?.total_items ? (
											<span className="text-[#266EF1] flex align-middle ">
												New Alerts{" "}
												<div className="my-2 ml-1">
													{" "}
													<DownIcon />
												</div>
											</span>
										) : (
											<>No alerts</>
										)}
									</div>
								}
							/>
						</p>
					</div>
					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] font-normal text-gray-500 tracking-tight">
							Audit Trail
						</p>
						<p
							className="text-sm font-medium tracking-tight text-[#266EF1] cursor-pointer"
							onClick={() => {
								navigate(
									getSlugReplacedURL(
										URL.BUSINESS_AUDIT_TRAIL,
										businessData?.id ?? "",
									),
								);
							}}
						>
							View
						</p>
					</div>
				</div>
			</div>
		</>
	);
};

const BusinessDetails = () => {
	const flags = useFlags();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { slug } = useParams();

	const [buttons, setButtons] = useState<any[]>([]);
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { errorHandler, successHandler } = useCustomToast();
	const permissions = useAuthStore((state) => state.permissions);
	const { checkAccess } = useFeatureAccess();
	const showWarningModal: boolean = Boolean(searchParams.get("showModal"));
	const [businessData, setBusinessData] = useState<GetBusinessByIdData>(Object);
	const [showModal, setShowModal] = useState<boolean>(false);
	const [isRiskModalOpened, setIsRiskedModalOpened] = useState(false);
	const [isScoreRefreshOpened, setIsScoreRefreshOpened] = useState(false);
	const [riskMonitoringStatus, setRiskMonitoringStatus] = useState<
		boolean | null
	>(null);
	const [reportRequestedModal, setReportRequestedModal] = useState(false);
	const [reportErrorModal, setReportErrorModal] = useState(false);
	const [isPurgeBusiness, setIsPurgeBusiness] = useState(false);
	const [isArchiveBusiness, setIsArchiveBusiness] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [showAgingThresholdModal, setShowAgingThresholdModal] = useState(false);

	const { data: customerIntegrationStatusData } =
		useGetCustomerIntegrationSettingsByCustomerId(customerId ?? "");

	const {
		data: businessApiData,
		error: businessError,
		isLoading,
		refetch: bussinessDetailsRefetching,
	} = useGetBusinessById({ businessId: slug ?? "" });

	const {
		mutateAsync: updateRiskMonitoring,
		isPending: isUpdateRiskMonitoringLoading,
		data: riskMonitoringData,
		error: riskMonitoringError,
	} = useUpdateRiskMonitoring();

	const { data: customerApplicantConfigData } =
		useGetCustomerApplicantConfig(customerId);

	const {
		mutateAsync: scoreRefresh,
		isPending: scoreRefreshLoading,
		data: scoreRefreshData,
		error: scoreRefreshError,
	} = useScoreRefresh();

	const {
		data: scoreRefreshTimeData,
		isLoading: scroeRefreshTimeLoading,
		refetch: refetchScoreRefreshTime,
	} = useScoreRefreshTime(slug ?? "");

	useEffect(() => {
		if (businessApiData?.status === "success") {
			setBusinessData(businessApiData?.data);
		} else if (
			businessApiData?.status === "error" ||
			businessApiData?.status === "fail"
		) {
			errorHandler({
				message: businessApiData?.message,
			});
		}
	}, [businessApiData]);

	useEffect(() => {
		if (businessError && isAxiosError(businessError)) {
			errorHandler(businessError);
			if (businessError?.response?.status === STATUS_CODES.NOT_FOUND) {
				// navigate to not found screen
				navigate(URL.NOT_FOUND, { replace: true });
			} else if (
				businessError?.response?.status !== STATUS_CODES.UNAUTHORIZED
			) {
				navigate(URL.BUSINESSES);
			}
		}
	}, [businessError]);

	useEffect(() => {
		if (riskMonitoringData) {
			successHandler({
				message:
					riskMonitoringData?.message || riskMonitoringData?.data?.message,
			});
			void bussinessDetailsRefetching();
		}
	}, [riskMonitoringData]);

	useEffect(() => {
		if (riskMonitoringError) {
			errorHandler(riskMonitoringError);
		}
	}, [riskMonitoringError]);

	useEffect(() => {
		if (scoreRefreshData) {
			successHandler({
				message: scoreRefreshData?.message || scoreRefreshData?.data?.message,
			});
		}
	}, [scoreRefreshData]);

	useEffect(() => {
		if (scoreRefreshError) {
			errorHandler(scoreRefreshError);
		}
	}, [scoreRefreshError]);

	useEffect(() => {
		if (showWarningModal) {
			setShowModal(showWarningModal);
		}
	}, [showWarningModal]);

	/******************************************************************************
			           			DOWNLOAD REPORT
	*******************************************************************************/

	const {
		data: businessReportStatusData,
		isLoading: businessReportStatusLoading,
		refetch: refetchReportStatus,
	} = useGetBusinessReportStatus({ businessId: slug ?? "" });

	const {
		mutateAsync: generateReport,
		isPending: generateReportLoading,
		error: generateReportError,
		data: generateReportData,
	} = useGenerateReport();

	// auto regenerate if URL has ?regenerateReport=1
	useAutoRegenerateReport({
		businessId: slug ?? "",
		customerId,
		generateReport: async (params) => await generateReport(params),
		isRegenerating,
		setIsRegenerating,
		reportStatus: businessReportStatusData?.data?.status,
	});

	const {
		mutateAsync: downloadReport,
		isPending: downloadReportLoading,
		data: downloadReportData,
	} = useDownloadReport();

	useEffect(() => {
		if (generateReportData) {
			setReportRequestedModal(true);
			setIsRegenerating(false);
			refetchReportStatus()
				.then(() => {})
				.catch(() => {});
		}
	}, [generateReportData]);

	useEffect(() => {
		if (generateReportError) {
			// Reset regenerating flag if the report generation fails
			setIsRegenerating(false);
			errorHandler(generateReportError);
		}
	}, [generateReportError]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);

	useEffect(() => {
		// Default Buttons
		const tempButtons: any[] = [];

		if (permissions[MODULES.BUSINESS]?.write && !businessData?.is_deleted)
			tempButtons.push(
				<div key="archive-button">
					<Button
						className="flex content-center justify-center gap-2 px-2 rounded-lg opacity-90"
						color="grey"
						outline
						onClick={() => {
							setIsArchiveBusiness(true);
						}}
					>
						<FolderIcon className="w-4 h-4" />
						Archive Business
					</Button>
				</div>,
			);
		if (customerApplicantConfigData?.data?.is_enabled)
			tempButtons.push(
				<Button
					className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
					color="grey"
					outline
					onClick={() => {
						setShowAgingThresholdModal(true);
					}}
					key="aging-threshold-button"
				>
					<PencilSquareIcon className="w-4 h-4" />
					Edit Aging Threshold
				</Button>,
			);

		if (flags[FEATURE_FLAGES.WIN_740_PURGE_BUSINESS]) {
			tempButtons.push(
				<div key="purge-button">
					{
						<Button
							className="flex content-center justify-center gap-2 px-2 text-red-600 rounded-lg opacity-90"
							color="grey"
							outline
							onClick={() => {
								setIsPurgeBusiness(true);
							}}
						>
							<TrashIcon className="w-4 h-4 text-red-600" />
							Delete Business
						</Button>
					}
				</div>,
			);
		}
		if (
			businessReportStatusData &&
			flags[FEATURE_FLAGES.DOS_48_WORTH_360_REPORT]
		) {
			switch (businessReportStatusData?.data.status) {
				case "COMPLETED":
				case "REGENERATED_SUCCESSFULLY":
					tempButtons.push(
						<div
							className="flex flex-col gap-2 md:flex-row h-fit"
							key="completed-report-actions"
						>
							<Button
								className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
								color="grey"
								outline
								isLoading={downloadReportLoading}
								onClick={async () => {
									await downloadReport(
										businessReportStatusData.data?.report_details?.id ?? "",
									);
								}}
							>
								<DocumentCheckIcon className="w-4 h-4 text-[#1F2937]" />
								View Report
							</Button>

							{!isRegenerating && (
								<Button
									className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
									color="grey"
									outline
									onClick={async () => {
										setIsRegenerating(true);
										successHandler({
											message:
												"Report regeneration in progress. You’ll be able to download the updated report shortly.",
										});
										await generateReport({
											customerId,
											businessId: slug ?? "",
										});
									}}
								>
									<ArrowPathRoundedSquareIcon className="w-4 h-4" />
									Regenerate Report
								</Button>
							)}
						</div>,
					);
					break;
				case "REGENERATION_IN_PROGRESS":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#6B7280]"
							color="grey"
							outline
						>
							<ClockIcon className="w-4 h-4 text-[#6B7280]" />
							Regenerating Report
						</Button>,
					);
					break;
				case "IN_PROGRESS":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#6B7280]"
							color="grey"
							outline
							onClick={() => {}}
						>
							<ClockIcon className="w-4 h-4 text-[#6B7280]" />
							Report Processing
						</Button>,
					);
					break;
				case "FAILED":
					tempButtons.push(
						<div
							className="flex flex-col gap-2 md:flex-row h-fit"
							key="failed-report-actions"
						>
							<Button
								className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#6B7280] opacity-90"
								color="grey"
								outline
								disabled
							>
								<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
								Report Unavailable
							</Button>
							{!isRegenerating && (
								<Button
									className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
									color="grey"
									outline
									onClick={async () => {
										setIsRegenerating(true);
										successHandler({
											message:
												"Report regeneration in progress. You’ll be able to download the updated report shortly.",
										});
										await generateReport({
											customerId,
											businessId: slug ?? "",
										});
									}}
								>
									<ArrowPathRoundedSquareIcon className="w-4 h-4" />
									Regenerate Report
								</Button>
							)}
						</div>,
					);
					break;
				case "FAILED_SECOND_TIME":
					tempButtons.push(
						<div
							className="flex flex-col gap-2 md:flex-row h-fit"
							key="failed-twice-report-actions"
						>
							<Button
								className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#6B7280] opacity-90"
								color="grey"
								outline
								disabled
							>
								<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
								Report Unavailable
							</Button>
							{!isRegenerating && (
								<Button
									className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
									color="grey"
									outline
									onClick={async () => {
										setIsRegenerating(true);
										successHandler({
											message:
												"Report regeneration in progress. You’ll be able to download the updated report shortly.",
										});
										await generateReport({
											customerId,
											businessId: slug ?? "",
										});
									}}
								>
									<ArrowPathRoundedSquareIcon className="w-4 h-4" />
									Regenerate Report
								</Button>
							)}
						</div>,
					);
					break;
				case "REQUESTED":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#6B7280]"
							color="grey"
							outline
							onClick={() => {}}
						>
							<ClockIcon className="w-4 h-4 text-[#6B7280]" />
							Report Processing
						</Button>,
					);
					break;
				case "DOWNLOAD_REPORT_AVAILABLE":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
							color="grey"
							outline
							onClick={async () => {
								await generateReport({ customerId, businessId: slug ?? "" });
							}}
							isLoading={generateReportLoading}
						>
							<ArrowDownTrayIcon className="w-4 h-4" />
							Download Report
						</Button>,
					);
					break;
				case "DOWNLOAD_REPORT_UNAVAILABLE":
					tempButtons.push(
						<div
							className="flex flex-col gap-2 md:flex-row h-fit"
							key="download-report-unavailable-actions"
						>
							<Button
								className="px-2 rounded-lg flex content-center justify-center gap-2 cursor-not-allowed text-[#6B7280] opacity-90"
								color="grey"
								outline
								disabled
							>
								<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
								Report Unavailable
							</Button>
							{!isRegenerating && (
								<Button
									className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937]"
									color="grey"
									outline
									onClick={async () => {
										setIsRegenerating(true);
										successHandler({
											message:
												"Report regeneration in progress. You’ll be able to download the updated report shortly.",
										});
										await generateReport({
											customerId,
											businessId: slug ?? "",
										});
									}}
								>
									<ArrowPathRoundedSquareIcon className="w-4 h-4" />
									Regenerate Report
								</Button>
							)}
						</div>,
					);
					break;
				default:
					break;
			}
			setButtons(tempButtons);
		} else {
			setButtons(tempButtons);
		}
	}, [businessReportStatusData, businessData, customerApplicantConfigData]);

	const handleShowAgingThresholdModal = () => {
		setShowAgingThresholdModal((prev) => !prev);
	};

	return permissions[MODULES.BUSINESS]?.read ? (
		<React.Fragment>
			{(isLoading ||
				isUpdateRiskMonitoringLoading ||
				scoreRefreshLoading ||
				businessReportStatusLoading) && <FullPageLoader />}

			<Card
				headerComponent={
					<PageTitle
						titleText={
							<div>
								<div className="text-base font-semibold text-[#1F2937]">
									{businessData?.name ?? ""}
								</div>
								<div className="text-xs text-[#6B7280] font-normal">{`#${
									slug ?? ""
								}`}</div>
							</div>
						}
						buttons={
							<div className="flex flex-col gap-2 md:flex-row h-fit">
								{buttons.map((button) => button)}
							</div>
						}
						backLocation={URL.BUSINESSES}
					/>
				}
				contentComponent={
					<Content
						slug={slug ?? ""}
						businessData={businessData}
						setRiskMonitoringStatus={setRiskMonitoringStatus}
						setIsRiskedModalOpened={setIsRiskedModalOpened}
						isRiskMonitoringLoading={isUpdateRiskMonitoringLoading}
						setIsScoreRefreshOpened={setIsScoreRefreshOpened}
						scroeRefreshTimeLoading={scroeRefreshTimeLoading}
						scoreRefreshTimeData={scoreRefreshTimeData}
					/>
				}
			/>

			<PurgeBusinessModal
				isPurgeBusiness={isPurgeBusiness}
				setIsPurgeBusiness={setIsPurgeBusiness}
				businessId={businessData?.id}
			/>

			<ArchiveBusinessModal
				isArchiveBusiness={isArchiveBusiness}
				setIsArchiveBusiness={setIsArchiveBusiness}
				businessId={businessData?.id}
			/>

			<div className="mt-3">
				<Suspense fallback={<></>}>
					<RemoteBusinessDetailTable
						isAgingThresholdsModalOpen={showAgingThresholdModal}
						handleCloseAgingThresholdsModal={handleShowAgingThresholdModal}
					/>
				</Suspense>
			</div>
			<Invitations businessId={slug ?? ""} name={businessData?.name} />

			<RelatedBusinesses />

			{customerIntegrationStatusData?.data?.settings?.processor_orchestration
				?.isEnabled && (
				<div className="mt-3 bg-white rounded-xl">
					<Suspense fallback={<></>}>
						<RemoteMerchantProfilesTable />
					</Suspense>
				</div>
			)}

			{isRiskModalOpened && (
				<WarningModal
					isOpen={isRiskModalOpened}
					onClose={() => {
						setIsRiskedModalOpened(false);
					}}
					onSucess={async () => {
						if (typeof riskMonitoringStatus === "boolean") {
							const payload: UpdateRiskMonitoring = {
								businessId: slug ?? "",
								customerId: getItem(LOCALSTORAGE.customerId) ?? "",
								body: {
									risk_monitoring: riskMonitoringStatus,
								},
							};
							await updateRiskMonitoring(payload);
						}
						setIsRiskedModalOpened(false);
					}}
					title="Confirmation"
					description={`Do you want to ${
						riskMonitoringStatus ? "enable" : "disable"
					} risk monitoring on this business?`}
					buttonText="Yes"
					type="dark"
				/>
			)}
			{isScoreRefreshOpened && (
				<WarningModal
					showIcon={false}
					isOpen={isScoreRefreshOpened}
					onClose={() => {
						setIsScoreRefreshOpened(false);
					}}
					onSucess={async () => {
						await scoreRefresh({ businessId: slug ?? "", customerId });
						await refetchScoreRefreshTime();
						setIsScoreRefreshOpened(false);
					}}
					title="Confirmation"
					description={`Do you want to refresh the score?`}
					buttonText="Yes"
					type="dark"
				/>
			)}
			{showModal && businessData?.name && (
				<CustomWarningModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
						searchParams.delete("showModal");
					}}
					onSucess={() => {
						setShowModal(false);
						searchParams.delete("showModal");
					}}
					title={`${String(businessData.name)} Added Successfully`}
					description={
						"The Worth Score and other business information can be found on this page. Need more information? Try sending the applicant an invitation to get a more complete picture."
					}
					buttons={
						<div className="flex justify-end gap-x-2">
							{checkAccess("businesses:create:invite") && (
								<Button
									color="grey"
									outline
									className="rounded-lg"
									onClick={() => {
										setSearchParams(
											(prev) => {
												prev.delete("showModal");
												return prev;
											},
											{ replace: true },
										);
										const labelOptioin = {
											business_id: businessData.id,
											businessName: businessData.name,
											isQuickAdd: true,
										};
										const navigateURL = `${
											URL.SEND_INVITATION
										}?${queryString.stringify(labelOptioin)}`;
										navigate(navigateURL);
									}}
								>
									Send invitation
								</Button>
							)}
							<Button
								color="dark"
								className="px-6 rounded-lg"
								onClick={() => {
									setShowModal(false);
									setSearchParams(
										(prev) => {
											prev.delete("showModal");
											return prev;
										},
										{ replace: true },
									);
								}}
							>
								Close
							</Button>
						</div>
					}
					type="success"
				/>
			)}
			{reportRequestedModal && (
				<WarningModal
					type="success"
					isOpen={reportRequestedModal}
					onClose={() => {
						setReportRequestedModal(false);
					}}
					title="360 Report Request Received"
					description="This report can take a few minutes to generate. We’ll send you an email with your full 360 report when it’s ready to be viewed."
					onSucess={() => {
						setReportRequestedModal(false);
					}}
					buttonText={"Close"}
					showCancel={false}
				/>
			)}
			{reportErrorModal && (
				<WarningModal
					type="danger"
					isOpen={reportErrorModal}
					onClose={() => {
						setReportErrorModal(false);
					}}
					title="360 Report Request Failed"
					description={`We were unable to generate a 360 report for ${businessData?.name}. You can try requesting the 360 report again. If the problem persists, please reach out to support@joinworth.com.`}
					onSucess={async () => {
						await generateReport({ customerId, businessId: slug ?? "" });
						setReportErrorModal(false);
					}}
					buttonText={"Request Again"}
					showCancel
				/>
			)}
		</React.Fragment>
	) : (
		<Navigate to={URL.AUTH_ERROR} />
	);
};

export default BusinessDetails;

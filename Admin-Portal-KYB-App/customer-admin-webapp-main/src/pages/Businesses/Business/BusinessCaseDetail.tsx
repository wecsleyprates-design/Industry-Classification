import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
	ArrowDownTrayIcon,
	ArrowPathRoundedSquareIcon,
	ClockIcon,
	DocumentCheckIcon,
	InformationCircleIcon,
	PaperAirplaneIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { isAxiosError } from "axios";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import ArchiveIcon from "@/assets/ArchiveIcon";
import DownIcon from "@/assets/DownIcon";
import PenIcon from "@/assets/PenIcon";
import BackIcon from "@/assets/svg/BackIcon";
import AuditTrail from "@/components/AuditTrail/AuditTrail";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import AlertsDropdown from "@/components/Dropdown/AlertsDropdown";
import { WarningModal } from "@/components/Modal";
import ManualReviewModal from "@/components/Modal/ManualReviewModal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title/PageTitle";
import RequestModal from "@/components/Title/RequestModal";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { WorthScoreTooltip } from "@/components/WorthScore";
import useCustomToast from "@/hooks/useCustomToast";
import {
	capitalize,
	checkFeatureAccess,
	concatenate,
	convertToLocalDate,
	getCurrentTimezone,
	getSlugReplacedURL,
	getStatusType,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { ViewTabLayout } from "@/pages/Cases";
import {
	useGetCaseByIdQuery,
	useGetWorthScoreDate,
} from "@/services/queries/businesses.query";
import {
	useArchiveCaseQuery,
	useGetCustomerOnboardingInvite,
	useGetCustomerOnboardingInviteStatus,
	useGetESignDocument,
	useGetOnboardingSetup,
	useGetWorthScoreByCaseId,
} from "@/services/queries/case.query";
import {
	useGetAccountingIncomeStatement,
	useGetBusinessVerificationDetails,
	useGetBusinessWebsite,
	useGetProcessingHistory,
	useGetVerdata,
} from "@/services/queries/integration.query";
import {
	useDownloadReport,
	useGenerateReport,
	useGetBusinessReportStatus,
} from "@/services/queries/report.query";
import { type GetCaseseByIdResponseBody } from "@/types/case";
import { STATUS_CODES } from "../../../constants/StatusCodes";

import { CASE_STATUS_ENUM } from "@/constants/CaseStatus";
import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

interface IContentProps {
	isLoading: boolean;
	applicantData: Record<string, any>;
	caseData: GetCaseseByIdResponseBody | undefined;
	setResetAuditTrail: (value: boolean) => void;
	isShowWorthScoreLoading?: boolean;
	scoreData?: Record<string, any>;
}

const Content: React.FC<IContentProps> = ({
	isLoading,
	applicantData,
	caseData,
	setResetAuditTrail,
	isShowWorthScoreLoading,
	scoreData,
}) => {
	const [open, setOpen] = useState(false);
	const [datePosition, setDatePosition] = useState<number>(0);
	const [month, setMonth] = useState<string>("");
	const [year, setYear] = useState<string>("");
	const allowedStatusesToBeTransformedFrom = [
		CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
		CASE_STATUS_ENUM.INFORMATION_REQUESTED,
		CASE_STATUS_ENUM.RISK_ALERT,
		CASE_STATUS_ENUM.INVESTIGATING,
		CASE_STATUS_ENUM.ESCALATED,
	];
	const [scoreIdsData, setScoreIdsData] = useState<
		Array<{
			date: Date;
			score_trigger_id: string;
		}>
	>([]);

	const { refetch: refetchCaseDetailsAPI } = useGetCaseByIdQuery(
		caseData?.data.id ?? "",
		{ filter: { time_zone: getCurrentTimezone() } },
	);

	const { highRiskCount, moderateRiskCount } = useMemo(
		() => ({
			highRiskCount: caseData?.data?.risk_alerts?.filter(
				(item: any) => item.risk_level === "HIGH",
			).length,
			moderateRiskCount: caseData?.data?.risk_alerts?.filter(
				(item: any) => item.risk_level === "MODERATE",
			).length,
		}),
		[caseData?.data?.risk_alerts],
	);

	const setDateSearchParameters = (year: string, month: string) => {
		setMonth(month);
		setYear(year);
	};

	const { refetch, data: worthScoreDate } = useGetWorthScoreDate(
		applicantData?.business_id ?? "",
	);

	useEffect(() => {
		if (applicantData?.business_id && year && month) void refetch();
	}, [year, month, applicantData]);

	useEffect(() => {
		if (worthScoreDate?.data?.length) {
			const getLatestPosition = worthScoreDate?.data.length - 1;
			const scoreDate = worthScoreDate?.data[getLatestPosition];
			// setScoreTriggerId(
			// 	worthScoreDate.data[getLatestPosition].score_trigger_id
			// );
			setDatePosition(getLatestPosition);
			const scores = worthScoreDate?.data.map((item: any) => ({
				date: item.fullDate,
				score_trigger_id: item.score_trigger_id,
			}));
			setScoreIdsData(scores);
			setDateSearchParameters(scoreDate.year, scoreDate.month);
		}
	}, [worthScoreDate]);

	return (
		<React.Fragment>
			{isLoading && <FullPageLoader />}
			<div>
				<div className="grid grid-cols-1 my-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
					<div>
						<p className="text-[10px] py-1 font-normal text-gray-500 tracking-tight">
							Assignee
						</p>
						<p className="py-1 text-sm font-medium tracking-tight text-slate-800">
							{concatenate([
								caseData?.data?.assignee?.first_name,
								caseData?.data?.assignee?.last_name,
							]) || "-"}
						</p>
					</div>
					<div>
						<p className="text-[10px] py-1 font-normal text-gray-500 tracking-tight">
							Applicant name
						</p>
						<p className="py-1 text-sm font-medium tracking-tight text-slate-800">
							{`${(applicantData?.applicant?.first_name as string) ?? " "} ${
								(applicantData?.applicant?.last_name as string) ?? ""
							}`}
						</p>
					</div>
					<div>
						<p className="text-[10px] py-1 font-normal text-gray-500 tracking-tight">
							Worth Score
						</p>
						<p className="py-2 text-sm font-medium tracking-tight text-slate-800">
							{scoreData?.data?.weighted_score_850 ? (
								<>
									<WorthScoreTooltip
										worthScore={scoreData?.data}
										type="month"
										showTooltip={
											isLoading || !!scoreData?.data?.is_score_calculated
										}
										date={
											new Date(
												scoreData?.data.created_at ??
													new Date(
														scoreData?.data[datePosition]?.fullDate ??
															new Date(),
													),
											)
										}
										updateDate={(_, value) => {
											const newDatePosition = datePosition + Number(value);
											setDatePosition(newDatePosition);
											const date: any = scoreData?.data?.[newDatePosition];
											setDateSearchParameters(date?.year, date?.month);
											// setScoreTriggerId(date?.score_trigger_id);
										}}
										key={"tooltip"}
										hasNext={
											datePosition < Number(scoreData?.data?.length ?? 0) - 1
										}
										hasPrevious={datePosition > 0}
										scoreIds={scoreIdsData}
										// updateScoreId={updateScoreId}
									>
										{scoreData?.data.is_score_calculated ? (
											<div className="text-sm font-medium text-[#266EF1] tracking-tight overflow-hidden break-words">
												<div className="flex flex-row gap-x-1">
													<span className="font-semibold">
														{scoreData?.data?.weighted_score_850}&nbsp;
													</span>
													/&nbsp;850
													{/* <InformationCircleIcon className="w-5 h-5 text-black" /> */}
												</div>
											</div>
										) : (
											<p className="pr-1 text-sm font-medium tracking-tight text-slate-800">
												Pending
											</p>
										)}
									</WorthScoreTooltip>
								</>
							) : (
								<>
									<div className="flex flex-row font-medium">
										Unavailable
										<ReactCustomTooltip
											id={"Score_Status"}
											tooltip={
												<>
													A Worth score could not be generated due to lack of
													data.
												</>
											}
										>
											<InformationCircleIcon
												className="w-5 h-5 ml-2 "
												aria-hidden="true"
											/>
										</ReactCustomTooltip>
									</div>
								</>
							)}
						</p>
					</div>
					<div>
						<p className="text-[10px]  py-1 font-normal text-gray-500 tracking-tight">
							Date & time
						</p>
						<p className="py-1 text-sm font-medium tracking-tight text-slate-800">
							{convertToLocalDate(
								applicantData?.applicant?.created_at,
								"MM-DD-YYYY - h:mmA",
							)}
						</p>
					</div>
					<div>
						<p className="text-[10px]  py-1 font-normal text-gray-500 tracking-tight">
							Status
						</p>
						<p className="flex py-1 text-sm font-medium tracking-tight text-slate-800">
							{!isShowWorthScoreLoading && applicantData?.status?.id && (
								<StatusBadge
									type={getStatusType(applicantData?.status?.id)}
									text={capitalize(applicantData?.status?.label)}
								/>
							)}
							{allowedStatusesToBeTransformedFrom.includes(
								applicantData?.status?.id,
							) && (
								<div
									className="self-center my-1 align-middle cursor-pointer"
									onClick={() => {
										setOpen(true);
									}}
								>
									<PenIcon fill="" height={20} width={20} />
								</div>
							)}
						</p>
					</div>

					<div className="grid items-center grid-cols-2 gap-2 mb-2 sm:flex sm:flex-col sm:items-start">
						<p className="text-[10px] text-[#5E5E5E] font-normal  tracking-tight py-1">
							Risk alerts
						</p>
						<div className="flex flex-row items-center text-sm font-medium tracking-tight break-words gap-x-1">
							<AlertsDropdown
								options={caseData?.data?.risk_alerts}
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
										{caseData?.data?.risk_alerts?.length ? (
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
						</div>
					</div>
				</div>
			</div>

			{/* Edit status */}
			{open && (
				<ManualReviewModal
					open={open}
					setOpen={setOpen}
					caseID={caseData?.data.id ?? ""}
					userID={caseData?.data.applicant?.id ?? ""}
					assignee={
						`${(caseData?.data?.assignee?.first_name as string) ?? ""} ${
							(caseData?.data?.assignee?.last_name as string) ?? ""
						}`.trim() || ""
					}
					businessId={applicantData?.business?.id ?? ""}
					caseStatus={caseData?.data?.status?.id}
					refetchCaseDetailsAPI={refetchCaseDetailsAPI}
					setResetAuditTrail={setResetAuditTrail}
				/>
			)}
		</React.Fragment>
	);
};

const BusinessCaseDetails = () => {
	const flags = useFlags();
	const { caseId } = useParams();
	const [reportRequestedModal, setReportRequestedModal] = useState(false);
	const [reportErrorModal, setReportErrorModal] = useState(false);
	const [buttons, setButtons] = useState<any[]>([]);
	const navigate = useNavigate();
	const { errorHandler, successHandler } = useCustomToast();
	const [customerId] = useState<string>(getItem("customerId") ?? "");
	const [applicantData, setApplicantData] = useState(Object);
	const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
	const [resetAuditTrail, setResetAuditTrail] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);

	const userDetails: any = getItem(LOCALSTORAGE.userDetails);

	const {
		isLoading,
		data: getApplicantData,
		error: getApplicantError,
		refetch: refetchCaseDetailsAPI,
	} = useGetCaseByIdQuery(caseId ?? "", {
		filter: { time_zone: getCurrentTimezone() },
	});

	const riskAlertStatuses = [
		CASE_STATUS_ENUM.RISK_ALERT,
		CASE_STATUS_ENUM.INVESTIGATING,
		CASE_STATUS_ENUM.ESCALATED,
		CASE_STATUS_ENUM.DISMISSED,
		CASE_STATUS_ENUM.PAUSED,
	];

	const { data: worthScoreData, isLoading: worthScoreLoading } =
		useGetWorthScoreByCaseId(
			caseId ?? "",
			riskAlertStatuses.includes(getApplicantData?.data?.status?.id)
				? { risk: "true" }
				: {},
		);

	const { data: publicRecords } = useGetVerdata({
		businessId: getApplicantData?.data.business_id ?? "",
		caseId,
	});

	const { data: processingHistoryData } = useGetProcessingHistory(
		getApplicantData?.data.business_id,
		caseId ?? "",
	);

	const { data: businessWebsiteData } = useGetBusinessWebsite({
		businessId: getApplicantData?.data.business_id ?? "",
		caseId,
	});

	const { data: eSignDocumentsData } = useGetESignDocument({
		businessId: getApplicantData?.data.business_id ?? "",
		caseId: caseId ?? "",
	});

	const {
		mutateAsync: fetchCustomerOnboardingInvite,
		isPending: fetchCustomerOnboardingInviteLoading,
		error: fetchCustomerOnboardingInviteError,
	} = useGetCustomerOnboardingInvite();

	const { data: customerOnboardingInviteStatusData } =
		useGetCustomerOnboardingInviteStatus({
			caseId: caseId ?? "",
			customerId,
		});

	const handleDisableEditApplicationClick = () => {
		errorHandler({
			message:
				"The application is currently being edited by another member of your team.",
		});
	};

	useEffect(() => {
		if (getApplicantData) {
			const obj = getApplicantData.data;
			setApplicantData(obj);
		}
	}, [getApplicantData]);

	useEffect(() => {
		if (getApplicantError && isAxiosError(getApplicantError)) {
			errorHandler(getApplicantError);
			if (getApplicantError?.response?.status !== STATUS_CODES.UNAUTHORIZED)
				navigate(
					getSlugReplacedURL(
						URL.BUSINESS_APPLICANT_CASES,
						getApplicantData?.data.business_id ?? "",
					),
				);
		}
	}, [getApplicantError]);

	useEffect(() => {
		if (fetchCustomerOnboardingInviteError) {
			errorHandler(fetchCustomerOnboardingInviteError);
		}
	}, [fetchCustomerOnboardingInviteError]);

	const { data: businessVerificationDetails } =
		useGetBusinessVerificationDetails(
			getApplicantData?.data?.business_id ?? "",
		);

	const { data: incomeStatementData, isLoading: loadingIncome } =
		useGetAccountingIncomeStatement(getApplicantData?.data.business_id ?? "");

	const incomeData = useMemo(
		() =>
			incomeStatementData &&
			Object.values(
				incomeStatementData?.data?.accounting_incomestatement,
			).reverse(),
		[incomeStatementData],
	);

	/******************************************************************************
									ARCHIVE CASE
	 ******************************************************************************/
	const {
		mutateAsync: archiveCaseAPI,
		data: archiveCaseData,
		error: archiveCaseError,
		isPending: archiveCaseLoading,
	} = useArchiveCaseQuery();

	useEffect(() => {
		if (archiveCaseData?.status === "success") {
			successHandler(archiveCaseData, () => {
				void refetchCaseDetailsAPI();
			});
		}
	}, [archiveCaseData]);

	useEffect(() => {
		if (archiveCaseError) {
			errorHandler(archiveCaseError);
		}
	}, [archiveCaseError]);

	/********************************************************************
	   					Worth 360 changes
	 ********************************************************************/

	const { data: businessReportStatusData, refetch: refetchReportStatus } =
		useGetBusinessReportStatus({
			businessId: applicantData?.business_id ?? "",
			caseId: applicantData?.id,
		});

	const {
		mutateAsync: generateReport,
		error: generateReportError,
		data: generateReportData,
	} = useGenerateReport();

	const { mutateAsync: downloadReport, data: downloadReportData } =
		useDownloadReport();

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
			errorHandler(generateReportError);
		}
	}, [generateReportError]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);

	const { data: onboardingSetupData } = useGetOnboardingSetup(customerId ?? "");

	const postSubmissionEditingEnabled = useMemo(
		() =>
			onboardingSetupData?.data?.find(
				(element) => element.code === "post_submission_editing_setup",
			)?.is_enabled,
		[onboardingSetupData],
	);

	useEffect(() => {
		// Default Buttons
		const tempButtons = [
			<Button
				key={"back"}
				className="px-2 shadow-none"
				onClick={() => {
					navigate(
						getSlugReplacedURL(
							URL.BUSINESS_DETAILS,
							applicantData?.business_id ?? "",
						),
					);
				}}
				color="transparent"
			>
				<div className="flex content-center justify-center gap-2">
					<div className="self-center">
						<BackIcon />
					</div>
					<span className="text-xs font-medium text-black">
						Back to business
					</span>
				</div>
			</Button>,

			[
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.AUTO_REJECTED,
				CASE_STATUS_ENUM.AUTO_APPROVED,
				CASE_STATUS_ENUM.SCORE_CALCULATED,
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.PENDING_DECISION,
				CASE_STATUS_ENUM.INFORMATION_REQUESTED,
			].includes(applicantData?.status?.id) && (
				<Button
					className="z-0 px-2 border-0 shadow-none"
					outline={true}
					color="transparent"
					onClick={() => {
						setIsArchiveModalOpen(true);
					}}
					icon={
						<div className="self-center">
							<ArchiveIcon />
						</div>
					}
				>
					<span className="text-sm font-medium text-red-600">Archive</span>
				</Button>
			),
			postSubmissionEditingEnabled &&
			[
				CASE_STATUS_ENUM.AUTO_REJECTED,
				CASE_STATUS_ENUM.AUTO_APPROVED,
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.INFORMATION_UPDATED,
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.PENDING_DECISION,
				CASE_STATUS_ENUM.SCORE_CALCULATED,
				CASE_STATUS_ENUM.SUBMITTED,
			].includes(applicantData?.status?.id) ? (
				<Button
					className="text-sm flex border border-gray-200 content-center justify-center w-[183px] h-11 items-center gap-2 px-2 text-gray-800 rounded-lg font-medium"
					color="grey"
					outline
					onClick={() => {
						setShowModal(true);
					}}
				>
					<PaperAirplaneIcon className="w-5 h-5 " />
					Request More Info
				</Button>
			) : postSubmissionEditingEnabled &&
			  [CASE_STATUS_ENUM.INFORMATION_REQUESTED].includes(
					applicantData?.status?.id,
			  ) ? (
				<StatusBadge
					text={"Additional Info Requested"}
					type={"gray_clock"}
					className="p-2 gap-1.5 text-gray-500 text-center"
				/>
			) : null,
		];
		if (
			flags[FEATURE_FLAGES?.PAT_466_TRIGGERING_APPLICATION_EDIT] &&
			checkFeatureAccess("case:write")
		) {
			tempButtons.push(
				<div className="relative inline-block h-10 rounded-lg w-30">
					<Button
						className="flex font-medium gap-x-2.5 text-sm items-center px-4 border-gray-200 h-11 rounded-lg"
						color="transparent"
						outline
						disabled={
							fetchCustomerOnboardingInviteLoading ||
							(customerOnboardingInviteStatusData?.data?.is_session_active &&
								customerOnboardingInviteStatusData?.data?.applicant_id !==
									userDetails?.id)
						}
						onClick={() => {
							void fetchCustomerOnboardingInvite({
								caseId: applicantData?.id,
								customerId,
							}).then((e) => {
								if (e.data) {
									window.open(e.data, "_blank");
								} else {
									console.warn("No link found in response data");
								}
							});
						}}
						key="Edit Application"
					>
						<PencilSquareIcon className="w-[18px] h-[18px] text-black" />
						Edit Application
					</Button>
					<div
						className={twMerge(
							"top-0 bottom-0 left-0 right-0 bg-transparent rounded-lg",
							customerOnboardingInviteStatusData?.data?.is_session_active &&
								customerOnboardingInviteStatusData?.data?.applicant_id !==
									userDetails?.id
								? "absolute cursor-not-allowed"
								: "relative",
						)}
						onClick={handleDisableEditApplicationClick}
					/>
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
								className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937] h-11 items-center"
								color="grey"
								outline
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
									className="px-2 rounded-lg flex content-center justify-center gap-2 text-[#1F2937] h-11 items-center"
									color="grey"
									outline
									onClick={async () => {
										setIsRegenerating(true);
										successHandler({
											message:
												"Report regeneration in progress. You’ll be able to download the updated report shortly.",
										});
										await generateReport({
											businessId: applicantData?.business_id,
											caseId: applicantData?.id,
											customerId,
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
							className="px-2 rounded-lg flex content-center justify-center gap-2 items-center h-11 cursor-not-allowed text-[#6B7280]"
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
							className="px-2 rounded-lg flex content-center justify-center gap-2 items-center h-11 cursor-not-allowed text-[#6B7280]"
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
						<Button
							className="px-2 rounded-lg flex items-center h-11 content-center justify-center gap-2 text-[#6B7280] opacity-90"
							color="grey"
							outline
							disabled
							onClick={() => {
								setReportErrorModal(true);
							}}
						>
							<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
							Report Unavailable
						</Button>,
					);
					break;
				case "FAILED_SECOND_TIME":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg items-center h-11 flex content-center justify-center gap-2 cursor-not-allowed text-[#6B7280] opacity-90"
							color="grey"
							outline
							disabled
						>
							<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
							Report Unavailable
						</Button>,
					);
					break;
				case "REQUESTED":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex content-center h-11 items-center justify-center gap-2 text-[#6B7280] cursor-not-allowed"
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
							className="px-2 rounded-lg flex content-center h-11 items-center justify-center gap-2 text-[#1F2937]"
							color="grey"
							outline
							onClick={async () => {
								await generateReport({
									businessId: applicantData?.business_id,
									caseId: applicantData?.id,
									customerId,
								});
							}}
						>
							<ArrowDownTrayIcon className="w-4 h-4" />
							Download Report
						</Button>,
					);
					break;
				case "DOWNLOAD_REPORT_UNAVAILABLE":
					tempButtons.push(
						<Button
							className="px-2 rounded-lg flex items-center h-11 content-center justify-center gap-2 cursor-not-allowed text-[#6B7280] opacity-90"
							color="grey"
							outline
							disabled
						>
							<ArrowDownTrayIcon className="w-4 h-4 text-[#6B7280]" />
							Report Unavailable
						</Button>,
					);
					break;
				default:
					break;
			}
			setButtons(tempButtons);
		} else {
			setButtons(tempButtons);
		}
	}, [businessReportStatusData, applicantData]);

	return (
		<React.Fragment>
			{(isLoading || worthScoreLoading || archiveCaseLoading) && (
				<FullPageLoader />
			)}
			{isArchiveModalOpen && (
				<WarningModal
					isOpen={isArchiveModalOpen}
					onClose={() => {
						setIsArchiveModalOpen(false);
					}}
					onSucess={async () => {
						await archiveCaseAPI({
							customerId,
							caseId: caseId ?? "",
							body: {
								status: CASE_STATUS_ENUM.ARCHIVED,
							},
						});
					}}
					title={`Archive case`}
					description={`Are you sure you want to archive this case?`}
					buttonText={"Archive"}
					type={"danger"}
				/>
			)}
			<Card
				headerComponent={
					<PageTitle
						titleText={`#${caseId ?? ""}`}
						buttons={
							<div className="flex flex-col gap-2 md:flex-row h-fit">
								{buttons.filter((button) => button).map((button) => button)}
							</div>
						}
						isBackAllowed={false}
						businessName={applicantData?.business?.name}
					/>
				}
				contentComponent={
					<Content
						isLoading={isLoading}
						applicantData={applicantData}
						caseData={getApplicantData}
						setResetAuditTrail={setResetAuditTrail}
						isShowWorthScoreLoading={worthScoreLoading || loadingIncome}
						scoreData={worthScoreData}
					/>
				}
			/>
			<div className="grid grid-cols-12 gap-4">
				<div className="col-span-12 sm:col-span-7">
					<ViewTabLayout
						applicantData={applicantData}
						publicRecords={publicRecords}
						businessWebsiteData={businessWebsiteData}
						businessVerificationDetails={businessVerificationDetails}
						incomeData={incomeData}
						loadingIncome={loadingIncome}
						processingHistory={processingHistoryData}
						eSignDocumentsData={eSignDocumentsData?.data}
					/>
				</div>
				<div className="col-span-12 sm:col-span-5">
					{applicantData?.business_id && applicantData?.id && (
						<div className="flex flex-row w-full">
							<div className="w-full p-6 pt-2 mt-8 bg-white border rounded-lg shadow">
								<AuditTrail
									businessId={applicantData?.business_id ?? ""}
									caseId={applicantData?.id ?? ""}
									title="Audit Trail"
									inCase={true}
									resetAuditTrail={resetAuditTrail}
									setResetAuditTrail={setResetAuditTrail}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
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
					description={`We were unable to generate a 360 report for ${String(
						applicantData?.business?.name ?? "-",
					)}. You can try requesting the 360 report again. If the problem persists, please reach out to support@joinworth.com.`}
					onSucess={async () => {
						await generateReport({
							businessId: applicantData?.business_id,
							caseId: applicantData?.id,
							customerId,
						});
						setReportErrorModal(false);
					}}
					buttonText={"Request Again"}
					showCancel
				/>
			)}
			{showModal && (
				<RequestModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
					}}
					onSuccess={async () => {
						await refetchCaseDetailsAPI();
						setShowModal(false);
					}}
					caseId={caseId ?? ""}
				/>
			)}
		</React.Fragment>
	);
};

export default BusinessCaseDetails;

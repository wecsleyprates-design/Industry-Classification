import React, { useEffect, useMemo, useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import {
	ArchiveBoxIcon,
	CheckCircleIcon,
	ChevronLeftIcon,
	DocumentDuplicateIcon,
	InformationCircleIcon,
	PaperAirplaneIcon,
	PencilSquareIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useFlags } from "launchdarkly-react-client-sdk";
import queryString from "query-string";
import { IndicatorDotIcon } from "@/assets/IndicatorDotIcon";
import {
	INTEGRATION_STATUS,
	type IntegrationStatus,
	useCustomToast,
	usePermission,
} from "@/hooks";
import { getItem } from "@/lib/localStorage";
import { cn, formatLocalDate } from "@/lib/utils";
import {
	useArchiveCaseQuery,
	useGetCaseStatuses,
	useGetCustomerOnboardingInvite,
	useGetCustomerOnboardingInviteStatus,
	useGetOnboardingSetup,
} from "@/services/queries/case.query";
import {
	useGetMatchProData,
	useGetSubDomainInfoMutate,
} from "@/services/queries/integration.query";
import { useGetUsers } from "@/services/queries/user.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import type { CaseData, CaseStatus } from "@/types/case";
import ArchiveConfirmationModal from "./components/ArchiveConfirmationModal";
import { CloneCaseFormModal } from "./components/CloneCaseFormModal";
import {
	MoreActionsMenu,
	type MoreActionsMenuProps,
} from "./components/MoreActionsMenu";
import { RiskAlertsDropdown } from "./components/RiskAlertsDropdown";
import { StatusDisplay } from "./components/StatusDisplay";
import UpdateStatusModal from "./components/UpdateStatusModal";
import { useReportActions } from "./hooks/useReportActions";
import { RequestInfoModal } from "./components";

import {
	DATE_FORMATS,
	LOCALSTORAGE,
	URL,
	VALUE_NOT_AVAILABLE,
} from "@/constants";
import {
	CASE_STATUS_ENUM,
	UPDATABLE_ONBOARDING_STATUSES,
	UPDATABLE_RISK_STATUSES,
} from "@/constants/case-status";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { Button, SegmentedButton } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";

const CaseDetailsHeader: React.FC<{
	backNavigateTo?: string;
	caseData?: CaseData;
	isCaseDataLoading?: boolean;
	refetchCaseDetails: () => void;
	integrationStatus: IntegrationStatus;
	runIntegrationsForEditedFacts: () => Promise<void>;
}> = ({
	caseData,
	isCaseDataLoading,
	refetchCaseDetails,
	integrationStatus,
	runIntegrationsForEditedFacts,
}) => {
	const caseId = caseData?.id ?? "";
	const businessId = caseData?.business_id ?? "";

	const { data: matchProData } = useGetMatchProData(businessId);

	const navigate = useNavigate();
	const flags = useFlags();
	const isCaseEditingFlagEnabled =
		flags[FEATURE_FLAGS.PAT_874_CM_APP_EDITING] ?? false;

	const { moduleType, platformType } = useAppContextStore();
	const {
		hasEdits,
		lastAutoSavedAt,
		showAutoSaveToast,
		setShowAutoSaveToast,
	} = useInlineEditStore(caseId);

	// Format the last updated timestamp
	const formattedLastUpdatedTime = lastAutoSavedAt
		? new Date(lastAutoSavedAt)
				.toLocaleTimeString("en-US", {
					hour: "numeric",
					minute: "2-digit",
					hour12: true,
				})
				.toLowerCase()
		: null;

	// Auto-dismiss the auto-save toast after 3 seconds
	useEffect(() => {
		if (showAutoSaveToast) {
			const timer = setTimeout(() => {
				setShowAutoSaveToast(false);
			}, 3000);
			return () => {
				clearTimeout(timer);
			};
		}
	}, [showAutoSaveToast, setShowAutoSaveToast]);

	const isCustomerPlatform = platformType === "customer"; // few actions can only be taken by customer admin so this flag is used to conditionally render those actions
	const hasAdditionalInfoAccess = usePermission("case:write:additional_info");
	const hasWriteAccess = usePermission("case:write");

	const hasCloneCaseAccess = usePermission("businesses:create");

	// back redirect URL based on platform and module type
	const caseDetailsBaseURL = useMemo(() => {
		if (platformType === "admin" && moduleType === "customer_case") {
			const path = generatePath(URL.CUSTOMER_DETAILS, {
				slug: caseData?.customer_id ?? "",
			});
			return `${path}?tab=cases`;
		} else if (moduleType === "business_case") {
			return generatePath(URL.BUSINESS_CASES, {
				slug: caseData?.business_id ?? "",
			});
		} else if (moduleType === "standalone_case") {
			return URL.STANDALONE_CASES;
		} else {
			return URL.CASES;
		}
	}, [
		platformType,
		moduleType,
		caseData?.customer_id,
		caseData?.business_id,
	]);

	const [isRequestInfoModalOpen, setIsRequestInfoModalOpen] = useState(false);
	const [isArchiveConfirmationModalOpen, setIsArchiveConfirmationModalOpen] =
		useState(false);
	const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] =
		useState(false);

	const [isCloneCaseModalOpen, setIsCloneCaseModalOpen] = useState(false);
	const reportMenuItems = useReportActions({ caseData });

	const { errorToast, successToast } = useCustomToast();

	const { mutateAsync: archiveCase, isPending: isLoadingArchiveCase } =
		useArchiveCaseQuery();

	const handleArchiveCase = async () => {
		setIsArchiveConfirmationModalOpen(false);
		try {
			await archiveCase({
				customerId: caseData?.customer_id ?? "",
				caseId: caseData?.id ?? "",
				body: {
					status: CASE_STATUS_ENUM.ARCHIVED,
				},
			});
			refetchCaseDetails();
			successToast("Case archived successfully");
		} catch (error) {
			errorToast(error);
		}
	};

	const {
		mutateAsync: fetchCustomerOnboardingInvite,
		isPending: fetchCustomerOnboardingInviteLoading,
	} = useGetCustomerOnboardingInvite();

	const userDetails: any = getItem(LOCALSTORAGE.userDetails);

	const {
		data: customerOnboardingInviteStatusData,
		refetch: refetchCustomerOnboardingInviteStatus,
	} = useGetCustomerOnboardingInviteStatus({
		caseId: caseData?.id ?? "",
		customerId: caseData?.customer_id ?? "",
	});

	const { mutateAsync: getSubDomainInfo } = useGetSubDomainInfoMutate();

	const handleEditCase = async () => {
		try {
			const [
				{ data: customerOnboardingInviteData },
				{ data: subdomainInfo },
			] = await Promise.all([
				fetchCustomerOnboardingInvite({
					caseId: caseData?.id ?? "",
					customerId: caseData?.customer_id ?? "",
				}),
				getSubDomainInfo(caseData?.customer_id ?? ""),
			]);
			await refetchCustomerOnboardingInviteStatus();
			if (!customerOnboardingInviteData) {
				errorToast("Error editing case");
				return;
			}

			const whitelableSubDomain = subdomainInfo?.domain?.split(".")[0];
			const redirectLink = whitelableSubDomain
				? customerOnboardingInviteData.replace(
						"app",
						whitelableSubDomain,
					)
				: customerOnboardingInviteData;

			window.open(redirectLink, "_blank");
		} catch (error) {
			errorToast(error);
		}
	};

	const dbaName =
		caseData?.business_names?.find((dba) => !dba.is_primary)?.name ??
		undefined;

	const { data: onboardingSetupData, isLoading: onboardingSetupLoading } =
		useGetOnboardingSetup(caseData?.customer_id ?? "");

	const { data: caseStatusesResponse, isLoading: caseStatusesLoading } =
		useGetCaseStatuses();

	// the status object returned in getCaseById API has code as the id and the id as the code
	// this is a temporary fix to match the structure of the caseData.status object
	// to the actual caseStatusesResponse and caseStatus data model
	const caseStatus: CaseStatus = useMemo(
		() => ({
			id: caseData?.status?.code ?? 0,
			code: (caseData?.status?.id as CaseStatus["code"]) ?? "",
			label: caseData?.status?.label ?? "",
		}),
		[caseData?.status],
	);

	const allowedStatusesToBeUpdated = [
		...UPDATABLE_ONBOARDING_STATUSES,
		...UPDATABLE_RISK_STATUSES,
	];

	const allowedStatusesToBeArchived: CASE_STATUS_ENUM[] =
		UPDATABLE_ONBOARDING_STATUSES.filter(
			(status) => status !== CASE_STATUS_ENUM.ARCHIVED,
		);

	const { data: customerUsersDataResponse } = useGetUsers(
		caseData?.customer_id ?? "",
		queryString.stringify({
			"filter[status][0]": "ACTIVE",
			pagination: false,
		}),
	);

	const canRequestMoreInfo = useMemo(
		() =>
			onboardingSetupData?.data?.find(
				(element) => element.code === "post_submission_editing_setup",
			)?.is_enabled &&
			[
				CASE_STATUS_ENUM.AUTO_REJECTED,
				CASE_STATUS_ENUM.AUTO_APPROVED,
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.INFORMATION_UPDATED,

				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.PENDING_DECISION,
			].includes(caseStatus?.code as CASE_STATUS_ENUM),
		[onboardingSetupData?.data, caseStatus?.code],
	);

	const menuItems: MoreActionsMenuProps["menuItems"] = [
		{
			label: (
				<>
					<span className={cn(hasEdits && "text-blue-600")}>
						Re-Run Integrations
					</span>

					{hasEdits && (
						<>
							<Tooltip
								content="Recent edits on this case may impact the overall accuracy. Click Re-Run to update fields and refresh the case."
								side="left"
								trigger={
									<InformationCircleIcon className="size-4" />
								}
							/>
							<span className="absolute right-0 flex items-center pr-1">
								<IndicatorDotIcon />
							</span>
						</>
					)}
				</>
			),
			icon: (
				<ArrowPathIcon
					className={cn(hasEdits && "text-blue-600", "size-4")}
				/>
			),
			onClick: () => {
				void runIntegrationsForEditedFacts();
			},
			isDisabled:
				integrationStatus === INTEGRATION_STATUS.TRIGGERING ||
				matchProData?.metadata?.status === "MATCHING_LOADING",
			hidden:
				!isCaseEditingFlagEnabled ||
				!isCustomerPlatform ||
				!hasWriteAccess,
		},
		{
			label: "Clone Case to New Business",
			icon: <DocumentDuplicateIcon className="size-4" />,
			onClick: () => {
				setIsCloneCaseModalOpen(true);
			},
			hidden: !hasCloneCaseAccess || !isCustomerPlatform,
		},
		...reportMenuItems,
		{
			label: "Archive",
			icon: <ArchiveBoxIcon className="size-4" />,
			onClick: () => {
				setIsArchiveConfirmationModalOpen(true);
			},
			hidden: !isCustomerPlatform,
			isDisabled:
				isLoadingArchiveCase ||
				!allowedStatusesToBeArchived.includes(
					caseStatus?.code as CASE_STATUS_ENUM,
				),
		},
	];

	const isLoading =
		isLoadingArchiveCase ||
		fetchCustomerOnboardingInviteLoading ||
		caseStatusesLoading ||
		(caseData?.customer_id && onboardingSetupLoading); // show onboardingSetupLoading only if customer_id is present

	const isEditApplicationDisabled =
		fetchCustomerOnboardingInviteLoading ||
		(customerOnboardingInviteStatusData?.data?.is_session_active &&
			customerOnboardingInviteStatusData?.data?.applicant_id !==
				userDetails?.id);

	return (
		<>
			{/** Fixed white background behind header to prevent overscroll color issues. */}
			<div className="h-[20vh] bg-white fixed top-0 left-0 right-0 -z-10" />

			{/* Auto-save toast notification */}
			{showAutoSaveToast && (
				<div className="fixed top-36 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 animate-in slide-in-from-top-2 fade-in duration-200">
					<CheckCircleIcon className="h-5 w-5 text-green-500" />
					<span className="text-sm font-medium text-green-600">
						Your new edit has been auto-saved.
					</span>
					<button
						onClick={() => {
							setShowAutoSaveToast(false);
						}}
						className="ml-2 text-gray-400 hover:text-gray-600"
						aria-label="Close"
					>
						×
					</button>
				</div>
			)}

			<div className="px-4 pt-4 mt-2 bg-white">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="outline"
							size="icon"
							className="rounded-lg"
							onClick={() => {
								navigate(caseDetailsBaseURL);
							}}
						>
							<ChevronLeftIcon strokeWidth={2} />
						</Button>
						<div className="flex flex-col">
							<h1 className="text-lg font-semibold">
								Case Details
							</h1>
							{isCaseDataLoading ? (
								<h2 className="flex items-center gap-1 text-sm text-gray-500">
									<Skeleton className="w-20 h-5" />
									{" • "}
									<Skeleton className="w-20 h-5" />
									{" • "}
									<Skeleton className="w-20 h-5" />
								</h2>
							) : (
								<h2 className="text-sm text-gray-500">
									{dbaName
										? `${dbaName} (${caseData?.business?.name})`
										: caseData?.business?.name}
									{" • "}
									{caseData?.business?.created_at
										? formatLocalDate(
												caseData.business.created_at,
												DATE_FORMATS.MONTH_DAY_YEAR_TIME,
											)
										: VALUE_NOT_AVAILABLE}
									{integrationStatus ===
										INTEGRATION_STATUS.COMPLETE &&
										" • Integrations Complete"}
								</h2>
							)}
						</div>
					</div>
					{isLoading ? (
						<Skeleton className="w-1/3 h-10" />
					) : (
						<div className="flex items-center space-x-2">
							{/* Last updated timestamp */}
							{formattedLastUpdatedTime && (
								<div className="text-sm text-gray-500 mr-2">
									Last auto-saved at{" "}
									{formattedLastUpdatedTime}
								</div>
							)}
							{isCustomerPlatform &&
								allowedStatusesToBeUpdated.includes(
									caseStatus?.code as CASE_STATUS_ENUM,
								) && (
									<SegmentedButton
										/**
										 * A negative margin (-mt-1) is used here to visually align the square in the icon on the y-axis.
										 * This means that, while it's not *actually* centered, it *looks* centered.
										 */
										icon={
											<PencilSquareIcon className="-mt-1" />
										}
										label={
											<StatusDisplay
												statusCode={caseStatus.code}
											/>
										}
										onClick={() => {
											setIsUpdateStatusModalOpen(true);
										}}
										tooltip="Change Case Status"
									/>
								)}

							<RiskAlertsDropdown
								riskAlerts={caseData?.risk_alerts ?? []}
							/>

							{isCustomerPlatform && hasAdditionalInfoAccess && (
								<Tooltip
									trigger={
										<Button
											variant="outline"
											size="icon"
											onClick={() => {
												setIsRequestInfoModalOpen(true);
											}}
											disabled={!canRequestMoreInfo}
										>
											<PaperAirplaneIcon />
										</Button>
									}
									side="bottom"
									content={
										canRequestMoreInfo
											? "Request Additional Info"
											: "Access available after the case is submitted."
									}
								/>
							)}

							{isCustomerPlatform && hasWriteAccess && (
								<Tooltip
									trigger={
										<Button
											variant="outline"
											size="icon"
											onClick={() => {
												void handleEditCase();
											}}
											disabled={isEditApplicationDisabled}
										>
											<WrenchScrewdriverIcon />
										</Button>
									}
									side="bottom"
									content={
										isEditApplicationDisabled ? (
											<>
												The application is currently
												being edited by another member
												of your team.
											</>
										) : (
											<>Edit Application</>
										)
									}
								/>
							)}

							<MoreActionsMenu
								menuItems={menuItems}
								badge={hasEdits && <IndicatorDotIcon />}
							/>

							{isCloneCaseModalOpen && (
								<CloneCaseFormModal
									caseId={caseData?.id ?? ""}
									isOpen={isCloneCaseModalOpen}
									onClose={() => {
										setIsCloneCaseModalOpen(false);
									}}
								/>
							)}

							<RequestInfoModal
								isOpen={isRequestInfoModalOpen}
								onClose={() => {
									setIsRequestInfoModalOpen(false);
								}}
								onSuccess={() => {
									refetchCaseDetails();
									setIsRequestInfoModalOpen(false);
								}}
								caseId={caseData?.id ?? ""}
							/>

							<ArchiveConfirmationModal
								isOpen={isArchiveConfirmationModalOpen}
								onClose={() => {
									setIsArchiveConfirmationModalOpen(false);
								}}
								onSuccess={() => {
									void handleArchiveCase();
								}}
							/>
							<UpdateStatusModal
								isOpen={isUpdateStatusModalOpen}
								onClose={() => {
									setIsUpdateStatusModalOpen(false);
								}}
								onSuccess={() => {
									refetchCaseDetails();
									setIsUpdateStatusModalOpen(false);
								}}
								status={caseStatus}
								statusOptions={caseStatusesResponse?.data ?? []}
								customerUsers={
									customerUsersDataResponse?.data?.records ??
									[]
								}
								caseData={caseData}
							/>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default CaseDetailsHeader;

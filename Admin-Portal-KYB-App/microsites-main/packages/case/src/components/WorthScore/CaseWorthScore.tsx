import { type FC, useCallback, useMemo, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useFlags } from "launchdarkly-react-client-sdk";
import {
	buildRerunBodyFromVisibleRows,
	CaseDecisioningResults,
	getCaseResultsNavigationTarget,
	getVisibleOnboardingResultRowIds,
	mapCaseTabValuesToOnboardingResults,
	type OnboardingResultRowId,
} from "@/components/CaseDecisioningResults";
import { WorkflowWidget } from "@/components/Workflows";
import {
	useGetCustomerWorkflows,
	useGetWorthScoreByCaseId,
	useUpdateCaseValuesGeneratedAt,
} from "@/services/queries/case.query";
import {
	useAcknowledgeCaseTabValues,
	useGetCaseTabValues,
	useGetCustomerIntegrationSettings,
	useRerunIntegrations,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import WorthScorePendingState from "./WorthScorePendingState";

import { URL } from "@/constants";
import type { CASE_STATUS_ENUM } from "@/constants/case-status";
import { RISK_STATUS_TRANSITIONS } from "@/constants/case-status";
import { FEATURE_FLAGS } from "@/constants/FeatureFlags";
import { WORKFLOW_DECISION_ENUM } from "@/constants/Workflows";
import { WorkflowDecisionContext } from "@/contexts/WorkflowDecisionContext";
import { Skeleton } from "@/ui/skeleton";
import { WorthScore } from "@/ui/worth-score";

interface DecisioningSlotProps {
	businessId?: string;
	caseId: string;
	customerId: string;
	/** "Generated on" date: Worth Score date or values_generated_at, else today. */
	generatedAt: string;
	/** True when the displayed date is from Re-verify (values_generated_at) — show "Regenerated on". */
	isRegenerated?: boolean;
	/** Called when user clicks Re-verify Data Now (triggers integrations rerun, then refetch). */
	onReverify?: () => void;
	/** True while Re-verify is in progress. */
	isReverifying?: boolean;
	/** Current case details main tab (e.g. "overview", "kyb", "kyc"). Overview shows all values; others show only that tab's values. */
	currentMainTab?: string;
	/** Called when workflow decision changes. */
	setWorkflowDecision?: (decision: string) => void;
}

/**
 * Renders the decisioning slot: WorkflowWidget or CaseDecisioningResults.
 * Each component is shown only when its feature flag is enabled.
 * When both flags are enabled, behavior is not yet defined.
 */
function DecisioningSlot({
	businessId,
	caseId,
	customerId,
	generatedAt,
	isRegenerated,
	onReverify,
	isReverifying,
	currentMainTab,
	setWorkflowDecision,
}: DecisioningSlotProps) {
	const flags = useFlags();
	const navigate = useNavigate();
	const {
		moduleType,
		platformType,
		customerId: storeCustomerId,
		businessId: storeBusinessId,
	} = useAppContextStore();
	const isCaseResultsEnabled =
		flags[FEATURE_FLAGS.PAT_896_WORTH_SCORE_ONBOARDING_RESULTS];
	const isWorkflowsEnabled = flags[FEATURE_FLAGS.FOTC_79_APPROVAL_WORKFLOWS];

	useGetCustomerWorkflows(customerId, {
		enabled: isWorkflowsEnabled && !!customerId,
	});

	const { data: caseTabValuesData, isLoading: caseTabValuesLoading } =
		useGetCaseTabValues({
			businessId: businessId ?? "",
			caseId,
			enabled: isCaseResultsEnabled,
		});
	const { data: customerIntegrationSettings } =
		useGetCustomerIntegrationSettings(customerId);
	const enabledRowIds = useMemo(() => {
		const settings = customerIntegrationSettings?.data?.settings;
		const visible = getVisibleOnboardingResultRowIds(settings);
		return new Set<OnboardingResultRowId>(visible);
	}, [customerIntegrationSettings?.data?.settings]);
	const onboardingResults = mapCaseTabValuesToOnboardingResults(
		caseTabValuesData?.data,
	);

	const caseDetailsBaseURL = useMemo(() => {
		if (platformType === "admin" && moduleType === "customer_case")
			return URL.CUSTOMER_APPLICANT_CASE_DETAILS;
		if (platformType === "admin" && moduleType === "standalone_case")
			return URL.STANDALONE_CASE_DETAILS;
		if (moduleType === "standalone_case")
			return URL.STANDALONE_CASE_DETAILS;
		if (platformType === "admin" && moduleType === "business_case")
			return URL.BUSINESS_APPLICANT_CASE_DETAILS;
		return URL.CASE_DETAILS;
	}, [platformType, moduleType]);

	const onRowClick = useCallback(
		(rowId: OnboardingResultRowId) => {
			const target = getCaseResultsNavigationTarget(rowId);
			if (!target) return;
			const path = generatePath(caseDetailsBaseURL, {
				id: caseId,
				slug: storeCustomerId ?? customerId,
				mainTab: target.mainTab,
				subTab: target.subTab,
				businessId: storeBusinessId ?? businessId ?? "",
			});
			const pathWithHash = target.sectionId
				? `${path}#${target.sectionId}`
				: path;
			navigate(pathWithHash, { replace: true });
		},
		[
			caseDetailsBaseURL,
			caseId,
			customerId,
			storeCustomerId,
			storeBusinessId,
			businessId,
			navigate,
		],
	);

	if (!isWorkflowsEnabled && !isCaseResultsEnabled) {
		return null;
	}
	if (isWorkflowsEnabled && !isCaseResultsEnabled) {
		return (
			<WorkflowWidget
				caseId={caseId}
				onActionAppliedChange={setWorkflowDecision}
			/>
		);
	}
	if (isCaseResultsEnabled && !isWorkflowsEnabled) {
		if (caseTabValuesLoading) {
			return <CaseResultsLineLoader />;
		}
		const showRegenerated =
			caseTabValuesData?.data?.updated_at != null || isRegenerated;
		return (
			<CaseDecisioningResults
				results={onboardingResults}
				currentMainTab={currentMainTab}
				onRowClick={onRowClick}
				generatedAt={
					showRegenerated &&
					caseTabValuesData?.data?.updated_at != null
						? caseTabValuesData.data.updated_at
						: (caseTabValuesData?.data?.created_at ?? generatedAt)
				}
				isRegenerated={showRegenerated}
				hasUpdatesSinceGenerated={
					caseTabValuesData?.data?.has_updates_since_generated ??
					false
				}
				updatesCount={caseTabValuesData?.data?.updates_count ?? 0}
				onReverify={onReverify}
				isReverifying={isReverifying}
				enabledRowIds={enabledRowIds}
			/>
		);
	}
	// Both flags enabled: scenario not yet defined; hide decisioning slot until product specifies behavior.
	return null;
}

function CaseResultsLineLoader() {
	return (
		<div className="mt-12 flex flex-col">
			<h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500">
				Case Results
			</h2>
			<div className="relative h-2 rounded-full">
				<div className="absolute top-0 left-0 flex h-full w-full gap-1.5">
					<Skeleton className="h-3.5 w-[32%] rounded-full" />
					<Skeleton className="h-3.5 w-[32%] rounded-full" />
					<Skeleton className="h-3.5 w-[32%] rounded-full" />
				</div>
			</div>
		</div>
	);
}

interface CaseWorthScoreProps {
	businessId?: string;
	caseId: string;
	caseStatus?: CASE_STATUS_ENUM;
}

const CaseWorthScore: FC<CaseWorthScoreProps> = ({
	businessId,
	caseId,
	caseStatus,
}: CaseWorthScoreProps) => {
	const [workflowDecision, setWorkflowDecision] = useState<
		WORKFLOW_DECISION_ENUM | string
	>("");
	const workflowDecisionColor = useMemo(() => {
		switch (workflowDecision) {
			case WORKFLOW_DECISION_ENUM.AUTO_APPROVED:
				return "text-green-600";
			case WORKFLOW_DECISION_ENUM.AUTO_REJECTED:
				return "text-red-600";
			default:
				return "text-gray-500";
		}
	}, [workflowDecision]);
	const { customerId } = useAppContextStore();
	const { mainTab: currentMainTab } = useParams<{ mainTab?: string }>();

	const params = {
		...(caseStatus && RISK_STATUS_TRANSITIONS.includes(caseStatus)
			? { risk: true }
			: {}),
	};
	const { data: worthScoreData, isLoading: worthScoreLoading } =
		useGetWorthScoreByCaseId(caseId, params);
	const queryClient = useQueryClient();
	const { mutateAsync: updateValuesGeneratedAt } =
		useUpdateCaseValuesGeneratedAt(caseId, params);
	const { mutateAsync: acknowledgeCaseTabValues } =
		useAcknowledgeCaseTabValues();
	const rerunIntegrationsMutation = useRerunIntegrations();
	const { data: customerIntegrationSettings } =
		useGetCustomerIntegrationSettings(customerId);
	const enabledRowIds = useMemo(() => {
		const settings = customerIntegrationSettings?.data?.settings;
		const visible = getVisibleOnboardingResultRowIds(settings);
		return new Set<OnboardingResultRowId>(visible);
	}, [customerIntegrationSettings?.data?.settings]);

	const weightedScoreBy850 = Number(
		worthScoreData?.data?.weighted_score_850 ?? 0,
	);
	const worthScoreModelVersion = worthScoreData?.data?.version;
	const worthScoreGeneratedDate = worthScoreData?.data?.created_at;
	const riskLevel = worthScoreData?.data?.risk_level;
	const isScoreCalculated = worthScoreData?.data?.is_score_calculated;

	// "Generated on": Worth Score values_generated_at (after Re-verify) or score created_at, else today
	const generatedAt =
		worthScoreData?.data?.values_generated_at ??
		worthScoreData?.data?.created_at ??
		new Date().toISOString();
	const isRegenerated = !!worthScoreData?.data?.values_generated_at;
	const [isReverifying, setIsReverifying] = useState(false);

	const onReverify = useCallback(async () => {
		if (!businessId) return;
		setIsReverifying(true);
		const body = buildRerunBodyFromVisibleRows(enabledRowIds);
		try {
			// 1. Re-run integrations; stay loading until 200
			await rerunIntegrationsMutation.mutateAsync({ businessId, body });
			// 2. Acknowledge case tab values (200)
			await acknowledgeCaseTabValues({ businessId, caseId });
			// 3. Update values_generated_at on the score
			await updateValuesGeneratedAt(new Date().toISOString());
			// 4. Refetch so values and score endpoints return 200 and UI has fresh data
			await queryClient.refetchQueries({
				queryKey: ["getCaseTabValues", businessId, caseId],
			});
			await queryClient.refetchQueries({
				queryKey: ["getScoreByCaseId", caseId],
			});
		} finally {
			setIsReverifying(false);
		}
	}, [
		acknowledgeCaseTabValues,
		businessId,
		caseId,
		enabledRowIds,
		queryClient,
		rerunIntegrationsMutation,
		updateValuesGeneratedAt,
	]);

	const decisioningSlot = (
		<DecisioningSlot
			businessId={businessId}
			caseId={caseId}
			customerId={customerId}
			generatedAt={generatedAt}
			isRegenerated={isRegenerated}
			onReverify={onReverify}
			isReverifying={isReverifying}
			currentMainTab={currentMainTab}
			setWorkflowDecision={setWorkflowDecision}
		/>
	);

	return (
		<WorkflowDecisionContext.Provider value={{ workflowDecision }}>
			{!isScoreCalculated && !worthScoreLoading ? (
				<WorthScorePendingState
					workflowDecision={workflowDecision}
					workflowDecisionColor={workflowDecisionColor}
				>
					{decisioningSlot}
				</WorthScorePendingState>
			) : (
				<WorthScore
					workflowDecision={workflowDecision}
					workflowDecisionColor={workflowDecisionColor}
					score={weightedScoreBy850}
					maxScore={850}
					generatedDate={worthScoreGeneratedDate}
					modelVersion={worthScoreModelVersion}
					isLoading={worthScoreLoading}
					riskLevel={riskLevel}
				>
					{decisioningSlot}
				</WorthScore>
			)}
		</WorkflowDecisionContext.Provider>
	);
};

export default CaseWorthScore;

import React from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import CaseWorthScore from "@/components/WorthScore/CaseWorthScore";
import { type GetCaseByIdResponse } from "@/types/case";

import { CASE_STATUS_ENUM } from "@/constants/case-status";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { ApplicationProgress } from "@/ui/application-progress";

interface CaseProgressOrScoreProps {
	caseId: string;
	caseData?: GetCaseByIdResponse;
}

/**
 * Wrapper component that conditionally renders either:
 * - ApplicationProgress (when case is in ONBOARDING, has application_progress, and is NOT submitted) - currently behind a feature flag
 * - CaseWorthScore (otherwise)
 *
 * This component should be used in all tabs except watchlists which shows a different component.
 */
const CaseProgressOrScore: React.FC<CaseProgressOrScoreProps> = ({
	caseId,
	caseData,
}) => {
	const flags = useFlags();
	const statusId = caseData?.data?.status?.id;

	const isApplicationCompletionTrackingEnabled =
		flags[FEATURE_FLAGS.DOS_948_TRACK_APPLICATION_COMPLETION];

	const shouldPauseDecisioningEnabled =
		flags[FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING];

	const shouldHideResults =
		caseData?.data?.status?.id === CASE_STATUS_ENUM.CREATED ||
		caseData?.data?.status?.id === CASE_STATUS_ENUM.INVITED;

	// If pause decisioning is enabled and case is in CREATED or INVITED, show nothing
	if (shouldPauseDecisioningEnabled && shouldHideResults) {
		return null;
	}

	// If flag is disabled, only show worth score
	if (!isApplicationCompletionTrackingEnabled) {
		return (
			<CaseWorthScore
				businessId={caseData?.data?.business_id}
				caseId={caseId}
				caseStatus={statusId}
			/>
		);
	}

	// If flag is enabled, check if we should show application progress
	const applicationInProgress =
		caseData?.data?.status?.id === CASE_STATUS_ENUM.ONBOARDING &&
		caseData?.data?.application_progress !== undefined;
	const percentComplete =
		caseData?.data?.application_progress?.percent_complete ?? 0;
	const isSubmitted =
		caseData?.data?.application_progress?.is_submitted ?? false;

	// Show application progress if in progress and not submitted
	if (applicationInProgress && !isSubmitted) {
		return (
			<ApplicationProgress
				percentComplete={percentComplete}
				isSubmitted={isSubmitted}
			/>
		);
	}

	// Otherwise (submitted, not in ONBOARDING, or no progress data), show worth score
	return (
		<CaseWorthScore
			businessId={caseData?.data?.business_id}
			caseId={caseId}
			caseStatus={statusId}
		/>
	);
};

export default CaseProgressOrScore;

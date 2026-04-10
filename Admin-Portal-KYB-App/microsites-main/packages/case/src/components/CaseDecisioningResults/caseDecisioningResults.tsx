import { type FC } from "react";
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import dayjs from "dayjs";
import { isOnboardingResultRowVisibleOnTab } from "@/components/CaseDecisioningResults/caseResultsNavigation";

import { ConditionSection } from "@/ui/condition-section";

/**
 * Row keys for onboarding result conditions.
 * Rows are grouped by status: failed (red), passed (green), missing (orange).
 */
export const ONBOARDING_RESULT_ROW_IDS = [
	"tin_business_registration",
	"business_address_business_registration",
	"business_address_google_profile",
	"business_name",
	"website_parked_domain",
	"website_status",
	"watchlist_hits",
	"idv_verification",
	"google_profile",
	"bankruptcies",
	"judgements",
	"liens",
	"complaints",
	"adverse_media",
	"giact_account_status",
	"giact_account_name",
	"giact_contact_verification",
	"email_breach",
	"fraud_results",
	"bot_presence",
	"synthetic_identity_risk_score",
	"stolen_identity_risk_score",
] as const;

export type OnboardingResultRowId = (typeof ONBOARDING_RESULT_ROW_IDS)[number];

/** Human-readable labels for each row, in order. */
export const ONBOARDING_RESULT_ROW_LABELS: Record<
	OnboardingResultRowId,
	string
> = {
	tin_business_registration: "TIN or Business Registration # Equivalent",
	business_address_business_registration:
		"Business Address (Business Registration)",
	business_address_google_profile: "Business Address (Google Profile)",
	business_name: "Business Name",
	website_parked_domain: "Website (Parked Domain)",
	website_status: "Website (Status)",
	watchlist_hits: "Watchlist Hits",
	idv_verification: "Identity Verification (IDV)",
	google_profile: "Google Profile",
	bankruptcies: "Bankruptcies",
	judgements: "Judgements",
	liens: "Liens",
	complaints: "Complaints",
	adverse_media: "Adverse Media",
	giact_account_status: "Giact Account Status",
	giact_account_name: "Giact Account Name",
	giact_contact_verification: "Giact Contact Verification",
	email_breach: "Email Breach",
	fraud_results: "Fraud Ring",
	bot_presence: "Bot Presence",
	synthetic_identity_risk_score: "Synthetic Identity Risk Score",
	stolen_identity_risk_score: "Stolen Identity Risk Score",
};

export type OnboardingResultStatus = "passed" | "failed" | "missing";

/** When header/body are null or "-", show only the row label (Option 2 from design). */
export interface OnboardingResultItem {
	status: OnboardingResultStatus;
	/** Optional; when absent, show only the Field label. */
	header?: string | null;
	/** Optional; when absent, show only the Field label. */
	body?: string | null;
	/** Fallback when header/body not used (e.g. before copy table). */
	description?: string;
}

/**
 * Map of row id -> result. Rows not present are shown in the "Missing" section.
 */
export type OnboardingResultsMap = Partial<
	Record<OnboardingResultRowId, OnboardingResultItem>
>;

/** Default description for rows with no result (missing). */
const MISSING_ROW_DESCRIPTION = "Not yet available.";

/**
 * Default placeholder results shown when no results are passed (e.g. before API is wired).
 * Ensures the Case Results layout is visible for development and design review.
 */
const DEFAULT_PLACEHOLDER_RESULTS: OnboardingResultsMap = {
	tin_business_registration: {
		status: "passed",
		header: "Tax ID Number Verified",
		body: "The provided TIN is valid and active.",
	},
	business_address_business_registration: {
		status: "passed",
		header: "Business Address Verified on Business Registration",
		body: "The provided business address is associated to one or more business registration documents.",
	},
	watchlist_hits: {
		status: "failed",
		header: "Watchlist Hits Found",
		body: "One or more watchlist hits have been found.",
	},
	idv_verification: {
		status: "passed",
		header: "IDV Verified",
		body: "IDV has passed on all associated owners.",
	},
	bankruptcies: {
		status: "passed",
		header: "No Bankruptcies Found",
		body: "No bankruptcies were found on this business or its associated owners.",
	},
	judgements: {
		status: "missing",
		description: MISSING_ROW_DESCRIPTION,
	},
	liens: {
		status: "missing",
		description: MISSING_ROW_DESCRIPTION,
	},
};

export interface OnboardingResultsPlaceholderProps {
	/** Results per row (full data). Rows not present are shown in the "Missing" section. Tab only affects which rows are visible, not the data. */
	results?: OnboardingResultsMap;
	/** Current case details main tab (e.g. "overview", "kyb", "kyc"). Overview shows all rows; other tabs only show rows for that tab. Data is unchanged. */
	currentMainTab?: string;
	/** Optional callback when a row is clicked (failed, passed, or missing). */
	onRowClick?: (rowId: OnboardingResultRowId) => void;
	/** When results were last considered current (from values API). ISO8601 or null. */
	generatedAt?: string | null;
	/** True when any source (fact override, public records, IDV) changed after generatedAt. */
	hasUpdatesSinceGenerated?: boolean;
	/** Number of source areas with newer timestamp (for "x update(s) made"). */
	updatesCount?: number;
	/** True when the date is from Re-verify — show "Regenerated on" instead of "Generated on". */
	isRegenerated?: boolean;
	/** Called when user clicks Re-verify Data Now (triggers integrations rerun, then refetch). */
	onReverify?: () => void;
	/** True while Re-verify is in progress (button shows loading, disabled). */
	isReverifying?: boolean;
	/** When set, only these row IDs are shown (rows disabled in Worth Admin are hidden for this customer). */
	enabledRowIds?: Set<OnboardingResultRowId> | null;
}

/**
 * Case decisioning results: displays onboarding result rows grouped by Failed, Passed, and Missing.
 * Shown when PAT_896 is on and rules point to "new" (e.g. Worth Score path or no workflow set up).
 */
const CaseDecisioningResults: FC<OnboardingResultsPlaceholderProps> = ({
	results: resultsProp,
	currentMainTab,
	onRowClick,
	generatedAt,
	hasUpdatesSinceGenerated = false,
	updatesCount = 0,
	isRegenerated = false,
	onReverify,
	isReverifying = false,
	enabledRowIds = null,
}) => {
	// When no results are passed, show placeholder data so the Case Results UI is visible
	const results =
		resultsProp && Object.keys(resultsProp).length > 0
			? resultsProp
			: DEFAULT_PLACEHOLDER_RESULTS;

	type ResultRowEntry = {
		rowId: OnboardingResultRowId;
		label: string;
		header?: string | null;
		body?: string | null;
		description?: string;
	};
	const failedRows: ResultRowEntry[] = [];
	const passedRows: ResultRowEntry[] = [];
	const missingRows: ResultRowEntry[] = [];

	for (const rowId of ONBOARDING_RESULT_ROW_IDS) {
		// Hide rows disabled for this customer in Worth Admin
		if (enabledRowIds != null && !enabledRowIds.has(rowId)) continue;
		// Hide rows that don't belong to the current tab (display-only; data is always full)
		if (!isOnboardingResultRowVisibleOnTab(rowId, currentMainTab)) continue;

		const item = results[rowId];
		const label = ONBOARDING_RESULT_ROW_LABELS[rowId];
		if (!item) {
			missingRows.push({
				rowId,
				label,
				description: MISSING_ROW_DESCRIPTION,
			});
			continue;
		}
		const entry: ResultRowEntry = {
			rowId,
			label,
			header: item.header,
			body: item.body,
			description: item.description,
		};
		if (item.status === "failed") {
			failedRows.push(entry);
		} else if (item.status === "missing") {
			missingRows.push(entry);
		} else {
			passedRows.push(entry);
		}
	}

	const hasFailed = failedRows.length > 0;
	const hasPassed = passedRows.length > 0;
	const hasMissing = missingRows.length > 0;

	// When the current tab has no rows to show (e.g. Banking, Accounting, Taxes, Documents), hide the component entirely
	const hasAnyRows = hasFailed || hasPassed || hasMissing;
	if (!hasAnyRows) {
		return null;
	}

	return (
		<div className="mt-12 flex flex-col">
			<h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500">
				Case Results
			</h2>

			<div className="flex flex-col gap-6">
				{hasFailed && (
					<ConditionSection<OnboardingResultRowId>
						title="Failed"
						description="Further investigation is required for the items below."
						count={failedRows.length}
						rows={failedRows}
						status="failed"
						onRowClick={onRowClick}
						Icon={ExclamationCircleIcon}
						iconColor="text-red-500"
						bgColor="bg-red-100"
					/>
				)}

				{hasPassed && (
					<ConditionSection<OnboardingResultRowId>
						title="Passed"
						description="These requirements have been successfully verified."
						count={passedRows.length}
						rows={passedRows}
						status="passed"
						onRowClick={onRowClick}
						Icon={CheckCircleIcon}
						iconColor="text-green-600"
						bgColor="bg-green-100"
					/>
				)}

				{hasMissing && (
					<ConditionSection<OnboardingResultRowId>
						title="Missing"
						description="These items have not yet been checked or are not available."
						count={missingRows.length}
						rows={missingRows}
						status="missing"
						onRowClick={onRowClick}
						Icon={ExclamationTriangleIcon}
						iconColor="text-amber-500"
						bgColor="bg-amber-100"
					/>
				)}
			</div>

			{/* Only show "x updates made" and Re-verify button when there are updates; always show Generated/Regenerated on */}
			<div className="mt-8 flex flex-col border-t border-gray-200 pt-6">
				{hasUpdatesSinceGenerated && updatesCount > 0 && (
					<>
						<h3 className="text-base font-semibold text-gray-900">
							{updatesCount === 1
								? "1 Update Made"
								: `${updatesCount} Updates Made`}
						</h3>
						<p className="mt-1 text-sm font-normal text-gray-500">
							Changes detected — re-verify your data to update
							results.
						</p>
						<button
							type="button"
							disabled={isReverifying}
							className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
							onClick={() => onReverify?.()}
						>
							{isReverifying
								? "Re-verifying…"
								: "Re-verify Data Now"}
						</button>
					</>
				)}
				<p
					className={
						hasUpdatesSinceGenerated && updatesCount > 0
							? "mt-4 border-t border-gray-200 pt-4 text-xs font-normal italic text-gray-400"
							: "text-xs font-normal italic text-gray-400"
					}
				>
					* {isRegenerated ? "Regenerated" : "Generated"} on{" "}
					{generatedAt
						? dayjs(generatedAt).format("MM/DD/YY, h:mm A")
						: "—"}
				</p>
			</div>
		</div>
	);
};

export default CaseDecisioningResults;

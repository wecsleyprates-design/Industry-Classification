import type { CaseTabValuesData } from "@/types/integrations";
import {
	ONBOARDING_RESULT_ROW_IDS,
	type OnboardingResultItem,
	type OnboardingResultRowId,
	type OnboardingResultsMap,
} from "./caseDecisioningResults";
import { getOnboardingResultCopy } from "./onboardingResultsCopy";

/** API item may include status (e.g. GIACT rows). Use this when reading status so TS allows it. */
type CaseTabValuesItemWithStatus = CaseTabValuesData["values"][string] & {
	status?: OnboardingResultItem["status"] | null;
};

const MISSING_DESCRIPTION = "Not yet available.";

/** Backend IDV three-way state (caseTabValuesManager). */
const IDV_VALUE_NOT_RUN = "not_run";
const IDV_VALUE_FAILED = "failed";
const IDV_VALUE_VERIFIED = "verified";

/** Row IDs where a numeric value > 0 means "failed" (e.g. watchlist hits, bankruptcies, email breach). */
const COUNT_BASED_FAILURE_ROW_IDS: Set<OnboardingResultRowId> = new Set([
	"watchlist_hits",
	"bankruptcies",
	"judgements",
	"liens",
	"complaints",
	"adverse_media",
	"email_breach",
]);

function isMissing(
	value: string | number | boolean | null | undefined,
	description: string | null | undefined,
): boolean {
	if (value === null || value === undefined) return true;
	if (description === MISSING_DESCRIPTION) return true;
	if (
		typeof value === "string" &&
		(value === "" || value === "Not available." || value === "N/A")
	)
		return true;
	// IDV: backend sends "not_run" when IDV was not run
	if (typeof value === "string" && value === IDV_VALUE_NOT_RUN) return true;
	return false;
}

function deriveStatus(
	rowId: OnboardingResultRowId,
	value: string | number | boolean | null,
	description: string | null | undefined,
): OnboardingResultItem["status"] {
	// IDV: backend sends "not_run" | "failed" | "verified"
	if (rowId === "idv_verification" && typeof value === "string") {
		if (value === IDV_VALUE_NOT_RUN) return "missing";
		if (value === IDV_VALUE_FAILED) return "failed";
		if (value === IDV_VALUE_VERIFIED) return "passed";
	}
	if (isMissing(value, description)) return "missing";
	if (
		COUNT_BASED_FAILURE_ROW_IDS.has(rowId) &&
		typeof value === "number" &&
		value > 0
	)
		return "failed";
	return "passed";
}

function fallbackDescription(
	rowId: OnboardingResultRowId,
	value: string | number | boolean | null,
	description: string | null | undefined,
	status: OnboardingResultItem["status"],
): string {
	if (status === "missing") return MISSING_DESCRIPTION;
	if (description != null && description !== "") return description;
	if (typeof value === "string" && value) return value;
	if (typeof value === "number") {
		if (COUNT_BASED_FAILURE_ROW_IDS.has(rowId))
			return value > 0 ? `${value} found.` : "None found.";
		return String(value);
	}
	if (typeof value === "boolean") return value ? "Yes" : "No";
	return MISSING_DESCRIPTION;
}

/**
 * Maps the case tab values API response to OnboardingResultsMap for use by
 * CaseDecisioningResults. Uses the copy table for header/body per (rowId, status).
 * IDV: backend value "not_run" | "failed" | "verified" maps to missing | failed | passed.
 */
export function mapCaseTabValuesToOnboardingResults(
	data: CaseTabValuesData | null | undefined,
): OnboardingResultsMap {
	if (data?.values == null || typeof data.values !== "object") return {};

	const out: OnboardingResultsMap = {};

	for (const rowId of ONBOARDING_RESULT_ROW_IDS) {
		const item = data.values[rowId];
		if (item == null) {
			const copy = getOnboardingResultCopy(rowId, "missing");
			out[rowId] = {
				status: "missing",
				header: copy.header,
				body: copy.body,
				...(copy.header == null &&
					copy.body == null && { description: MISSING_DESCRIPTION }),
			};
			continue;
		}
		const value = item.value ?? null;
		const description = item.description ?? null;
		// Use API status when present (e.g. GIACT rows); otherwise derive from value/description
		const itemWithStatus = item as CaseTabValuesItemWithStatus;
		const status =
			itemWithStatus.status != null
				? (itemWithStatus.status as OnboardingResultItem["status"])
				: deriveStatus(rowId, value, description);
		const copy = getOnboardingResultCopy(rowId, status);
		out[rowId] = {
			status,
			header: copy.header,
			body: copy.body,
			...(copy.header == null &&
				copy.body == null && {
					description: fallbackDescription(
						rowId,
						value,
						description,
						status,
					),
				}),
		};
	}

	return out;
}

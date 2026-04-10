/**
 * Types for case tab values API (decisioning/onboarding results).
 * Aligned with integration-service GET /business/:businessId/case/:caseId/values.
 */

/** Three-way status for section placement (Missing / Passed / Failed). */
export type CaseTabValueStatus = "missing" | "passed" | "failed";

/** Single row value from the API. */
export interface CaseTabValueItem {
	value: string | number | boolean | null;
	description?: string | null;
	/** When present, use for section placement (e.g. GIACT rows). */
	status?: CaseTabValueStatus | null;
}

/** Response shape from GET .../business/:businessId/case/:caseId/values */
export interface CaseTabValuesResponse {
	values: Record<string, CaseTabValueItem>;
	generated_at?: string | null;
	has_updates_since_generated?: boolean;
	updates_count?: number;
}

/** Jsend wrapper from integration-service */
export interface CaseTabValuesApiResponse {
	status: string;
	data?: CaseTabValuesResponse;
	message?: string;
}

/**
 * Case tab values row IDs, labels, and navigation for decisioning/onboarding results.
 * Aligned with backend CASE_TAB_VALUES_ROW_IDS. GIACT is three rows (Account Status, Account Name, Contact Verification).
 */

/** Canonical row IDs returned by the case tab values API. */
export const CASE_TAB_VALUES_ROW_IDS = [
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

export type CaseTabValuesRowId = (typeof CASE_TAB_VALUES_ROW_IDS)[number];

/** Display label per row ID. Used for the three GIACT rows and others when rendering the results list. */
export const CASE_TAB_VALUES_ROW_LABELS: Record<CaseTabValuesRowId, string> = {
	tin_business_registration: "TIN or Business Registration #",
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

/** Navigation target: mainTab + optional subTab. Used when user clicks a row (e.g. open Banking tab). */
export interface CaseTabValuesNavigationTarget {
	mainTab: string;
	subTab?: string;
	sectionId?: string;
}

/**
 * Row ID → navigation target. All three GIACT rows go to the same component (Banking tab).
 * Tab names aligned with ViewTabLayout: Company, KYB, Public records, Banking, Accounting, Taxes, etc.
 */
export const CASE_TAB_VALUES_NAVIGATION_MAP: Partial<
	Record<CaseTabValuesRowId, CaseTabValuesNavigationTarget>
> = {
	tin_business_registration: { mainTab: "kyb", subTab: "tax-id-sos" },
	business_address_business_registration: {
		mainTab: "kyb",
		subTab: "business-summary",
	},
	business_address_google_profile: {
		mainTab: "kyb",
		subTab: "business-summary",
	},
	business_name: { mainTab: "kyb", subTab: "business-summary" },
	website_parked_domain: { mainTab: "kyb", subTab: "website-review" },
	website_status: { mainTab: "kyb", subTab: "website-review" },
	watchlist_hits: { mainTab: "kyb", subTab: "watchlists" },
	idv_verification: { mainTab: "kyc" },
	google_profile: { mainTab: "public-records", subTab: "google-profile" },
	bankruptcies: { mainTab: "public-records", subTab: "public-filings" },
	judgements: { mainTab: "public-records", subTab: "public-filings" },
	liens: { mainTab: "public-records", subTab: "public-filings" },
	complaints: { mainTab: "public-records", subTab: "public-filings" },
	adverse_media: { mainTab: "public-records", subTab: "adverse-media" },
	giact_account_status: { mainTab: "banking" },
	giact_account_name: { mainTab: "banking" },
	giact_contact_verification: { mainTab: "banking" },
	email_breach: { mainTab: "banking" },
	fraud_results: { mainTab: "banking" },
};

/**
 * Derives section status from API value item. For GIACT rows, use item.status when present.
 * For others, derive from value/description (e.g. null → missing, count > 0 → failed).
 */
export function deriveRowStatus(
	rowId: CaseTabValuesRowId,
	item: {
		value: string | number | boolean | null;
		status?: "missing" | "passed" | "failed" | null;
	},
): "missing" | "passed" | "failed" {
	if (item.status != null) return item.status;
	if (item.value == null) return "missing";
	if (typeof item.value === "number") {
		if (
			rowId === "watchlist_hits" ||
			rowId === "bankruptcies" ||
			rowId === "judgements" ||
			rowId === "liens" ||
			rowId === "complaints" ||
			rowId === "adverse_media"
		)
			return item.value > 0 ? "failed" : "passed";
	}
	return "passed";
}

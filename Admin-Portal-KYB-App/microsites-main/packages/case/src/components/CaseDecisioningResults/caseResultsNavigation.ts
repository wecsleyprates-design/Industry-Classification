/**
 * Navigation targets for onboarding result rows (tab + optional sectionId for in-tab card).
 * Parent or hook uses this with generatePath + navigate to implement onRowClick.
 * @see cursor/feature_docs/decisioning-results-on-case/03-onboarding-results-copy-and-navigation.md
 */

import type { OnboardingResultRowId } from "./caseDecisioningResults";

export interface CaseResultsNavigationTarget {
	mainTab: string;
	subTab: string;
	sectionId?: string;
}

const NAVIGATION_MAP: Partial<
	Record<OnboardingResultRowId, CaseResultsNavigationTarget>
> = {
	tin_business_registration: { mainTab: "kyb", subTab: "tax-id-sos" },
	business_address_business_registration: {
		mainTab: "kyb",
		subTab: "business-summary",
		sectionId: "addresses",
	},
	business_address_google_profile: {
		mainTab: "kyb",
		subTab: "business-summary",
		sectionId: "addresses",
	},
	business_name: {
		mainTab: "kyb",
		subTab: "business-summary",
		sectionId: "business-names",
	},
	website_parked_domain: {
		mainTab: "kyb",
		subTab: "website-review",
		sectionId: "website-details",
	},
	website_status: {
		mainTab: "kyb",
		subTab: "website-review",
		sectionId: "website-details",
	},
	watchlist_hits: { mainTab: "kyb", subTab: "watchlists", sectionId: "hits" },
	idv_verification: { mainTab: "kyc", subTab: "" },
	google_profile: { mainTab: "public-records", subTab: "google-profile" },
	bankruptcies: {
		mainTab: "public-records",
		subTab: "public-filings",
		sectionId: "bankruptcies",
	},
	judgements: {
		mainTab: "public-records",
		subTab: "public-filings",
		sectionId: "judgements",
	},
	liens: {
		mainTab: "public-records",
		subTab: "public-filings",
		sectionId: "liens",
	},
	complaints: {
		mainTab: "public-records",
		subTab: "public-filings",
		sectionId: "complaints",
	},
	adverse_media: { mainTab: "public-records", subTab: "adverse-media" },
	giact_account_status: { mainTab: "banking", subTab: "" },
	giact_account_name: { mainTab: "banking", subTab: "" },
	giact_contact_verification: { mainTab: "banking", subTab: "" },
	email_breach: { mainTab: "kyc", subTab: "", sectionId: "email-report" },
	fraud_results: { mainTab: "kyc", subTab: "", sectionId: "fraud-report" },
	bot_presence: { mainTab: "kyc", subTab: "", sectionId: "fraud-report" },
	synthetic_identity_risk_score: {
		mainTab: "kyc",
		subTab: "",
		sectionId: "fraud-report",
	},
	stolen_identity_risk_score: {
		mainTab: "kyc",
		subTab: "",
		sectionId: "fraud-report",
	},
};

export function getCaseResultsNavigationTarget(
	rowId: OnboardingResultRowId,
): CaseResultsNavigationTarget | undefined {
	return NAVIGATION_MAP[rowId];
}

/**
 * Whether a result row should be shown on the given main tab (display-only filter).
 * - Overview (or undefined): show all rows.
 * - Other tabs: show only rows whose mainTab matches.
 */
export function isOnboardingResultRowVisibleOnTab(
	rowId: OnboardingResultRowId,
	mainTab: string | undefined,
): boolean {
	if (!mainTab || mainTab === "overview") return true;
	const target = NAVIGATION_MAP[rowId];
	return target?.mainTab === mainTab;
}

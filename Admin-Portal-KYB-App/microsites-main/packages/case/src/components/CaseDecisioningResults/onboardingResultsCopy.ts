/**
 * Frontend-owned copy table for onboarding results (Header + Body per rowId and status).
 * When header/body are null, the UI shows only the Field label (Option 2 from design).
 * @see cursor/feature_docs/decisioning-results-on-case/03-onboarding-results-copy-and-navigation.md
 */

import type {
	OnboardingResultRowId,
	OnboardingResultStatus,
} from "./caseDecisioningResults";

export interface CopyEntry {
	header: string | null;
	body: string | null;
}

/** Key: rowId, then status. Value: { header, body }. Use null for "-" (show only label). */
type CopyTable = Partial<
	Record<
		OnboardingResultRowId,
		Partial<Record<OnboardingResultStatus, CopyEntry>>
	>
>;

const COPY_TABLE: CopyTable = {
	tin_business_registration: {
		missing: {
			header: "Missing Tax ID Number",
			body: "A Tax ID number was not provided.",
		},
		failed: {
			header: "Tax ID Number Unverified",
			body: "The provided TIN is either not found or inactive.",
		},
		passed: {
			header: "Tax ID Number Verified",
			body: "The provided TIN is valid and active.",
		},
	},
	business_address_business_registration: {
		missing: {
			header: "Missing Business Address",
			body: "A business address was not provided.",
		},
		failed: {
			header: "Business Address Unverified on Business Registration",
			body: "The provided business address was not found on any filed business registration documents.",
		},
		passed: {
			header: "Business Address Verified on Business Registration",
			body: "The provided business address is associated to one or more business registration documents.",
		},
	},
	business_address_google_profile: {
		missing: { header: null, body: null },
		failed: {
			header: "Business Address Unverified on Google Profile",
			body: "The provided business address was not found on the associated Google Profile.",
		},
		passed: {
			header: "Business Address Verified on Google Profile",
			body: "The provided business address is related with associated Google Profile.",
		},
	},
	business_name: {
		missing: {
			header: "Missing Business Name",
			body: "A business name was not provided.",
		},
		failed: {
			header: "Business Name Unverified",
			body: "The provided business name is not associated with any found business registration documents.",
		},
		passed: {
			header: "Business Name Verified",
			body: "The provided business name is associated with business registration documents.",
		},
	},
	website_parked_domain: {
		missing: {
			header: "Missing Website",
			body: "A website was not provided.",
		},
		failed: {
			header: "Parked Domain",
			body: "The website provided is a parked domain.",
		},
		passed: {
			header: "Not a Parked Domain",
			body: "The website provided is not a parked domain.",
		},
	},
	website_status: {
		missing: { header: null, body: null },
		failed: {
			header: "Website Offline",
			body: "The website provided is offline.",
		},
		passed: {
			header: "Website Online",
			body: "The website provided is online.",
		},
	},
	watchlist_hits: {
		missing: { header: null, body: null },
		failed: {
			header: "Watchlist Hits Found",
			body: "One or more watchlist hits have been found.",
		},
		passed: {
			header: "No Watchlist Hits Found",
			body: "Watchlist hits have not been found for the business or associated owners.",
		},
	},
	idv_verification: {
		missing: {
			header: "IDV Not Run",
			body: "Identity Verification (IDV) was not run.",
		},
		failed: {
			header: "IDV Unverified",
			body: "One or more owners have not been verified or have failed identity verification.",
		},
		passed: {
			header: "IDV Verified",
			body: "IDV has passed on all associated owners.",
		},
	},
	google_profile: {
		missing: { header: null, body: null },
		failed: {
			header: "Google Profile Not Found",
			body: "A Google Profile was not found for this business.",
		},
		passed: {
			header: "Google Profile Found",
			body: "A Google Profile was found for this business.",
		},
	},
	bankruptcies: {
		failed: {
			header: "Bankruptcies Found",
			body: "One or more bankruptcies have been found.",
		},
		passed: {
			header: "No Bankruptcies Found",
			body: "No bankruptcies were found on this business or its associated owners.",
		},
	},
	judgements: {
		failed: {
			header: "Judgements Found",
			body: "One or more judgements have been found.",
		},
		passed: {
			header: "No Judgements Found",
			body: "No judgements were found on this business or its associated owners.",
		},
	},
	liens: {
		failed: {
			header: "Liens Found",
			body: "One or more liens have been found.",
		},
		passed: {
			header: "No Liens Found",
			body: "No liens were found on this business or its associated owners.",
		},
	},
	complaints: {
		failed: {
			header: "Complaints Found",
			body: "One or more complaints have been found.",
		},
		passed: {
			header: "No Complaints Found",
			body: "No complaints were found on this business.",
		},
	},
	adverse_media: {
		failed: {
			header: "Adverse Media Found",
			body: "High risk media associated with this business has been found.",
		},
		passed: {
			header: "No High Risk Adverse Media Found",
			body: "No high risk media associated with this business or its owners has been found.",
		},
	},
	email_breach: {
		failed: {
			header: "Email Breach Found",
			body: "One or more email breaches have been found for emails associated with owners of this business.",
		},
		passed: {
			header: "No Email Breaches Found",
			body: "No emails breaches have been found for emails associated with the owners of this business.",
		},
	},
	fraud_results: {
		failed: {
			header: "Fraud Ring Activity Detected",
			body: "Based on observed behavior, fraud ring activity was detected.",
		},
		passed: {
			header: "No Fraud Ring Activity Detected",
			body: "Based on observed behavior, fraud ring activity was not detected.",
		},
	},
	bot_presence: {
		failed: {
			header: "Bot Detected",
			body: "Based on observed behavior, a bot was detected.",
		},
		passed: {
			header: "Bot Not Detected",
			body: "Based on observed behavior, a bot was not detected.",
		},
	},
	synthetic_identity_risk_score: {
		failed: {
			header: "Synthetic Identity Risk",
			body: "A high risk score is associated with one or more owners.",
		},
		passed: {
			header: "Low Synthetic Identity Risk",
			body: "Associated owners have low or moderate risk for synthetic identities.",
		},
	},
	stolen_identity_risk_score: {
		failed: {
			header: "Stolen Identity Risk",
			body: "A high risk score is associated with one or more owners.",
		},
		passed: {
			header: "Low Stolen Identity Risk",
			body: "Associated owners have low or moderate risk for stolen identities.",
		},
	},
	giact_account_status: {
		missing: { header: null, body: null },
		failed: { header: null, body: null },
		passed: { header: null, body: null },
	},
	giact_account_name: {
		missing: { header: null, body: null },
		failed: { header: null, body: null },
		passed: { header: null, body: null },
	},
	giact_contact_verification: {
		missing: { header: null, body: null },
		failed: { header: null, body: null },
		passed: { header: null, body: null },
	},
};

export function getOnboardingResultCopy(
	rowId: OnboardingResultRowId,
	status: OnboardingResultStatus,
): CopyEntry {
	const entry = COPY_TABLE[rowId]?.[status];
	return entry ?? { header: null, body: null };
}

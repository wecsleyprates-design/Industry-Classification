import type { ReasonCode } from "@/types/integrations";

export const REASON_CODE_MAP: Record<number, ReasonCode> = {
	1: {
		title: "Account data compromise",
		description:
			"This business was terminated due to involvement in a data breach or unauthorized access to account data.",
	},
	2: {
		title: "Common Point of Purchase",
		description:
			"This business was identified as a point where multiple cards were compromised — often part of a larger breach.",
	},
	3: {
		title: "Laundering",
		description:
			"The business was terminated for laundering transactions, such as processing for unauthorized third parties.",
	},
	4: {
		title: "Excessive chargebacks",
		description:
			"The merchant exceeded acceptable chargeback thresholds, indicating disputes or poor transaction quality.",
	},
	5: {
		title: "Excessive fraud",
		description:
			"Fraud-to-sales dollar ratio is greater than 8% in a month or fraudulent transactions exceed $5,000 or more in a month.",
	},
	6: {
		title: "Coercion",
		description:
			"Transactions were processed under threat of physical harm to the cardholder or their immediate family members.",
	},
	7: {
		title: "Fraud Conviction",
		description:
			"The business or its principals were convicted of fraud. This is a severe regulatory red flag.",
	},
	8: {
		title: "MasterCard questionable merchant audit program",
		description:
			"The business was flagged during Mastercard's internal audit for questionable merchant activity.",
	},
	9: {
		title: "Bankruptcy/liquidation/insolvency",
		description:
			"The business is currently or likely unable to meet its financial obligations and debts.",
	},
	10: {
		title: "Violation of standards",
		description:
			"The merchant violated card network and bank standards, such as not honoring all cards or ignoring transaction restrictions.",
	},
	11: {
		title: "Merchant collusion",
		description:
			"The merchant colluded with others to defraud cardholders, issuers, or acquirers.",
	},
	12: {
		title: "PCI-DSS non-compliance",
		description:
			"The business failed to comply with PCI Data Security Standards required for handling payment data.",
	},
	13: {
		title: "Illegal transactions",
		description:
			"The business processed transactions that were deemed illegal (e.g., gambling, drugs, or other restricted activities).",
	},
	14: {
		title: "Identity theft",
		description:
			"The merchant account was opened using stolen or fraudulent identity information.",
	},
	15: {
		title: "Transaction Laundering",
		description:
			"The business processed transactions on behalf of unknown or unauthorized third parties - also known as factoring.",
	},
};

export enum MATCH_STATUS_ENUM {
	RESULTS_FOUND = "Results Found",
	RESULTS_UNAVAILABLE = "Results Unavailable",
	NO_RESULTS_FOUND = "No Results Found",
	ERROR = "Error",
	MULTIPLE_CODES_ASSOCIATED = "Multiple Codes Associated",
	HIGH_RISK = "High Risk",
	MODERATE_RISK = "Moderate Risk",
	MATCHING_LOADING = "Matching Loading",
	NOT_SUBMITTED = "Not Submitted",
}

export const VARIANTS: Record<
	MATCH_STATUS_ENUM,
	"info" | "success" | "warning" | "error" | "secondary"
> = {
	[MATCH_STATUS_ENUM.RESULTS_FOUND]: "info",
	[MATCH_STATUS_ENUM.RESULTS_UNAVAILABLE]: "secondary",
	[MATCH_STATUS_ENUM.NO_RESULTS_FOUND]: "success",
	[MATCH_STATUS_ENUM.ERROR]: "error",
	[MATCH_STATUS_ENUM.MULTIPLE_CODES_ASSOCIATED]: "error",
	[MATCH_STATUS_ENUM.HIGH_RISK]: "error",
	[MATCH_STATUS_ENUM.MODERATE_RISK]: "warning",
	[MATCH_STATUS_ENUM.MATCHING_LOADING]: "secondary",
	[MATCH_STATUS_ENUM.NOT_SUBMITTED]: "secondary",
};

export const REASON_CODES_STATUS = {
	[MATCH_STATUS_ENUM.HIGH_RISK]: [1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15],
	[MATCH_STATUS_ENUM.MODERATE_RISK]: [9, 10, 12],
} as const;

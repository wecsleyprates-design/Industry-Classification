import type { ComponentType, SVGProps } from "react";
import type {
	MatchError,
	MerchantDetails,
	Principal,
	TerminatedMerchant,
} from "@/types/integrations";

import { type MATCH_STATUS_ENUM } from "@/constants/ReasonCodes";

/**
 * Raw M-code signals returned by the Mastercard MATCH API.
 */
export enum MatchSignalCode {
	NO_MATCH = "M00",
	EXACT_MATCH = "M01",
	FUZZY_MATCH = "M02",
	NOT_AVAILABLE = "N/A",
}

/**
 * Badge variant types that align with your UI component library.
 */
export type BadgeVariant =
	| "default"
	| "secondary"
	| "destructive"
	| "outline"
	| "success"
	| "error"
	| "warning"
	| "info";

/**
 * Type alias for Heroicons (standard React SVG components).
 */
export type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Definition for how a match status should be displayed in the UI.
 */
export interface MatchStatusDefinition {
	variant: BadgeVariant;
	text: string;
	icon: HeroIcon;
	description?: string;
}

export enum MatchStatus {
	MATCH_ERROR = "MATCH_ERROR",
	RESULTS_FOUND = "RESULTS_FOUND",
	NO_RESULTS_FOUND = "NO_RESULTS_FOUND",
	RESULTS_UNAVAILABLE = "RESULTS_UNAVAILABLE",
	NOT_SUBMITTED = "NOT_SUBMITTED",
}
export type MatchRisk = MATCH_STATUS_ENUM | "HIGH_RISK" | "LOW_RISK" | "NONE";

export interface MatchUIState {
	global: {
		timestamp?: string;
		multiIca?: boolean;
		totalRuns: number;
	};
	icas: MatchICAUIResult[];
}

export interface MatchICAUIResult {
	ica: string;
	icaName?: string;
	status: MatchStatus;
	risk: MatchRisk;
	cached: boolean;
	timestamp?: string;
	errors?: MatchError[];
	matches?: MatchSuccessData;
	inquiryMerchant?: MerchantDetails;
	inquiryDetails?: {
		name: string;
		address: string;
		category: string;
	};
	inquiryPrincipals?: Principal[];
	additionalMatches?: MatchSuccessData[];
}

export interface MatchSuccessData {
	ref: string;
	timestamp?: string; // from execution_metadata if available
	merchantInfo?: TerminatedMerchant["merchant"]; // The matched merchant details
	matchSignal: {
		businessNameMatch: string;
		addressMatch: string;
		dbaMatch: string;
		phoneNumberMatch: string;
		altPhoneNumberMatch: string;
		nationalTaxIdMatch: string;
		countrySubdivisionTaxIdMatch: string;
		principalMatch: Array<{
			name: string;
			email: string;
			address: string;
			nationalId: string;
			phoneNumber: string;
			dateOfBirth: string;
			altPhoneNumber: string;
		}>;
	};
	reasonCodes: Array<{
		code: string;
		description: string;
	}>;
}

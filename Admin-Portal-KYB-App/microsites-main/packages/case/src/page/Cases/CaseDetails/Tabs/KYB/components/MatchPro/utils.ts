import {
	CheckCircleIcon,
	ClockIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import type {
	MatchError,
	MatchResultData,
	MatchResultItem,
	MerchantDetails,
	TerminatedMerchant,
} from "@/types/integrations";
import type {
	BadgeVariant,
	HeroIcon,
	MatchICAUIResult,
	MatchRisk,
	MatchStatusDefinition,
	MatchSuccessData,
	MatchUIState,
} from "./types";
import { MatchSignalCode, MatchStatus } from "./types";

import {
	MATCH_STATUS_ENUM,
	REASON_CODES_STATUS,
} from "@/constants/ReasonCodes";

type AddressLike = {
	addressLineOne?: string;
	addressLineTwo?: string;
	city?: string;
	countrySubdivision?: string;
	postalCode?: string;
};

export const formatAddress = (address: AddressLike | undefined): string =>
	[
		address?.addressLineOne,
		address?.addressLineTwo,
		address?.city,
		address?.countrySubdivision,
		address?.postalCode,
	]
		.filter(Boolean)
		.join(", ");

export const formatFullName = (
	firstName?: string,
	middleInitial?: string,
	lastName?: string,
): string => [firstName, middleInitial, lastName].filter(Boolean).join(" ");

export interface SignalDefinition {
	label: string;
	badgeLabel: string;
	tooltip: string;
	variant: BadgeVariant;
	icon: HeroIcon;
}

export const SIGNAL_CONFIG: Record<MatchSignalCode, SignalDefinition> = {
	[MatchSignalCode.EXACT_MATCH]: {
		label: "Exact Match",
		badgeLabel: "Match",
		tooltip:
			"The matched merchant's information is identical to the inquiry.",
		variant: "success",
		icon: CheckCircleIcon,
	},
	[MatchSignalCode.FUZZY_MATCH]: {
		label: "Fuzzy/Phonetic Match",
		badgeLabel: "Partial Match",
		tooltip:
			"The matched merchant's information is very similar (phonetic match) to the inquiry.",
		variant: "warning",
		icon: ExclamationTriangleIcon,
	},
	[MatchSignalCode.NO_MATCH]: {
		label: "No Match",
		badgeLabel: "No Match",
		tooltip:
			"The matched merchant's information does not match the inquiry.",
		variant: "error",
		icon: ExclamationCircleIcon,
	},
	[MatchSignalCode.NOT_AVAILABLE]: {
		label: "N/A",
		badgeLabel: "N/A",
		tooltip: "No information provided for this field.",
		variant: "secondary",
		icon: InformationCircleIcon,
	},
};

export const mapMatchSignal = (code: string | undefined): string =>
	code
		? (SIGNAL_CONFIG[code as MatchSignalCode]?.label ?? code)
		: MatchSignalCode.NOT_AVAILABLE;

export const getMatchSignalTooltip = (signal: string): string =>
	SIGNAL_CONFIG[signal as MatchSignalCode]?.tooltip ?? "";

const buildInquiryDetails = (merchant: MerchantDetails) => {
	const { name, address, merchantCategory } = merchant;
	return {
		name,
		address: address
			? `${address.addressLineOne}, ${address.city}, ${address.country}`
			: "N/A",
		category: merchantCategory,
	};
};

const buildMatchSuccessData = (
	tm: TerminatedMerchant,
	ref: string,
	timestamp?: string,
): MatchSuccessData => ({
	ref,
	timestamp,
	merchantInfo: tm.merchant,
	matchSignal: {
		businessNameMatch:
			tm.merchantMatch.name ?? MatchSignalCode.NOT_AVAILABLE,
		addressMatch: tm.merchantMatch.address ?? MatchSignalCode.NOT_AVAILABLE,
		dbaMatch:
			tm.merchantMatch.doingBusinessAsName ??
			MatchSignalCode.NOT_AVAILABLE,
		phoneNumberMatch:
			tm.merchantMatch.phoneNumber ?? MatchSignalCode.NOT_AVAILABLE,
		altPhoneNumberMatch:
			tm.merchantMatch.altPhoneNumber ?? MatchSignalCode.NOT_AVAILABLE,
		nationalTaxIdMatch:
			tm.merchantMatch.nationalTaxId ?? MatchSignalCode.NOT_AVAILABLE,
		countrySubdivisionTaxIdMatch:
			tm.merchantMatch.countrySubdivisionTaxId ??
			MatchSignalCode.NOT_AVAILABLE,
		principalMatch:
			(
				tm.merchantMatch.principalMatches as Array<{
					name?: string;
					email?: string;
					address?: string;
					nationalId?: string;
					phoneNumber?: string;
					dateOfBirth?: string;
					altPhoneNumber?: string;
				}>
			)?.map(
				({
					name,
					email,
					address,
					nationalId,
					phoneNumber,
					dateOfBirth,
					altPhoneNumber,
				}) => ({
					name: name ?? MatchSignalCode.NOT_AVAILABLE,
					email: email ?? MatchSignalCode.NOT_AVAILABLE,
					address: address ?? MatchSignalCode.NOT_AVAILABLE,
					nationalId: nationalId ?? MatchSignalCode.NOT_AVAILABLE,
					phoneNumber: phoneNumber ?? MatchSignalCode.NOT_AVAILABLE,
					dateOfBirth: dateOfBirth ?? MatchSignalCode.NOT_AVAILABLE,
					altPhoneNumber:
						altPhoneNumber ?? MatchSignalCode.NOT_AVAILABLE,
				}),
			) ?? [],
	},
	reasonCodes: tm.merchant.reasonCode
		? tm.merchant.reasonCode
				.split(/[,;]+/)
				.map((c) => c.trim())
				.filter(Boolean)
				.map((code) => ({
					code,
					description: tm.merchant.reasonCodeDesc ?? "",
				}))
		: [],
});

const transformIcaResult = (
	ica: string,
	item: MatchResultItem,
	metadata?: { cached: boolean; timestamp: string },
	icaName?: string,
): MatchICAUIResult => {
	const rawErrors = item.Errors?.Error ?? item.errors?.error ?? [];
	const cached = metadata?.cached ?? false;

	if (rawErrors.length > 0) {
		const normalizedErrors = rawErrors.map((err) => ({
			Source: err.Source ?? err.source ?? "UNKNOWN",
			Details: err.Details ?? err.details ?? "Unknown error occurred",
			ReasonCode: err.ReasonCode,
			Description: err.Description,
			Recoverable: err.Recoverable,
		}));

		return {
			ica,
			icaName,
			status: MatchStatus.MATCH_ERROR,
			risk: "NONE",
			cached,
			errors: normalizedErrors as unknown as MatchError[],
		};
	}

	const merchant = item.terminationInquiryRequest?.merchant;
	const inquiryMerchant = merchant;
	const inquiryDetails = merchant ? buildInquiryDetails(merchant) : undefined;

	const terminationResponse = item.terminationInquiryResponse;
	const possibleMerchantMatches =
		terminationResponse?.possibleMerchantMatches;
	const hasMatches = possibleMerchantMatches?.some(
		(pmm) => pmm.totalMerchantMatches > 0,
	);

	if (hasMatches && possibleMerchantMatches) {
		const allTerminatedMerchants = possibleMerchantMatches.flatMap(
			(pm) => pm.terminatedMerchants ?? [],
		);

		const validReasonCodeNumbers = allTerminatedMerchants
			.flatMap((tm) =>
				(tm.merchant.reasonCode ?? "")
					.split(/[,;]+/)
					.map((c) => Number(c.trim())),
			)
			.filter((num) => !isNaN(num));

		const qualifyingMatches = allTerminatedMerchants.filter(
			(tm) =>
				tm.merchantMatch.name === MatchSignalCode.EXACT_MATCH ||
				tm.merchantMatch.doingBusinessAsName ===
					MatchSignalCode.EXACT_MATCH,
		);

		if (qualifyingMatches.length === 0) {
			return {
				ica,
				icaName,
				status: MatchStatus.NO_RESULTS_FOUND,
				risk: "NONE",
				cached,
				timestamp: metadata?.timestamp,
				inquiryMerchant,
				inquiryDetails,
			};
		}

		const primaryMatch = qualifyingMatches[0];
		const extraMatches = qualifyingMatches.slice(1);

		const ref = terminationResponse?.ref ?? "";
		const ts = metadata?.timestamp;

		const matchData: MatchSuccessData | undefined = primaryMatch
			? buildMatchSuccessData(primaryMatch, ref, ts)
			: undefined;

		const additionalMatches = extraMatches.map((tm) =>
			buildMatchSuccessData(tm, ref, ts),
		);

		return {
			ica,
			icaName,
			status: MatchStatus.RESULTS_FOUND,
			risk: calculateRiskStatus(
				validReasonCodeNumbers,
			) as unknown as MatchRisk,
			cached,
			timestamp: ts,
			matches: matchData,
			inquiryMerchant,
			inquiryDetails,
			inquiryPrincipals: merchant?.principals,
			additionalMatches:
				additionalMatches.length > 0 ? additionalMatches : undefined,
		};
	}

	return {
		ica,
		icaName,
		status: MatchStatus.NO_RESULTS_FOUND,
		risk: "NONE",
		cached,
		timestamp: metadata?.timestamp,
		inquiryMerchant,
		inquiryDetails,
	};
};

export const transformMatchResponse = (data: MatchResultData): MatchUIState => {
	const icaIdToName = new Map<string, string>();
	if (data.icas) {
		Object.entries(data.icas)
			.filter(([key]) => key !== "defaultIca")
			.forEach(([key, value]) => {
				if (
					typeof value === "object" &&
					!Array.isArray(value) &&
					"ica" in value
				) {
					icaIdToName.set((value as { ica: string }).ica, key);
				}
			});
	}

	const icas = Object.entries(data.results ?? {}).map(([ica, item]) => {
		const meta = data.execution_metadata?.[ica];
		return transformIcaResult(ica, item, meta, icaIdToName.get(ica));
	});

	const globalErrors = data.Errors?.Error ?? data.errors?.error ?? [];
	if (globalErrors.length > 0) {
		const errorIca = data.terminationInquiryRequest?.acquirerId ?? "Error";
		const syntheticItem: MatchResultItem = data.Errors
			? { Errors: data.Errors }
			: { errors: data.errors };
		icas.push(
			transformIcaResult(
				errorIca,
				syntheticItem,
				undefined,
				icaIdToName.get(errorIca),
			),
		);
	}

	if (
		icas.length === 0 &&
		!globalErrors.length &&
		data.terminationInquiryRequest &&
		data.terminationInquiryResponse
	) {
		const legacyIca = data.terminationInquiryRequest.acquirerId;
		const syntheticItem: MatchResultItem = {
			terminationInquiryRequest:
				data.terminationInquiryRequest as MatchResultItem["terminationInquiryRequest"],
			terminationInquiryResponse: data.terminationInquiryResponse,
		};
		icas.push(
			transformIcaResult(
				legacyIca,
				syntheticItem,
				undefined,
				icaIdToName.get(legacyIca),
			),
		);
	}

	if (data.icas) {
		const processedIcaIds = new Set(icas.map((i) => i.ica));
		Object.entries(data.icas)
			.filter(([key]) => key !== "defaultIca")
			.forEach(([key, value]) => {
				if (
					typeof value === "object" &&
					!Array.isArray(value) &&
					"ica" in value
				) {
					const icaEntry = value as {
						ica: string;
						isDefault: boolean;
					};
					if (!processedIcaIds.has(icaEntry.ica)) {
						icas.push({
							ica: icaEntry.ica,
							icaName: key,
							status: MatchStatus.NOT_SUBMITTED,
							risk: "NONE",
							cached: false,
						});
					}
				}
			});
	}

	return {
		global: {
			timestamp: data.timestamp,
			multiIca: data.multi_ica,
			totalRuns: icas.length,
		},
		icas,
	};
};

/**
 * Configuration map for each MATCH_STATUS_ENUM value.
 * Centralises all display logic in one place for easy maintenance.
 */
const MATCH_STATUS_CONFIG: Record<
	MATCH_STATUS_ENUM,
	Omit<MatchStatusDefinition, "text">
> = {
	[MATCH_STATUS_ENUM.NO_RESULTS_FOUND]: {
		variant: "success",
		icon: CheckCircleIcon,
		description:
			"No entries found in the Mastercard MATCH database. This indicates the merchant has never been terminated by an acquiring bank for cause and has no history of violations.",
	},

	[MATCH_STATUS_ENUM.HIGH_RISK]: {
		variant: "error",
		icon: ExclamationCircleIcon,
	},

	[MATCH_STATUS_ENUM.MODERATE_RISK]: {
		variant: "warning",
		icon: ExclamationTriangleIcon,
	},

	[MATCH_STATUS_ENUM.RESULTS_FOUND]: {
		variant: "error",
		icon: ExclamationCircleIcon,
	},

	[MATCH_STATUS_ENUM.MULTIPLE_CODES_ASSOCIATED]: {
		variant: "warning",
		icon: ExclamationTriangleIcon,
	},

	[MATCH_STATUS_ENUM.ERROR]: {
		variant: "destructive",
		icon: ExclamationCircleIcon,
	},

	[MATCH_STATUS_ENUM.RESULTS_UNAVAILABLE]: {
		variant: "secondary",
		icon: ExclamationCircleIcon,
		description:
			"Match results could not be retrieved due to the following errors:",
	},

	[MATCH_STATUS_ENUM.MATCHING_LOADING]: {
		variant: "secondary",
		icon: ClockIcon,
		description: "Matching is currently in progress.",
	},

	[MATCH_STATUS_ENUM.NOT_SUBMITTED]: {
		variant: "secondary",
		icon: InformationCircleIcon,
		description:
			"This acquirer ID has not been submitted for matching yet.",
	},
};

/**
 * Returns the UI definition for a given MATCH status enum value.
 * Falls back to a sensible default if the status is not explicitly configured.
 *
 * @param status - The MATCH_STATUS_ENUM value to look up
 * @returns Display configuration including variant, text, icon, and optional tooltip
 */
export function getMatchStatusDefinition(
	status: MATCH_STATUS_ENUM,
): MatchStatusDefinition {
	const config = MATCH_STATUS_CONFIG[status];

	if (!config) {
		return {
			variant: "default",
			text: status,
			icon: InformationCircleIcon,
			description: undefined,
		};
	}

	return {
		...config,
		text: status,
	};
}

const HIGH_RISK_SET = new Set(
	REASON_CODES_STATUS[MATCH_STATUS_ENUM.HIGH_RISK] as readonly number[],
);
const MODERATE_RISK_SET = new Set(
	REASON_CODES_STATUS[MATCH_STATUS_ENUM.MODERATE_RISK] as readonly number[],
);

export const calculateRiskStatus = (
	reasonCodes: number[],
): MATCH_STATUS_ENUM => {
	if (reasonCodes.length === 0) return MATCH_STATUS_ENUM.NO_RESULTS_FOUND;

	const hasHighRiskCode = reasonCodes.some((code) => HIGH_RISK_SET.has(code));
	const hasModerateRiskCode = reasonCodes.some((code) =>
		MODERATE_RISK_SET.has(code),
	);

	if (hasHighRiskCode && hasModerateRiskCode) {
		return MATCH_STATUS_ENUM.MULTIPLE_CODES_ASSOCIATED;
	}
	if (hasHighRiskCode) return MATCH_STATUS_ENUM.HIGH_RISK;
	if (hasModerateRiskCode) return MATCH_STATUS_ENUM.MODERATE_RISK;

	return MATCH_STATUS_ENUM.ERROR;
};

/**
 * Maps a raw ICA result status to the appropriate MATCH_STATUS_ENUM.
 * Centralises the derivation logic so the component body stays declarative.
 */
export function resolveMatchStatus(
	result: MatchICAUIResult,
): MATCH_STATUS_ENUM {
	switch (result.status) {
		case MatchStatus.RESULTS_FOUND:
			return (
				(result.risk as MATCH_STATUS_ENUM) ??
				MATCH_STATUS_ENUM.RESULTS_FOUND
			);
		case MatchStatus.NO_RESULTS_FOUND:
			return MATCH_STATUS_ENUM.NO_RESULTS_FOUND;
		case MatchStatus.MATCH_ERROR:
			return MATCH_STATUS_ENUM.RESULTS_UNAVAILABLE;
		case MatchStatus.NOT_SUBMITTED:
			return MATCH_STATUS_ENUM.NOT_SUBMITTED;
		default:
			return MATCH_STATUS_ENUM.RESULTS_UNAVAILABLE;
	}
}

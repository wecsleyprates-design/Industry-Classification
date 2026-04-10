import { type FactsBusinessKybResponse } from "@/types/integrations";

const MIDDESK_PLATFORM_ID = 16;

/**
 * Extract submitted business names from KYB facts, preferring Middesk data.
 * Falls back to the primary value (any platform, e.g. Trulioo) when
 * Middesk data is unavailable — this supports international countries
 * where Trulioo (platformId 38) is the sole KYB provider.
 */
export const getKybMiddeskNamesSubmitted = (
	namesSubmittedFact: FactsBusinessKybResponse["names_submitted"] | undefined,
) => {
	if (!namesSubmittedFact) return [];
	if (
		Number(namesSubmittedFact?.["source.platformId"]) ===
		MIDDESK_PLATFORM_ID
	)
		return namesSubmittedFact.value ?? [];

	const middeskAlternative = namesSubmittedFact.alternatives?.find(
		(alternative) => Number(alternative.source) === MIDDESK_PLATFORM_ID,
	);
	if (middeskAlternative) return middeskAlternative.value ?? [];

	return namesSubmittedFact.value ?? [];
};

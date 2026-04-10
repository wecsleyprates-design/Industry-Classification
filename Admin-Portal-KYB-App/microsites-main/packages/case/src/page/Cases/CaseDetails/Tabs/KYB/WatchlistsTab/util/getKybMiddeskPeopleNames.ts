import { type FactsBusinessKybResponse } from "@/types/integrations";

const MIDDESK_PLATFORM_ID = 16;

/**
 * Extract people names from the KYB facts, preferring Middesk data.
 * Falls back to the primary value (any platform, e.g. Trulioo) when
 * Middesk data is unavailable — this supports international countries
 * where Trulioo (platformId 38) is the sole KYB/PSC provider.
 */
export const getKybMiddeskPeopleNames = (
	peopleFact:
		| Pick<
				FactsBusinessKybResponse["people"],
				"value" | "alternatives" | "source.platformId"
		  >
		| undefined,
) => {
	if (!peopleFact) return [];
	if (Number(peopleFact?.["source.platformId"]) === MIDDESK_PLATFORM_ID)
		return peopleFact.value ?? [];

	const middeskAlternative = peopleFact.alternatives?.find(
		(alternative) => Number(alternative.source) === MIDDESK_PLATFORM_ID,
	);
	if (middeskAlternative) return middeskAlternative.value ?? [];

	return peopleFact.value ?? [];
};

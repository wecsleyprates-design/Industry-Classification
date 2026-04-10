import COUNTRIES from "@/constants/Countries";

/**
 * Maps Australian state names to their 2-character codes.
 * Based on ISO 3166-2:AU standard abbreviations, truncated to 2 characters
 * as required by backend validation (per Matt's Slack comment: "adjust State to fit into 2 characters").
 */
const AUSTRALIAN_STATE_MAP: Record<string, string> = {
	// Full state names
	"NEW SOUTH WALES": "NS",
	VICTORIA: "VI",
	QUEENSLAND: "QL",
	"WESTERN AUSTRALIA": "WA",
	"SOUTH AUSTRALIA": "SA",
	TASMANIA: "TA",
	"AUSTRALIAN CAPITAL TERRITORY": "AC",
	"NORTHERN TERRITORY": "NT",
	// ISO abbreviations (already 2-3 chars, take first 2)
	NSW: "NS",
	VIC: "VI",
	QLD: "QL",
	WA: "WA",
	SA: "SA",
	TAS: "TA",
	ACT: "AC",
	NT: "NT",
};

/**
 * Normalizes state/province names to 2-character codes as required by the backend.
 *
 * Currently supports:
 * - Australia: Converts state names (e.g., "New South Wales") to codes (e.g., "NS")
 *
 * For other countries, returns the state as-is (assuming it's already in the correct format).
 *
 * @param state - State/province name or code
 * @param country - Country code (ISO 3166-1 alpha-2)
 * @returns Normalized 2-character state code
 */
export const normalizeStateToCode = (
	state: string | undefined | null,
	country: string | undefined | null,
): string | undefined => {
	if (!state) return undefined;

	const normalizedState = state.trim().toUpperCase();
	const normalizedCountry = country?.toUpperCase();

	// Puerto Rico: USPS state is always "PR" (no subdivisions / provinces)
	if (
		normalizedCountry === COUNTRIES.PUERTO_RICO ||
		normalizedCountry === "PR"
	) {
		return "PR";
	}

	// Australia: Convert state names to 2-character codes
	if (normalizedCountry === COUNTRIES.AUSTRALIA || normalizedCountry === "AU") {
		return AUSTRALIAN_STATE_MAP[normalizedState] || normalizedState.slice(0, 2);
	}

	// For other countries, return as-is (assuming already in correct format)
	// New Zealand uses region codes, Canada and US should already be in correct format from the form
	return normalizedState;
};

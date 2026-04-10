import COUNTRIES from "@/constants/Countries";

/**
 * Normalizes country code to ISO 3166-1 alpha-2 format
 *
 * Handles country code conversion:
 * - UK -> GB (ISO standard)
 * - Canada -> CA
 * - Puerto Rico -> PR
 * - Australia -> AU
 * - New Zealand -> NZ
 * - Defaults to US if country is not provided
 *
 * @param country - Country code from form (can be COUNTRIES.UK, COUNTRIES.CANADA, etc.)
 * @returns ISO 3166-1 alpha-2 country code
 */
export const normalizeCountryToISO = (
	country: string | undefined | null,
): string => {
	if (!country) {
		return "US"; // Default fallback
	}

	switch (country) {
		case COUNTRIES.CANADA:
			return "CA";
		case COUNTRIES.UK:
			return "GB"; // UK -> GB conversion (ISO standard)
		case COUNTRIES.PUERTO_RICO:
			return "PR";
		case COUNTRIES.AUSTRALIA:
			return "AU";
		case COUNTRIES.NEW_ZEALAND:
			return "NZ";
		default:
			return country || "US"; // Fallback to US if country is not recognized
	}
};

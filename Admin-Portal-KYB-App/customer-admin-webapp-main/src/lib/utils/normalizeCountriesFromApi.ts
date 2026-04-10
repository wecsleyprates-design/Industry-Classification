import type { CustomerCountry } from "@/types/onboarding";

import COUNTRIES from "@/constants/Countries";

/**
 * Normalizes country codes from API response to ISO 3166-1 alpha-2 format
 * expected by ReactFlagsSelect component.
 *
 * Handles:
 * - Filters to show ONLY countries that are enabled/selected for the customer
 * - UK -> GB conversion (ISO standard)
 * - Filters out invalid/null codes
 * - Returns fallback countries if no valid countries found
 *
 * @param countries - Array of country objects from API response
 * @returns Array of normalized ISO 3166-1 alpha-2 country codes (only enabled/selected ones)
 */
export const normalizeCountriesFromApi = (
	countries: CustomerCountry[] | undefined | null,
): string[] => {
	if (!countries || countries.length === 0) {
		// Fallback to default countries if API fails or no data
		return [COUNTRIES.USA, COUNTRIES.CANADA, COUNTRIES.UK];
	}

	// Filter to show ONLY countries that are enabled/selected for this customer
	const enabledCountries = countries.filter(
		(country) => country.is_selected === true || country.is_enabled === true,
	);

	if (enabledCountries.length === 0) {
		// If no countries are enabled, return fallback
		return [COUNTRIES.USA, COUNTRIES.CANADA, COUNTRIES.UK];
	}

	const normalizedCodes = enabledCountries
		.map((country) => {
			const code = country.jurisdiction_code?.toUpperCase();
			if (!code) return null;
			// Normalize UK to GB (ISO 3166-1 alpha-2 standard)
			return code === "UK" ? "GB" : code;
		})
		.filter((code): code is string => code !== null);

	// Return fallback if normalization resulted in empty array
	return normalizedCodes.length > 0
		? normalizedCodes
		: [COUNTRIES.USA, COUNTRIES.CANADA, COUNTRIES.UK];
};

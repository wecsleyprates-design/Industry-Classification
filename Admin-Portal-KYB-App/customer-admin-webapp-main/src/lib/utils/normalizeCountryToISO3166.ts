import type { ISO3166 } from "@/types/ISO3166";
import { isISO3166 } from "../assertions/isISO3166";
import { mapCountryCodeToISO3166 } from "./mapCountryCodeToISO3166";

import COUNTRIES from "@/constants/Countries";

const LONG_COUNTRY_TO_ISO3166_MAP: Record<string, ISO3166> = {
	CANADA: COUNTRIES.CANADA,
	"UNITED STATES": COUNTRIES.USA,
	"UNITED KINGDOM": COUNTRIES.UK,
	"PUERTO RICO": COUNTRIES.PUERTO_RICO,
	AUSTRALIA: COUNTRIES.AUSTRALIA,
	"NEW ZEALAND": COUNTRIES.NEW_ZEALAND,
};

/**
 * Takes country input in the form of a long name (e.g. "UNITED STATES"), country code (e.g. "USA"),
 * or ISO3166 code (e.g. "US") and attempts to normalize it to a ISO3166 code.
 *
 * If the input was none of these, it will return null.
 */
export const normalizeCountryToISO3166 = (country: string): ISO3166 | null => {
	/** If the input is already a valid ISO3166 code, return it as-is. */
	if (isISO3166(country)) return country;

	/** If the input is a valid country code that successfully maps to a ISO3166 code, return the ISO3166 code. */
	if (mapCountryCodeToISO3166(country))
		return mapCountryCodeToISO3166(country) as ISO3166;

	/** Otherwise, try to match the input to a long country name and return the corresponding ISO3166 code. */
	let matchedCountry = null;
	Object.entries(LONG_COUNTRY_TO_ISO3166_MAP).forEach(([key, value]) => {
		if (country.toUpperCase().includes(key)) matchedCountry = value;
	});
	return matchedCountry;
};

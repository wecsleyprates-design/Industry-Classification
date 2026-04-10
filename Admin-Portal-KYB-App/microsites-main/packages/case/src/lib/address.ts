/**
 * Ported from the integration-service on 2025-08-15.
 * Intended for temporary use until the integration-service facts routes normalize addresses.
 * @see https://worth-ai.atlassian.net/browse/PAT-749
 */

/** This rule is ignored for to ensure parity with the integration-service logic. */

import { distance } from "fastest-levenshtein";
import { parseLocation } from "parse-address";
import { type PrimaryAddressValue } from "@/types/integrations";
import {
	extractCanadianAddressComponents,
	isCanadianAddress,
} from "./canadianProvinces";
import { trimAndTitleCase } from "./stringFormat";

// The cases service returns an address with an "apartment" field which isn't very descriptive name for a business address
type CaseAddressObject = Pick<
	PrimaryAddressValue,
	"line_1" | "apartment" | "city" | "state" | "postal_code"
> &
	Partial<Pick<PrimaryAddressValue, "country">>;
/*
A normalized address object
Takes an address or intersection specifier, and normalizes its components, 
stripping out all leading and trailing whitespace and punctuation, and substituting official abbreviations 
for prefix, suffix, type, and state values.
 Also, city names that are prefixed with a directional abbreviation (e.g. N, NE, etc.) have the abbreviation expanded.
 */
export type NormalizedAddress = {
	line_1: string | null;
	line_2: string | null;
	line_3: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country?: string | null;
	formatted_address?: string | null;
};

export const States: Array<Record<string, string>> = [
	{ AL: "ALABAMA" },
	{ AK: "ALASKA" },
	{ AZ: "ARIZONA" },
	{ AR: "ARKANSAS" },
	{ CA: "CALIFORNIA" },
	{ CA: "CALI" },
	{ CO: "COLORADO" },
	{ CT: "CONNECTICUT" },
	{ CT: "CONN" },
	{ DC: "DISTRICT OF COLUMBIA" },
	{ DC: "WASHINGTON DC" },
	{ DE: "DELAWARE" },
	{ FL: "FLORIDA" },
	{ GA: "GEORGIA" },
	{ HI: "HAWAII" },
	{ ID: "IDAHO" },
	{ IL: "ILLINOIS" },
	{ IN: "INDIANA" },
	{ IA: "IOWA" },
	{ KS: "KANSAS" },
	{ KY: "KENTUCKY" },
	{ LA: "LOUISIANA" },
	{ ME: "MAINE" },
	{ MD: "MARYLAND" },
	{ MA: "MASSACHUSETTS" },
	{ MA: "MASS" },
	{ MI: "MICHIGAN" },
	{ MN: "MINNESOTA" },
	{ MS: "MISSISSIPPI" },
	{ MO: "MISSOURI" },
	{ MT: "MONTANA" },
	{ NE: "NEBRASKA" },
	{ NV: "NEVADA" },
	{ NH: "NEW HAMPSHIRE" },
	{ NJ: "NEW JERSEY" },
	{ NJ: "JERSEY" },
	{ NM: "NEW MEXICO" },
	{ NY: "NEW YORK" },
	{ NC: "NORTH CAROLINA" },
	{ ND: "NORTH DAKOTA" },
	{ OH: "OHIO" },
	{ OK: "OKLAHOMA" },
	{ OR: "OREGON" },
	{ PA: "PENNSYLVANIA" },
	{ PA: "PENN" },
	{ RI: "RHODE ISLAND" },
	{ SC: "SOUTH CAROLINA" },
	{ SD: "SOUTH DAKOTA" },
	{ TN: "TENNESSEE" },
	{ TX: "TEXAS" },
	{ UT: "UTAH" },
	{ VT: "VERMONT" },
	{ VA: "VIRGINIA" },
	{ WA: "WASHINGTON" },
	{ WV: "WEST VIRGINIA" },
	{ WV: "W VIRGINIA" },
	{ WI: "WISCONSIN" },
	{ WY: "WYOMING" },
	// Territories
	{ AS: "AMERICAN SAMOA" },
	{ AS: "SAMOA" },
	{ GU: "GUAM" },
	{ MP: "NORTHERN MARIANA ISLANDS" },
	{ MP: "NORTHERN MARIANA" },
	{ MP: "MARIANA" },
	{ PR: "PUERTO RICO" },
	{ VI: "VIRGIN ISLANDS" },
	{ VI: "US VIRGIN ISLANDS" },
];
export const usStateCodes: string[] = States.map(
	(state) => Object.keys(state)[0],
);

const regexAddressParse = (address: string) => {
	/**
	 * Fallback regex for parsing addresses.
	 * Structure:
	 *   - street: Everything up to the first comma (e.g. "123 Main St")
	 *   - unit: Optional, matches unit/suite/floor/apt info (e.g. "Suite 200", "Apt 3B")
	 *   - city: Everything up to the next comma (can include additional comma-separated cities, e.g. "Manhattan, New York")
	 *   - state: Two uppercase letters (e.g. "NY")
	 *   - zip: Optional, 5 digits with optional 4-digit extension (e.g. "10001" or "10001-1234")
	 *   - country: Optional, matches country name at the end (e.g. "USA", "Canada")
	 */
	const fallbackPattern = new RegExp(
		"^" +
			"(?<street>[^,]+),\\s*" +
			"(?:(?<unit>[^,]*(?:floor|suite|ste|fl|unit|apt)[^,]*),\\s*)?" +
			"(?<city>[^,]+(?:,\\s*[^,]+)*),\\s*" +
			"(?<state>[A-Z]{2})" +
			"(?:[ ,]\\s*(?<zip>\\d{5}(?:-\\d{4})?))?" +
			"(?:,\\s*(?<country>[A-Za-z ]+))?" +
			"$",
		"i",
	);

	const match = address.match(fallbackPattern);

	if (match?.groups) {
		const { street, unit, city, state, zip, country } = match.groups;

		const result: NormalizedAddress = {
			line_1: trimAndTitleCase(street),
			line_2: trimAndTitleCase(unit),
			city: trimAndTitleCase(city),
			state: state?.trim().toUpperCase() || null,
			postal_code: zip?.trim() || null,
			country: trimAndTitleCase(country),
			line_3: null,
			formatted_address: null,
		};

		result.line_3 = [result.city, result.state, result.postal_code]
			.filter(Boolean)
			.join(", ");

		result.formatted_address = [result.line_1, result.line_2, result.line_3]
			.filter(Boolean)
			.join(", ");

		return result;
	}

	// If regex didn't match:
	// return minimal object to avoid crashes
	return {
		line_1: null,
		line_2: null,
		city: null,
		state: null,
		postal_code: null,
		country: null,
		line_3: null,
		formatted_address: address,
	} as NormalizedAddress;
};

/* Parse an address string into a normalized address object */
export function stringToParts(address: string): NormalizedAddress {
	// Run a poor man's Canadian address check
	// TODO: remove this once the AI matching is implemented
	const isCanadian = isCanadianAddress(address);
	const parts = parseLocation(address);

	if (!parts) {
		return regexAddressParse(address);
	}

	const addressObject = {
		line_1: `${parts?.number ? parts?.number + " " : ""}${
			parts?.prefix ? parts?.prefix + " " : ""
		}${parts?.street} ${parts?.type}${
			parts?.suffix ? " " + parts?.suffix : ""
		}`,
		line_2:
			parts.sec_unit_type && parts.sec_unit_num
				? `${parts.sec_unit_type} ${parts.sec_unit_num}`
				: null,
		city: parts.city || null,
		state: parts.state || null,
		postal_code: parts.zip || null,
		country: parts.country || null,
	} as NormalizedAddress;

	// Normalize some components
	// Init caps everything except for State which is all caps
	addressObject.line_1 = trimAndTitleCase(addressObject.line_1);
	addressObject.line_2 = trimAndTitleCase(addressObject.line_2);
	addressObject.city = trimAndTitleCase(parts.city);
	addressObject.state =
		parts.state?.toUpperCase().replace(/undefined/gi, "") || null;
	addressObject.country = trimAndTitleCase(parts.country);
	addressObject.line_3 = `${addressObject.city || ""}, ${
		addressObject.state || ""
	}, ${addressObject.postal_code || ""}`.replace(/undefined/gi, "");
	addressObject.formatted_address = `${addressObject.line_1 || ""}, ${
		addressObject.line_2 ? addressObject.line_2 + ", " : ""
	}${addressObject.line_3 || ""}`.replace(/undefined/gi, "");

	// this might not parse correctly for Canadian addresses
	if (isCanadian) {
		const { province, postalCode, country } =
			extractCanadianAddressComponents(address);
		addressObject.state = province;
		addressObject.postal_code = postalCode;
		addressObject.country = country;
	}

	return addressObject;
}

/* Convert an address object to a string */
export function partsToString(
	address: NormalizedAddress | CaseAddressObject,
	withApartment: boolean = true,
): string {
	const line1 = address.line_1;
	const city = address.city;
	const state = address.state;
	const postalCode = address.postal_code;

	// handle either having line_2 or apartment
	const line2 = withApartment
		? "apartment" in address
			? address.apartment
			: (address.line_2 ?? null)
		: null;
	const parts: string[] = [line1, line2, city, state, postalCode].reduce<
		string[]
	>((acc, key) => {
		if (key) {
			acc.push(key);
		}
		return acc;
	}, []);
	return parts.join(", ");
}

/* Convert a CaseAddressObject to a NormalizedAddress */
export function normalizeCaseAddress(
	address: CaseAddressObject,
): NormalizedAddress {
	const normalized = partsToString(address, true);
	return stringToParts(normalized);
}

/* Normalize an address string into a normalized address object */
export function normalizeString(address: string): string {
	return partsToString(stringToParts(address), true);
}

/* Calculate the levenshtein distance between two addresses */
export function levenshteinDistance(
	addr1: NormalizedAddress,
	addr2: NormalizedAddress,
): number;
export function levenshteinDistance(addr1: string, addr2: string): number;
export function levenshteinDistance(
	addr1: string | NormalizedAddress,
	addr2: string | NormalizedAddress,
): number {
	const normalized1 =
		typeof addr1 === "string"
			? normalizeString(addr1)
			: partsToString(normalizeCaseAddress(addr1 as any));
	const normalized2 =
		typeof addr2 === "string"
			? normalizeString(addr2)
			: partsToString(normalizeCaseAddress(addr2 as any));
	return distance(normalized1.toLowerCase(), normalized2.toLowerCase());
}

export function isUSAddress(address: string): boolean {
	// Check if the address ends with a US postal code OR ends with `{postalCode}, {country}` or if `{postalCode} {country}` (comma optional)
	// Example formats: "12345" or "12345-1234, US" or "12345, USA" or "12345 US" or "12345 USA"
	// Match 5 digit ZIP code with optional 4 digit suffix (e.g., 12345 or 12345-6789)
	const postalCodeEndRegex = /\d{5}(-\d{4})?$/;
	const endsWithPostalCode = postalCodeEndRegex.test(address);
	// Match 5 digit ZIP code with optional 4 digit suffix followed by US/USA (e.g., 12345 US or 12345-6789, USA)
	const postalCodeCountryEndRegex =
		/\d{5}(-\d{4})?,?\s*(US|USA|UNITED STATES|UNITED STATES OF AMERICA)$/i;
	const endsWithPostalCodeAndCountry = postalCodeCountryEndRegex.test(
		address.toUpperCase(),
	);

	const hasUSPostalCode = endsWithPostalCode || endsWithPostalCodeAndCountry;

	// Check for a US State code
	// Look for `, {StateCode}, {PostalCode}`
	const stateCodesPattern = usStateCodes.join("|");
	const usStateCodeRegex = new RegExp(
		`,\\s*(${stateCodesPattern})?,\\s*\\d{5}`,
		"i",
	);
	const hasUSStateCode = usStateCodeRegex.test(address.toUpperCase());

	// Does the address end with "us" or "usa"?
	const hasUSA =
		address.toLowerCase().endsWith(" us") ||
		address.toLowerCase().endsWith(" usa");

	return hasUSPostalCode && (hasUSStateCode || hasUSA);
}

export function isUkAddress(address: string): boolean {
	if (!address) return false;

	const lower = address.toLowerCase();

	// 1. Country/region references
	const countryIndicators = [
		"united kingdom",
		"uk",
		"great britain",
		"britain",
		"england",
		"wales",
		"scotland",
		"northern ireland",
		"gb",
	];
	const mentionsUK = countryIndicators.some((term) => lower.includes(term));

	// 2. UK postcode pattern: e.g., "G1 1DT", "SW1A 1AA", "EC1A 1BB"
	const ukPostcodePattern = /\b([A-Z]{1,2}\d{1,2}[A-Z]?) ?\d[A-Z]{2}\b/i;
	const hasUKPostcode = ukPostcodePattern.test(address);

	// Return true if either a UK keyword is present or a valid postcode is found
	return mentionsUK || hasUKPostcode;
}

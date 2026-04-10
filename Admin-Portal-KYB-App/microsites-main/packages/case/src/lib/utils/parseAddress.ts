import { parseAddress as parseWithAddresser } from "addresser";
import type { AddressValue } from "@/types/integrations";
import { formatCapitalCase } from "./formatCapitalCase";

type ParsedAddress = Omit<AddressValue, "is_primary" | "mobile">;

/** Maps normalized full US state / territory names to USPS abbreviations */
const US_STATE_FULL_NAME_TO_ABB: Record<string, string> = {
	alabama: "AL",
	alaska: "AK",
	arizona: "AZ",
	arkansas: "AR",
	california: "CA",
	colorado: "CO",
	connecticut: "CT",
	delaware: "DE",
	florida: "FL",
	georgia: "GA",
	hawaii: "HI",
	idaho: "ID",
	illinois: "IL",
	indiana: "IN",
	iowa: "IA",
	kansas: "KS",
	kentucky: "KY",
	louisiana: "LA",
	maine: "ME",
	maryland: "MD",
	massachusetts: "MA",
	michigan: "MI",
	minnesota: "MN",
	mississippi: "MS",
	missouri: "MO",
	montana: "MT",
	nebraska: "NE",
	nevada: "NV",
	"new hampshire": "NH",
	"new jersey": "NJ",
	"new mexico": "NM",
	"new york": "NY",
	"north carolina": "NC",
	"north dakota": "ND",
	ohio: "OH",
	oklahoma: "OK",
	oregon: "OR",
	pennsylvania: "PA",
	"rhode island": "RI",
	"south carolina": "SC",
	"south dakota": "SD",
	tennessee: "TN",
	texas: "TX",
	utah: "UT",
	vermont: "VT",
	virginia: "VA",
	washington: "WA",
	"west virginia": "WV",
	wisconsin: "WI",
	wyoming: "WY",
	"district of columbia": "DC",
};

/** "FL 32801" / "NY 10001-1234" at end of comma-separated chunk */
const US_STATE_SPACE_ZIP = /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;

export const parseAddress = (addressString: string): ParsedAddress | null => {
	if (!addressString || addressString.trim() === "") return null;

	let parsedAddress: ParsedAddress | null = null;

	try {
		parsedAddress = parseAddressWithAddresser(addressString);
	} catch (_error: unknown) {
		/**
		 * Addresser can throw errors when it cannot find parts of the address
		 * In this case, we fallback to our manual parser.
		 */
		parsedAddress = parseAddressManually(addressString);
	}

	return parsedAddress;
};

const parseAddressWithAddresser = (addressString: string): ParsedAddress => {
	const parsedAddress = parseWithAddresser(addressString);
	const possibleCountry = parseCountryCode(addressString);
	const country =
		possibleCountry !== parsedAddress.stateAbbreviation
			? possibleCountry
			: "US";
	return {
		line_1: parsedAddress.addressLine1 ?? null,
		apartment: parsedAddress.addressLine2 ?? null,
		city: parsedAddress.placeName ?? null,
		state: parsedAddress.stateAbbreviation ?? null,
		postal_code: parsedAddress.zipCode ?? null,
		country,
	};
};

/**
 * Parse a mailing address string into BusinessAddress[] structure.
 * Expected format: "street, [apartment], city, state, postal_code, [country]"
 * Example: "123 Main St, Apt 4B, New York, NY, 10001, US"
 */
export const parseAddressManually = (
	addressString: string,
): ParsedAddress | null => {
	if (!addressString || addressString.trim() === "") return null;

	// Split by comma and trim
	const parts = addressString
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	if (parts.length === 0) return null;

	const address: ParsedAddress = {
		line_1: null,
		apartment: null,
		city: null,
		state: null,
		postal_code: null,
		country: "US", // Default to US
	};

	const remainingParts = [...parts];

	// Parse from the end: country, postal_code, state, city
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1];
		// Check if last part is a country code
		if (/^[A-Z]{2,3}$/i.test(lastPart.trim())) {
			address.country = lastPart.toUpperCase();
			remainingParts.pop();
		}
	}

	// Postal: "FL 32801", bare US ZIP, or UK-style
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1].trim();
		const stateZip = lastPart.match(US_STATE_SPACE_ZIP);
		if (stateZip) {
			address.state = stateZip[1].toUpperCase();
			address.postal_code = stateZip[2];
			remainingParts.pop();
		} else {
			const isUsZip = /^\d{5}(-\d{4})?$/.test(lastPart);
			const isUkPostcode = /^[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}$/i.test(
				lastPart,
			);
			if (isUsZip || isUkPostcode) {
				address.postal_code = lastPart;
				remainingParts.pop();
			}
		}
	}

	// State (2-letter abbreviation)
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1];
		if (/^[A-Z]{2}$/i.test(lastPart.trim())) {
			address.state = lastPart.toUpperCase();
			remainingParts.pop();
		}
	}

	// State spelled out (e.g. "Illinois") — avoids eating the real city on the next pop
	if (remainingParts.length > 0 && !address.state) {
		const lastPart = remainingParts[remainingParts.length - 1];
		const abb = normalizeUsStateFullName(lastPart);
		if (abb) {
			address.state = abb;
			remainingParts.pop();
		}
	}

	/**
	 * If the state and country are the same, the last part of the address was just the state abbreviation.
	 * e.g. "123 Main St, New York, NY"
	 * In this case, set the country back to "US" so we don't end up with a country code of "NY".
	 */
	if (address.state && address.country && address.country === address.state) {
		address.country = "US";
	}

	// City
	if (remainingParts.length > 0) {
		address.city = remainingParts.pop() ?? null;
	}

	if (remainingParts.length > 0) {
		const { street, unit } = splitEmbeddedUnitFromStreetLine(
			remainingParts[0],
		);
		if (unit) {
			address.apartment = unit;
			remainingParts[0] = street;
		}
	}

	// Check if second part is apartment
	if (remainingParts.length > 1) {
		const secondPart = remainingParts[1];
		if (looksLikeSecondaryAddressSegment(secondPart)) {
			address.apartment = secondPart;
			remainingParts.splice(1, 1);
		}
	}

	// First part is line_1
	if (remainingParts.length > 0) {
		address.line_1 = remainingParts[0];
	}

	/** Only merge trailing segments into apartment when they look like unit lines — not leftover city text */
	if (remainingParts.length > 1 && !address.apartment) {
		const tail = remainingParts.slice(1);
		if (tail.every(looksLikeSecondaryAddressSegment)) {
			address.apartment = tail.join(", ");
		} else {
			address.line_1 = remainingParts.join(", ");
		}
	}

	return address as AddressValue;
};

const parseCountryCode = (addressString: string): string => {
	/** Last comma-separated segment, or whole string if there’s no comma */
	const lastSegment =
		addressString
			.trim()
			.match(/^.*,\s*([^,]+)\s*$/)?.[1]
			?.trim() ?? addressString.trim();
	const upper = lastSegment.toUpperCase();
	return /^[A-Z]{2,3}$/.test(upper) ? upper : "US";
};

/**
 * "47 E Robinson St UNIT 100" → street + "UNIT 100" (comma-free unit suffix)
 */
const splitEmbeddedUnitFromStreetLine = (
	line: string,
): {
	street: string;
	unit: string | null;
} => {
	const trimmed = line.trim();
	const m = trimmed.match(
		/^(.*?)\s+\b(UNIT|APT|APARTMENT|SUITE|STE)\s+(.+)$/i,
	);
	if (!m || !m[1].trim()) {
		return { street: trimmed, unit: null };
	}
	return {
		street: m[1].trim(),
		unit: `${formatCapitalCase(m[2])} ${m[3].trim()}`,
	};
};

/** True if this comma-segment is plausibly apt / unit / suite (not a city name) */
const looksLikeSecondaryAddressSegment = (value: string): boolean => {
	const lower = value.toLowerCase().trim();
	return (
		lower.startsWith("apt") ||
		lower.startsWith("unit") ||
		lower.startsWith("suite") ||
		lower.startsWith("ste") ||
		lower.startsWith("bldg") ||
		lower.startsWith("building") ||
		lower.startsWith("floor") ||
		lower.startsWith("fl ") ||
		lower.startsWith("#") ||
		/^[a-z]?\d+[a-z]?$/i.test(lower)
	);
};

const normalizeUsStateFullName = (segment: string): string | null => {
	const key = segment.trim().toLowerCase();
	return US_STATE_FULL_NAME_TO_ABB[key] ?? null;
};

/**
 * Address parsing utility for KYC Overview tab.
 *
 * The home address field displays a combined string like:
 * "123 Main Street, Apt 4B, New York, NY, 10001, US"
 *
 * When saving overrides, we need to break this back into individual fields
 * to match the KYC facts API schema.
 */

export interface ParsedAddress {
	address_line_1: string | null;
	address_line_2: string | null;
	address_apartment: string | null;
	address_city: string | null;
	address_state: string | null;
	address_postal_code: string | null;
	address_country: string | null;
}

/**
 * US state abbreviations for validation
 */
const US_STATES = [
	"AL",
	"AK",
	"AZ",
	"AR",
	"CA",
	"CO",
	"CT",
	"DE",
	"FL",
	"GA",
	"HI",
	"ID",
	"IL",
	"IN",
	"IA",
	"KS",
	"KY",
	"LA",
	"ME",
	"MD",
	"MA",
	"MI",
	"MN",
	"MS",
	"MO",
	"MT",
	"NE",
	"NV",
	"NH",
	"NJ",
	"NM",
	"NY",
	"NC",
	"ND",
	"OH",
	"OK",
	"OR",
	"PA",
	"RI",
	"SC",
	"SD",
	"TN",
	"TX",
	"UT",
	"VT",
	"VA",
	"WA",
	"WV",
	"WI",
	"WY",
	"DC",
	"PR",
	"VI",
	"GU",
	"AS",
	"MP",
];

/**
 * Common country codes
 */
const COUNTRY_CODES = ["US", "USA", "CA", "CAN", "UK", "GB"];

/**
 * Check if a string looks like a US postal code (5 digits or 5+4)
 */
function isPostalCode(value: string): boolean {
	return /^\d{5}(-\d{4})?$/.test(value.trim());
}

/**
 * Check if a string is a US state abbreviation
 */
function isStateAbbreviation(value: string): boolean {
	return US_STATES.includes(value.trim().toUpperCase());
}

/**
 * Check if a string looks like a country code
 */
function isCountryCode(value: string): boolean {
	return COUNTRY_CODES.includes(value.trim().toUpperCase());
}

/**
 * Check if a string looks like an apartment/unit designation
 */
function isApartmentDesignation(value: string): boolean {
	const lower = value.toLowerCase().trim();
	return (
		lower.startsWith("apt") ||
		lower.startsWith("unit") ||
		lower.startsWith("suite") ||
		lower.startsWith("#") ||
		/^[a-z]?\d+[a-z]?$/i.test(lower)
	);
}

/**
 * Parse a combined address string into individual fields.
 *
 * Expected format: "street, [apartment], city, state, postal_code, [country]"
 * Example: "123 Main Street, Apt 4B, New York, NY, 10001, US"
 *
 * This is a best-effort parser - addresses can be complex and varied.
 *
 * @param addressString - The combined address string
 * @param originalAddress - Optional original address to use as fallback for missing parts
 * @returns Parsed address components
 */
export function parseAddressString(
	addressString: string,
	originalAddress?: Partial<ParsedAddress>,
): ParsedAddress {
	// Default result with null values
	const result: ParsedAddress = {
		address_line_1: null,
		address_line_2: null,
		address_apartment: null,
		address_city: null,
		address_state: null,
		address_postal_code: null,
		address_country: null,
	};

	if (!addressString || addressString.trim() === "") {
		return result;
	}

	// Split by comma and trim each part
	const parts = addressString
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);

	if (parts.length === 0) {
		return result;
	}

	// Work backwards to identify known patterns
	const remainingParts = [...parts];

	// Check if last part is a country code
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1];
		if (isCountryCode(lastPart)) {
			result.address_country = lastPart.toUpperCase();
			remainingParts.pop();
		}
	}

	// Check if next-to-last is a postal code
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1];
		if (isPostalCode(lastPart)) {
			result.address_postal_code = lastPart.trim();
			remainingParts.pop();
		}
	}

	// Check if next is a state abbreviation
	if (remainingParts.length > 0) {
		const lastPart = remainingParts[remainingParts.length - 1];
		if (isStateAbbreviation(lastPart)) {
			result.address_state = lastPart.toUpperCase();
			remainingParts.pop();
		}
	}

	// Next should be the city
	if (remainingParts.length > 0) {
		result.address_city = remainingParts.pop() ?? null;
	}

	// Now check remaining parts for apartment/unit designation
	if (remainingParts.length > 1) {
		// Check if second part looks like an apartment
		const secondPart = remainingParts[1];
		if (isApartmentDesignation(secondPart)) {
			result.address_apartment = secondPart;
			remainingParts.splice(1, 1);
		}
	}

	// First remaining part is the street address (address_line_1)
	if (remainingParts.length > 0) {
		result.address_line_1 = remainingParts[0];
	}

	// Any remaining parts after the first go to address_line_2
	if (remainingParts.length > 1) {
		result.address_line_2 = remainingParts.slice(1).join(", ");
	}

	// Use original values as fallback for any null fields
	if (originalAddress) {
		if (!result.address_line_1 && originalAddress.address_line_1) {
			result.address_line_1 = originalAddress.address_line_1;
		}
		if (!result.address_line_2 && originalAddress.address_line_2) {
			result.address_line_2 = originalAddress.address_line_2;
		}
		if (!result.address_apartment && originalAddress.address_apartment) {
			result.address_apartment = originalAddress.address_apartment;
		}
		if (!result.address_city && originalAddress.address_city) {
			result.address_city = originalAddress.address_city;
		}
		if (!result.address_state && originalAddress.address_state) {
			result.address_state = originalAddress.address_state;
		}
		if (
			!result.address_postal_code &&
			originalAddress.address_postal_code
		) {
			result.address_postal_code = originalAddress.address_postal_code;
		}
		if (!result.address_country && originalAddress.address_country) {
			result.address_country = originalAddress.address_country;
		}
	}

	return result;
}

/**
 * Check if the user edited the home_address field.
 */
export function isAddressField(fieldKey: string): boolean {
	return fieldKey === "home_address";
}

/**
 * Get all address field keys that should be updated when home_address changes.
 */
export const ADDRESS_FIELD_KEYS = [
	"address_line_1",
	"address_line_2",
	"address_apartment",
	"address_city",
	"address_state",
	"address_postal_code",
	"address_country",
] as const;

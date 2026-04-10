import { parseAddress } from "@/lib/utils";
import { VALUE_NOT_AVAILABLE } from "../../../../constants/ValueConstants";

// Fields that expect boolean values in the API
const BOOLEAN_FIELDS = ["minority_owned", "woman_owned", "veteran_owned"];

// Fields that expect array of strings values in the API
const STRING_ARRAY_FIELDS = ["dba"];

// Fields that expect integer values (count-type fields)
const INTEGER_FIELDS = [
	"num_employees",
	"num_judgements",
	"num_liens",
	"num_bankruptcies",
];

// Fields that expect currency/decimal values
const CURRENCY_FIELDS = [
	"revenue",
	"net_income",
	"judgements_most_recent_amount",
	"judgements_total_amount",
	"liens_most_recent_amount",
	"liens_total_amount",
	// Processing History currency fields (short form field keys)
	"general_annual_volume",
	"general_monthly_volume",
	"general_average_volume",
	"general_high_ticket",
	"general_desired_limit",
	"card_annual_volume",
	"card_monthly_volume",
	"card_average_volume",
	"card_high_ticket",
	"card_desired_limit",
	"amex_annual_volume",
	"amex_monthly_volume",
	"amex_average_volume",
	"amex_high_ticket",
	"amex_desired_limit",
];

// Fields that expect percentage values (0-100)
const PERCENTAGE_FIELDS = [
	"pos_card_swiped",
	"pos_card_typed",
	"pos_ecommerce",
	"pos_mail_telephone",
];

// Fields that expect array of strings (Processing History)
const PROCESSING_HISTORY_ARRAY_FIELDS = ["seasonal_high_volume_months"];

// Fields that expect date values
const DATE_FIELDS = [
	"judgements_most_recent",
	"liens_most_recent",
	"bankruptcies_most_recent",
];

// Fields that need lowercase conversion (status fields)
const LOWERCASE_FIELDS = [
	"judgements_most_recent_status",
	"liens_most_recent_status",
	"bankruptcies_most_recent_status",
];

// Fields that expect a structured object as API value; form sends object, we pass it through to API.
const ADDRESS_OBJECT_FIELDS = ["primary_address"];

// Fields that expect an array of structured objects as API value; form sends array, we pass it through to API.
const ADDRESS_ARRAY_FIELDS = ["mailing_address"];

/**
 * Mapping of flat form field keys to nested fact structure.
 * Some facts contain nested properties that need to be sent as a complete object.
 * Example: "judgements" contains { most_recent, most_recent_status, most_recent_amount, etc. }
 *
 * Add new nested field mappings here for other tabs that have similar structures.
 */
const NESTED_FIELD_MAP: Record<
	string,
	{ parentFact: string; childKey: string }
> = {
	// Judgements nested fields (Public Filings)
	judgements_most_recent: {
		parentFact: "judgements",
		childKey: "most_recent",
	},
	judgements_most_recent_status: {
		parentFact: "judgements",
		childKey: "most_recent_status",
	},
	judgements_most_recent_amount: {
		parentFact: "judgements",
		childKey: "most_recent_amount",
	},
	judgements_total_amount: {
		parentFact: "judgements",
		childKey: "total_judgement_amount",
	},
	// Liens nested fields (Public Filings)
	liens_most_recent: { parentFact: "liens", childKey: "most_recent" },
	liens_most_recent_status: {
		parentFact: "liens",
		childKey: "most_recent_status",
	},
	liens_most_recent_amount: {
		parentFact: "liens",
		childKey: "most_recent_amount",
	},
	liens_total_amount: {
		parentFact: "liens",
		childKey: "total_open_lien_amount",
	},
	// Bankruptcies nested fields (Public Filings)
	bankruptcies_most_recent: {
		parentFact: "bankruptcies",
		childKey: "most_recent",
	},
	bankruptcies_most_recent_status: {
		parentFact: "bankruptcies",
		childKey: "most_recent_status",
	},
};

/**
 * Check if a field is a nested field that requires merging with parent object
 */
export function isNestedField(fieldKey: string): boolean {
	return fieldKey in NESTED_FIELD_MAP;
}

/**
 * Get the parent fact and child key for a nested field
 */
export function getNestedFieldMapping(
	fieldKey: string,
): { parentFact: string; childKey: string } | null {
	return NESTED_FIELD_MAP[fieldKey] ?? null;
}

/**
 * Check if a value is empty/N/A
 */
function isEmptyValue(value: string): boolean {
	return value === "" || value === "N/A" || value === VALUE_NOT_AVAILABLE;
}

/**
 * Convert display string to API value with proper type conversion.
 *
 * Handles:
 * - Boolean fields: "Yes" -> true, "No" -> false, empty -> null
 * - String array fields: splits comma-separated values into array, empty -> empty array
 * - Integer fields: converts to number, empty -> null
 * - Currency fields: removes formatting, converts to number, empty -> null
 * - Date fields: converts to Date object, empty -> null
 * - Lowercase fields: converts to lowercase string
 * - All other fields: returns as-is
 *
 * @param fieldKey - The field key to determine conversion type
 * @param displayValue - The display value to convert
 * @returns The converted value for the API
 */
export function convertToApiValue(
	fieldKey: string,
	displayValue: string | string[],
):
	| string
	| boolean
	| number
	| Date
	| string[]
	| null
	| Record<string, unknown>
	| Record<string, unknown>[] {
	// Handle array values directly (e.g., from multi-select fields)
	if (Array.isArray(displayValue)) {
		return displayValue.length === 0 ? [] : displayValue;
	}

	// Handle empty values for most field types
	if (isEmptyValue(displayValue)) {
		// Boolean fields with empty values should return null
		if (BOOLEAN_FIELDS.includes(fieldKey)) return null;
		// String array fields with empty values should return empty array
		if (STRING_ARRAY_FIELDS.includes(fieldKey)) return [];
		// Processing History array fields with empty values should return empty array
		if (PROCESSING_HISTORY_ARRAY_FIELDS.includes(fieldKey)) return [];
		// Numeric fields with empty values should return null
		if (INTEGER_FIELDS.includes(fieldKey)) return null;
		if (CURRENCY_FIELDS.includes(fieldKey)) return null;
		if (PERCENTAGE_FIELDS.includes(fieldKey)) return null;
		// Date fields with empty values should return null
		if (DATE_FIELDS.includes(fieldKey)) return null;
		// Lowercase fields with empty values should return null
		if (LOWERCASE_FIELDS.includes(fieldKey)) return null;
		// Other fields return null
		return null;
	}

	// Boolean fields: "Yes" -> true, "No" -> false
	if (BOOLEAN_FIELDS.includes(fieldKey)) {
		if (displayValue === "Yes") return true;
		if (displayValue === "No") return false;
		return null;
	}

	// String array fields: wrap single value in array
	// User edits one DBA at a time, which gets wrapped as ["NewDBA"]
	if (STRING_ARRAY_FIELDS.includes(fieldKey)) {
		const trimmed = displayValue.trim();
		return trimmed.length > 0 ? [trimmed] : [];
	}

	// Integer fields: convert to integer
	if (INTEGER_FIELDS.includes(fieldKey)) {
		const num = parseInt(displayValue, 10);
		return isNaN(num) ? null : num;
	}

	// Currency fields: remove formatting and convert to number
	if (CURRENCY_FIELDS.includes(fieldKey)) {
		const cleanValue = displayValue.replace(/[$,]/g, "");
		const num = parseFloat(cleanValue);
		return isNaN(num) ? null : num;
	}

	// Percentage fields: convert to number (0-100)
	if (PERCENTAGE_FIELDS.includes(fieldKey)) {
		const cleanValue = displayValue.replace(/%/g, "");
		const num = parseFloat(cleanValue);
		return isNaN(num) ? null : num;
	}

	// Processing History array fields: split comma-separated string into array
	if (PROCESSING_HISTORY_ARRAY_FIELDS.includes(fieldKey)) {
		const trimmed = displayValue.trim();
		return trimmed.length > 0
			? trimmed.split(",").map((s) => s.trim())
			: [];
	}

	// Date fields: convert to Date object
	if (DATE_FIELDS.includes(fieldKey)) {
		const date = new Date(displayValue);
		return isNaN(date.getTime()) ? null : date;
	}

	// Lowercase fields: convert to lowercase
	if (LOWERCASE_FIELDS.includes(fieldKey)) {
		return displayValue.toLowerCase();
	}

	// Address fields: parse string into structured format
	if (ADDRESS_ARRAY_FIELDS.includes(fieldKey)) {
		const parsedAddress = parseAddress(displayValue) as unknown as Record<
			string,
			unknown
		>;
		if (!parsedAddress) return null;
		parsedAddress.is_primary = false;
		parsedAddress.mobile = null;
		return [parsedAddress];
	}

	if (ADDRESS_OBJECT_FIELDS.includes(fieldKey)) {
		const parsedAddress = parseAddress(displayValue) as unknown as Record<
			string,
			unknown
		>;
		if (!parsedAddress) return null;
		parsedAddress.is_primary = fieldKey === "primary_address";
		parsedAddress.mobile = null;
		return parsedAddress;
	}

	return displayValue;
}

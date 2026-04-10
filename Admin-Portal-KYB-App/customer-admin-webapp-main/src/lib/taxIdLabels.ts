/**
 * Configuration format for all Tax ID label types per country.
 */
export interface TaxIdLabelConfig {
	short: string;
	long: string;
	formLabel: string;
	sectionTitle: string;
	fieldLabel: string;
}

/**
 * Optional error message overrides for specific countries.
 */
export interface TaxIdErrorOverride {
	required?: string;
	valid?: string;
}

/**
 * Supported validation error types.
 */
export type TaxIdErrorType = "required" | "valid";

/**
 * Available label formats that UI components may request.
 */
export type TaxIdLabelFormat =
	| "short"
	| "long"
	| "formLabel"
	| "sectionTitle"
	| "fieldLabel";

/**
 * Country-specific label definitions for Tax IDs.
 */
export const TAX_ID_LABELS: Record<string, TaxIdLabelConfig> = {
	US: {
		short: "TIN",
		long: "Tax ID Number (EIN)",
		formLabel: "TIN/SSN/EIN",
		sectionTitle: "Tax ID Verification",
		fieldLabel: "Tax ID",
	},
	CA: {
		short: "BRN",
		long: "Business Number (BN)",
		formLabel: "BN/GST/HST Number",
		sectionTitle: "Business Number Verification",
		fieldLabel: "Business Number",
	},
	GB: {
		short: "CRN",
		long: "Company Registration Number (CRN)",
		formLabel: "Company Registration Number",
		sectionTitle: "Company Registration Verification",
		fieldLabel: "Company Registration Number",
	},
	UK: {
		short: "CRN",
		long: "Company Registration Number (CRN)",
		formLabel: "Company Registration Number",
		sectionTitle: "Company Registration Verification",
		fieldLabel: "Company Registration Number",
	},
};

export type TaxIdCountryCode = keyof typeof TAX_ID_LABELS;

/**
 * Default labels used when a country does not have a defined mapping.
 */
export const DEFAULT_LABELS: TaxIdLabelConfig = {
	short: "TIN",
	long: "Registration Number",
	formLabel: "Registration Number",
	sectionTitle: "Tax ID Verification",
	fieldLabel: "Tax ID",
};

/**
 * Returns the appropriate Tax ID label for a given country and label format.
 *
 * @param countryCode - Country code to determine label set.
 * @param format - The specific label format requested.
 */
export const getTaxIdLabel = (
	countryCode: string | undefined | null,
	format: TaxIdLabelFormat = "short",
): string => {
	// When country is undefined/null, normalizeCountryCode defaults to "US"
	const normalizedCode = normalizeCountryCode(countryCode);
	const labels = TAX_ID_LABELS[normalizedCode];

	return labels?.[format] ?? DEFAULT_LABELS[format];
};

/**
 * Normalizes different country code variations into a consistent format.
 *
 * Examples:
 *  - "usa", "U.S.", "United States" → "US"
 *  - "can", "Canada" → "CA"
 *  - "UK", "GB", "United Kingdom" → "GB"
 *
 * @param countryCode - Raw country code input.
 */
export const normalizeCountryCode = (
	countryCode: string | undefined | null,
): string => {
	if (!countryCode) return "US";

	const code = countryCode.trim().toUpperCase();

	switch (code) {
		case "US":
		case "USA":
		case "U.S.":
		case "U.S.A.":
		case "UNITED STATES":
			return "US";

		case "CA":
		case "CAN":
		case "CANADA":
			return "CA";

		case "UK":
		case "GB":
		case "GBR":
		case "UNITED KINGDOM":
			return "GB";

		case "PR":
		case "PRI":
		case "PUERTO RICO":
			return "PR";

		case "AU":
		case "AUS":
		case "AUSTRALIA":
			return "AU";

		case "NZ":
		case "NZL":
		case "NEW ZEALAND":
			return "NZ";

		default:
			return code;
	}
};

/**
 * Convenience helper to check whether a country is the United States.
 */
export const isUSCountry = (countryCode: string | undefined | null): boolean =>
	normalizeCountryCode(countryCode) === "US";

/**
 * Convenience helper to check whether a country is Canada.
 */
export const isCanadaCountry = (
	countryCode: string | undefined | null,
): boolean => normalizeCountryCode(countryCode) === "CA";

/**
 * Convenience helper to check whether a country is the United Kingdom.
 */
export const isUKCountry = (countryCode: string | undefined | null): boolean =>
	normalizeCountryCode(countryCode) === "GB";

/**
 * Returns true if the country's Tax ID format allows alphanumeric characters.
 * Only US requires numeric only. All other countries allow alphanumeric.
 */
export const allowsAlphanumericTaxId = (
	countryCode: string | undefined | null,
): boolean => {
	const normalizedCode = normalizeCountryCode(countryCode);
	// Only US requires digits only; all other countries allow alphanumeric
	return normalizedCode !== "US";
};

/* -------------------------------------------------------------------
 *  VALIDATION RULES
 * ------------------------------------------------------------------- */

/**
 * Validation rule configuration for Tax IDs.
 */
export interface TaxIdValidationRule {
	regex?: RegExp;
	normalize?: (v: string) => string;
	description: string;
	validator?: (v: string) => boolean;
}

/**
 * Each supported country has a strict validation rule when available.
 *
 * If no country rule is defined, a fallback rule (1–22 alphanumeric characters)
 * is applied for international onboarding support.
 */
export const TAX_ID_VALIDATION_RULES: Record<string, TaxIdValidationRule> = {
	US: {
		regex: /^\d{9}$/,
		normalize: (v) => v.replace(/\D/g, ""),
		description: "9-digit TIN/SSN/EIN",
	},
	GB: {
		// UK business identifiers: UTR, NINO, CRN, VAT
		normalize: (v: string) => v.replace(/\s+/g, "").toUpperCase(),
		description:
			"UK business identifiers: UTR (10 digits), NINO (2 letters + 6 digits + optional suffix), CRN (7-8 alphanumeric), VAT (9-12 digits, optional GB prefix)",
		// Custom validator to check all UK business ID patterns
		validator: (v: string) => {
			const value = v.replace(/\s+/g, "").toUpperCase();
			// UTR: 10 digits
			const UTR = /^\d{10}$/;
			// NINO: 2 letters (excluding D, F, I, O, Q, U, V) + 6 digits + optional suffix letter A-D
			const NINO = /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]?$/;
			// CRN: 7-8 digits, OR 1-2 letters + 5-7 digits (covers SC, NI, OC, NC, LP, R0 formats)
			const CRN = /^(\d{7,8}|[A-Z]{1,2}\d{5,7})$/;
			// VAT: optional GB prefix + 9-12 digits
			const VAT = /^(GB)?\d{9,12}$/;

			return (
				UTR.test(value) ||
				NINO.test(value) ||
				CRN.test(value) ||
				VAT.test(value)
			);
		},
	},
};

/**
 * Global fallback validation boundaries for unknown countries.
 */
export const GLOBAL_TAX_ID_FALLBACK_MIN = 1;
export const GLOBAL_TAX_ID_FALLBACK_MAX = 22;

/**
 * Returns the validation rule for a given country code.
 * Returns undefined if no specific rule exists (use fallback).
 *
 * @param countryCode - Country code to get validation for
 */
export const getTaxIdValidationRule = (
	countryCode: string | undefined | null,
): TaxIdValidationRule | undefined => {
	const normalizedCode = normalizeCountryCode(countryCode);
	return TAX_ID_VALIDATION_RULES[normalizedCode];
};

/* -------------------------------------------------------------------
 *  ERROR MESSAGE GENERATION
 * ------------------------------------------------------------------- */

/**
 * Generates country-specific validation messaging for Tax IDs.
 *
 * Logic order:
 *  1. Country override messages (legacy support)
 *  2. Required field messaging
 *  3. Strict validation rules (if available)
 *  4. Global fallback (1–22 characters)
 *
 * @param countryCode - Country to evaluate.
 * @param type - "required" or "valid".
 */
export const getTaxIdErrorMessage = (
	countryCode: string | undefined | null,
	type: TaxIdErrorType,
): string => {
	const normalizedCode = normalizeCountryCode(countryCode);
	const formLabel = getTaxIdLabel(normalizedCode, "formLabel");

	const overrides: Record<string, TaxIdErrorOverride> = {
		US: {
			required: "*TIN/SSN/EIN Number is required",
			valid: "*Invalid TIN/SSN/EIN Number",
		},
	};

	const override = overrides[normalizedCode]?.[type];
	if (override) return override;

	if (type === "required") {
		return `*${formLabel} is required`;
	}

	const rule = TAX_ID_VALIDATION_RULES[normalizedCode];

	if (!rule) {
		return `*${formLabel} must be between ${GLOBAL_TAX_ID_FALLBACK_MIN} and ${GLOBAL_TAX_ID_FALLBACK_MAX} characters`;
	}

	return `*Invalid ${formLabel}: expected ${rule.description}`;
};

/* -------------------------------------------------------------------
 *  YUP VALIDATION HELPERS
 * ------------------------------------------------------------------- */

/**
 * Validates a Tax ID value against country-specific rules.
 * Returns true if valid, false otherwise.
 *
 * @param value - The Tax ID value to validate
 * @param countryCode - The country code to validate against
 */
export const isValidTaxId = (
	value: string | null | undefined,
	countryCode: string | undefined | null,
): boolean => {
	if (!value || value === "") return true; // Empty values handled by required validation

	const normalizedCountry = normalizeCountryCode(countryCode);
	const rule = TAX_ID_VALIDATION_RULES[normalizedCountry];

	if (rule) {
		if (normalizedCountry === "US" && /[A-Za-z]/.test(value)) {
			return false;
		}

		const normalizedValue = rule.normalize ? rule.normalize(value) : value;

		// Use custom validator if available, otherwise use regex
		if (rule.validator) {
			return rule.validator(normalizedValue);
		}

		if (rule.regex) {
			return rule.regex.test(normalizedValue);
		}
	}

	// Fallback for non-US countries: 1-22 alphanumeric characters
	const alphanumericRegex = /^[A-Za-z0-9]{1,22}$/;
	return alphanumericRegex.test(value);
};

/**
 * Gets the maximum length for Tax ID input field based on country.
 *
 * @param countryCode - The country code
 */
export const getTaxIdMaxLength = (
	countryCode: string | undefined | null,
): number => {
	const normalizedCountry = normalizeCountryCode(countryCode);

	switch (normalizedCountry) {
		case "US":
			return 9;
		default:
			// All non-US countries allow up to 22 characters
			return GLOBAL_TAX_ID_FALLBACK_MAX;
	}
};

/**
 * Buffer for US TIN formatting characters (e.g., SSN "123-45-6789" has 2 dashes).
 * We use +4 to provide a safety margin for edge cases like spaces or other delimiters.
 */
const US_TIN_FORMAT_BUFFER = 4;

/**
 * Buffer for international TIN formatting characters.
 * Various countries may use dashes, spaces, or other delimiters.
 * We use +6 to generously accommodate different international formats.
 */
const INTERNATIONAL_TIN_FORMAT_BUFFER = 6;

/**
 * Returns a buffered max length for TIN input fields to accommodate formatted input.
 *
 * This function is designed to allow users to paste formatted TINs (with dashes, spaces, etc.)
 * into input fields. The actual clean max length is enforced after stripping formatting characters.
 *
 * Relationship to `getTaxIdMaxLength`:
 * - `getTaxIdMaxLength` returns the clean max length (digits/alphanumeric only)
 * - `getTaxIdInputMaxLength` returns clean max length + buffer for formatting characters
 *
 * Buffer sizes:
 * - US: +4 (e.g., SSN formatted as "123-45-6789" = 11 chars vs clean "123456789" = 9 chars)
 * - Others: +6 (generous buffer for various international formats)
 *
 * @param countryCode - The country code to get buffered max length for
 * @returns The max length including buffer for formatting characters
 *
 * @example
 * US SSN: clean length 9 + buffer 4 = 13
 * getTaxIdInputMaxLength("US") // returns 13
 */
export const getTaxIdInputMaxLength = (
	countryCode: string | undefined | null,
): number => {
	const normalizedCountry = normalizeCountryCode(countryCode);
	const baseMaxLength = getTaxIdMaxLength(countryCode);

	switch (normalizedCountry) {
		case "US":
			return baseMaxLength + US_TIN_FORMAT_BUFFER;
		default:
			return baseMaxLength + INTERNATIONAL_TIN_FORMAT_BUFFER;
	}
};

/**
 * Configuration for Tax ID yup validation.
 */
export interface TaxIdYupConfig {
	requiredMessage: string;
	validMessage: string;
	minLength: number;
	maxLength: number;
	regex?: RegExp;
	validator?: (v: string) => boolean;
}

/**
 * Returns yup-compatible validation configuration for a country.
 *
 * @param countryCode - The country code to get config for
 */
export const getTaxIdYupConfig = (
	countryCode: string | undefined | null,
): TaxIdYupConfig => {
	const normalizedCountry = normalizeCountryCode(countryCode);
	const rule = TAX_ID_VALIDATION_RULES[normalizedCountry];

	// Determine min/max length based on country
	let minLength = GLOBAL_TAX_ID_FALLBACK_MIN;
	let maxLength = GLOBAL_TAX_ID_FALLBACK_MAX;

	if (normalizedCountry === "US") {
		minLength = 9;
		maxLength = 9;
	} else if (normalizedCountry === "GB") {
		minLength = 7; // CRN minimum is 7 chars
		maxLength = GLOBAL_TAX_ID_FALLBACK_MAX; // Allow up to 22 chars
	}

	return {
		requiredMessage: getTaxIdErrorMessage(normalizedCountry, "required"),
		validMessage: getTaxIdErrorMessage(normalizedCountry, "valid"),
		minLength,
		maxLength,
		regex: rule?.regex,
		validator: rule?.validator,
	};
};

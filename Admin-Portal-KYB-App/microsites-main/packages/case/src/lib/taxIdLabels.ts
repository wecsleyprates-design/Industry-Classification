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
	if (!countryCode) return DEFAULT_LABELS[format];

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
 * Currently only UK CRN supports letter prefixes (e.g., SC123456, NI123456).
 */
export const allowsAlphanumericTaxId = (
	countryCode: string | undefined | null,
): boolean => {
	const normalizedCode = normalizeCountryCode(countryCode);
	// UK CRN can have letter prefixes like SC, NI, OC, etc.
	return normalizedCode === "GB";
};

/* -------------------------------------------------------------------
 *  VALIDATION RULES
 * ------------------------------------------------------------------- */

/**
 * Validation rule configuration for Tax IDs.
 */
export interface TaxIdValidationRule {
	regex: RegExp;
	normalize?: (v: string) => string;
	description: string;
}

/**
 * Each supported country has a strict validation rule when available.
 *
 * If no country rule is defined, a fallback rule (1–22 characters)
 * is applied for international onboarding support.
 */
export const TAX_ID_VALIDATION_RULES: Record<string, TaxIdValidationRule> = {
	US: {
		regex: /^\d{9}$/,
		normalize: (v) => v.replace(/\D/g, ""),
		description: "9-digit TIN/SSN/EIN",
	},
	CA: {
		regex: /^\d{9}$/,
		normalize: (v) => v.replace(/\D/g, ""),
		description: "9-digit Business Number (BN)",
	},
	GB: {
		/**
		 * UK Company Registration Number (CRN)
		 * Valid formats:
		 *  - 8 digits
		 *  - Approved prefixes (Companies House) + 6 digits
		 *
		 * Allowed prefixes include:
		 *  AC, CE, FC, FE, GE, IP, LP, NL, OC, OE, SC, SO, SZ, NI, R0, RC
		 */
		regex: /^(\d{8}|(AC|CE|FC|FE|GE|IP|LP|NL|OC|OE|SC|SO|SZ|NI|R0|RC)\d{6})$/i,
		normalize: (v) => v.trim().toUpperCase(),
		description:
			"8-digit CRN or valid UK prefix (AC, CE, FC, FE, GE, IP, LP, NL, OC, OE, SC, SO, SZ, NI, R0, RC) followed by 6 digits",
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
		CA: {
			required: "*BN/GST/HST Number is required",
			valid: "*Invalid BN/GST/HST Number",
		},
		GB: {
			required: "*Company Registration Number is required",
			valid: "*Invalid Company Registration Number",
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
		const normalizedValue = rule.normalize ? rule.normalize(value) : value;
		return rule.regex.test(normalizedValue);
	}

	// Fallback: 1-22 characters
	return (
		value.length >= GLOBAL_TAX_ID_FALLBACK_MIN &&
		value.length <= GLOBAL_TAX_ID_FALLBACK_MAX
	);
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
		case "CA":
			return 9;
		case "GB":
			return 8; // 8 digits or prefix + 6 digits
		default:
			return GLOBAL_TAX_ID_FALLBACK_MAX;
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

	return {
		requiredMessage: getTaxIdErrorMessage(normalizedCountry, "required"),
		validMessage: getTaxIdErrorMessage(normalizedCountry, "valid"),
		minLength: rule
			? normalizedCountry === "US" || normalizedCountry === "CA"
				? 9
				: 1
			: GLOBAL_TAX_ID_FALLBACK_MIN,
		maxLength: rule
			? normalizedCountry === "US" || normalizedCountry === "CA"
				? 9
				: GLOBAL_TAX_ID_FALLBACK_MAX
			: GLOBAL_TAX_ID_FALLBACK_MAX,
		regex: rule?.regex,
	};
};

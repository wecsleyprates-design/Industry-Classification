import type { RegisterOptions } from "react-hook-form";
import type { PublicFilingsTabFormValues } from "../schemas/PublicFilingsTab/publicFilingsTabSchema";

/**
 * Validation rules for PublicFilingsTab fields.
 * Uses react-hook-form's RegisterOptions format.
 */

// Regex patterns
const REGEX = {
	ONLY_NUMBERS: /^[0-9]*$/,
} as const;

// Error messages
const ERROR_MESSAGES = {
	VALID_NUMBER: "Please enter a valid number",
	VALID_CURRENCY: "Enter a valid number (e.g. 5000 or 5000.00)",
} as const;

/**
 * Validate number input (positive integer, allows empty).
 */
export const validateNumber = (value: string | undefined): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	// Must be only digits (no decimals, no negative, no characters/symbols)
	const isValid = REGEX.ONLY_NUMBERS.test(value.trim());
	return isValid || ERROR_MESSAGES.VALID_NUMBER;
};

/**
 * Validate currency value (integer or decimal with up to 2 decimal places).
 */
export const validateCurrency = (
	value: string | undefined,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid
	}

	// Allow integers or decimals with up to 2 decimal places
	// Examples: 1000, 1000.00, 1000.5, 50000.99
	const currencyRegex = /^-?\d+(\.\d{1,2})?$/;
	const isValid = currencyRegex.test(value.trim());
	return isValid || ERROR_MESSAGES.VALID_CURRENCY;
};

/**
 * Get validation rules for a specific field.
 * Returns react-hook-form RegisterOptions.
 */
export const getFieldValidationRules = (
	fieldKey: keyof PublicFilingsTabFormValues,
): RegisterOptions<PublicFilingsTabFormValues> | undefined => {
	switch (fieldKey) {
		case "num_judgements":
		case "num_liens":
		case "num_bankruptcies":
			return {
				validate: validateNumber,
			};
		case "judgements_most_recent_amount":
		case "judgements_total_amount":
		case "liens_most_recent_amount":
		case "liens_total_amount":
			return {
				validate: validateCurrency,
			};
		default:
			return undefined;
	}
};

/**
 * Map of field keys to their validation rules.
 * Can be used to get all validation rules at once.
 */
export const FIELD_VALIDATION_RULES: Partial<
	Record<
		keyof PublicFilingsTabFormValues,
		RegisterOptions<PublicFilingsTabFormValues>
	>
> = {
	num_judgements: { validate: validateNumber },
	num_liens: { validate: validateNumber },
	num_bankruptcies: { validate: validateNumber },
	judgements_most_recent_amount: { validate: validateCurrency },
	judgements_total_amount: { validate: validateCurrency },
	liens_most_recent_amount: { validate: validateCurrency },
	liens_total_amount: { validate: validateCurrency },
};

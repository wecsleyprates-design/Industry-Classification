import type { RegisterOptions } from "react-hook-form";
import {
	validateEmail as sharedValidateEmail,
	validatePhoneNumber as sharedValidatePhoneNumber,
	VALIDATION_REGEX,
} from "../../../../utils/validation";
import { ERROR_MESSAGES } from "../../constants/BackgroundTab/errorMessages";
import type { BackgroundTabFormValues } from "../../schemas/BackgroundTab/backgroundTabSchema";

/**
 * Validation rules for BackgroundTab fields.
 * Uses react-hook-form's RegisterOptions format.
 * Consistent with onboarding flow validations.
 */

/**
 * Validate phone number with BackgroundTab error message.
 */
export const validatePhoneNumber = (
	value: string | undefined,
): boolean | string =>
	sharedValidatePhoneNumber(value, ERROR_MESSAGES.VALID_PHONE);

/**
 * Validate email with BackgroundTab error message.
 */
export const validateEmail = (value: string | undefined): boolean | string =>
	sharedValidateEmail(value, ERROR_MESSAGES.VALID_EMAIL);

/**
 * Validate NPI number (10 digits).
 */
export const validateNPI = (value: string | undefined): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const isValid =
		VALIDATION_REGEX.ONLY_NUMBERS.test(value) && value.length === 10;
	return isValid || ERROR_MESSAGES.VALID_NPI;
};

/**
 * Validate NAICS code (typically 2-6 digits).
 */
export const validateNAICS = (value: string | undefined): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid
	}

	const isValid =
		VALIDATION_REGEX.ONLY_NUMBERS.test(value) &&
		value.length >= 2 &&
		value.length <= 6;
	return isValid || ERROR_MESSAGES.VALID_NAICS;
};

/**
 * Validate MCC code (typically 4 digits).
 */
export const validateMCC = (value: string | undefined): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid
	}

	const isValid =
		VALIDATION_REGEX.ONLY_NUMBERS.test(value) && value.length === 4;
	return isValid || ERROR_MESSAGES.VALID_MCC;
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
	return isValid || "Enter a valid number (e.g. 50000 or 50000.00)";
};

/**
 * Validate number of employees (positive integer or range, allows empty).
 * Accepts: "50", "100", "10-15", "50-100"
 */
export const validateNumEmployees = (
	value: string | undefined,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const trimmed = value.trim();

	// Check for single number (only digits)
	if (VALIDATION_REGEX.ONLY_NUMBERS.test(trimmed)) {
		return true;
	}

	// Check for range format: digits-digits (e.g., "10-15", "50-100")
	const rangeRegex = /^\d+-\d+$/;
	if (rangeRegex.test(trimmed)) {
		// Optionally validate that the first number is less than or equal to the second
		const [start, end] = trimmed.split("-").map(Number);
		if (start <= end) {
			return true;
		}
		return "Range start must be less than or equal to end";
	}

	return ERROR_MESSAGES.VALID_NUM_EMPLOYEES;
};

/**
 * Get validation rules for a specific field.
 * Returns react-hook-form RegisterOptions.
 */
export const getFieldValidationRules = (
	fieldKey: keyof BackgroundTabFormValues,
): RegisterOptions<BackgroundTabFormValues> | undefined => {
	switch (fieldKey) {
		case "business_phone":
			return {
				validate: validatePhoneNumber,
			};
		case "email":
			return {
				validate: validateEmail,
			};
		case "npi_number":
			return {
				validate: validateNPI,
			};
		case "naics_code":
			return {
				validate: validateNAICS,
			};
		case "mcc_code":
			return {
				validate: validateMCC,
			};
		case "revenue":
		case "net_income":
			return {
				validate: validateCurrency,
			};
		case "num_employees":
			return {
				validate: validateNumEmployees,
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
		keyof BackgroundTabFormValues,
		RegisterOptions<BackgroundTabFormValues>
	>
> = {
	business_phone: { validate: validatePhoneNumber },
	email: { validate: validateEmail },
	npi_number: { validate: validateNPI },
	naics_code: { validate: validateNAICS },
	mcc_code: { validate: validateMCC },
	revenue: { validate: validateCurrency },
	net_income: { validate: validateCurrency },
	num_employees: { validate: validateNumEmployees },
};

import { isPossiblePhoneNumber } from "libphonenumber-js";
import { isUSCountry } from "@/lib/taxIdLabels";

import { VALUE_NOT_AVAILABLE } from "@/constants";

/**
 * Common regex patterns for validation.
 * Consistent with onboarding flow validations.
 */
export const VALIDATION_REGEX = {
	ONLY_NUMBERS: /^[0-9]*$/,
	EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	SSN: /^\d{9}$/, // 9 digits only (unformatted)
} as const;

/**
 * Default error messages for common validators.
 */
export const DEFAULT_ERROR_MESSAGES = {
	VALID_SSN: "Please enter a valid 9-digit SSN",
	VALID_PHONE: "Please enter a valid phone number",
	VALID_EMAIL: "Please enter a valid email address",
} as const;

/**
 * Validate SSN (9 digits).
 * Accepts formatted (XXX-XX-XXXX) or unformatted (XXXXXXXXX) input.
 * @param value - The SSN value to validate
 * @param errorMessage - Optional custom error message
 */
export const validateSSN = (
	value: string | undefined,
	errorMessage: string = DEFAULT_ERROR_MESSAGES.VALID_SSN,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	// Remove any dashes or spaces for validation
	const cleanValue = value.replace(/[-\s]/g, "");

	// Check if it's exactly 9 digits
	const isValid = VALIDATION_REGEX.SSN.test(cleanValue);
	return isValid || errorMessage;
};

/**
 * Validate phone number using libphonenumber-js.
 * Supports US and Canada formats.
 * @param value - The phone number to validate
 * @param errorMessage - Optional custom error message
 */
export const validatePhoneNumber = (
	value: string | undefined,
	errorMessage: string = DEFAULT_ERROR_MESSAGES.VALID_PHONE,
): boolean | string => {
	if (!value || value.trim() === "" || value === "+1") {
		return true; // Empty is valid (field is optional)
	}

	// Try to validate as US or CA number
	const isValidUS = isPossiblePhoneNumber(value, "US");
	const isValidCA = isPossiblePhoneNumber(value, "CA");
	const isValid = isValidUS || isValidCA;
	return isValid || errorMessage;
};

/**
 * Validate email format.
 * @param value - The email to validate
 * @param errorMessage - Optional custom error message
 */
export const validateEmail = (
	value: string | undefined,
	errorMessage: string = DEFAULT_ERROR_MESSAGES.VALID_EMAIL,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const isValid = VALIDATION_REGEX.EMAIL.test(value);
	return isValid || errorMessage;
};

/**
 * Validate TIN/Tax ID based on country
 * @param value - The TIN value to validate
 * @param countryCode - The country code (e.g., "US", "CA")
 * @returns Error message if invalid, null if valid
 */
export const validateTin = (
	value: string,
	countryCode: string,
): string | null => {
	if (!value || value === VALUE_NOT_AVAILABLE) {
		return null; // Empty is valid (will be saved as null)
	}

	const trimmedValue = value.trim();
	const isUS = isUSCountry(countryCode);

	if (isUS) {
		// US: Must be exactly 9 digits
		const digitsOnly = trimmedValue.replace(/\D/g, "");
		if (digitsOnly.length !== 9) {
			return "US Tax ID must be exactly 9 digits";
		}
	} else {
		// International: 1-22 characters
		if (trimmedValue.length < 1 || trimmedValue.length > 22) {
			return "Tax ID must be between 1 and 22 characters";
		}
	}

	return null; // Valid
};

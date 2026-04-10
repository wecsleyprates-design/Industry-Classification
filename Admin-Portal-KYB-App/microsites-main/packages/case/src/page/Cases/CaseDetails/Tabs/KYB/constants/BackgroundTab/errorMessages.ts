/**
 * Error messages for BackgroundTab field validation.
 * Consistent with onboarding flow error messages.
 */
export const ERROR_MESSAGES = {
	// Phone
	VALID_PHONE: "Enter a valid phone number",

	// Email
	VALID_EMAIL: "Enter a valid email address",

	// NPI
	VALID_NPI: "NPI must be exactly 10 digits",

	// NAICS/MCC
	VALID_NAICS: "Invalid NAICS code",
	VALID_MCC: "Invalid MCC code",

	// Number of Employees
	VALID_NUM_EMPLOYEES: "Enter a whole number or range (e.g. 50 or 10-15)",
} as const;

/**
 * Validation error messages for OverviewTab fields.
 * Consistent with onboarding flow error messages.
 */
export const ERROR_MESSAGES = {
	VALID_SSN: "Please enter a valid 9-digit SSN",
	VALID_PHONE: "Please enter a valid phone number",
	VALID_EMAIL: "Please enter a valid email address",
	VALID_OWNERSHIP: "Ownership must be between 0 and 100",
	CUMULATIVE_OWNERSHIP:
		"Total ownership across all owners cannot exceed 100%",
	VALID_DATE: "Please enter a valid date",
} as const;

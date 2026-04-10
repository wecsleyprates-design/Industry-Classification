import type { RegisterOptions } from "react-hook-form";
import { getTaxIdErrorMessage, isValidTaxId } from "@/lib/taxIdLabels";
import type { BusinessRegistrationTabFormValues } from "../../schemas/BusinessRegistrationTab/businessRegistrationTabSchema";

/**
 * Validate TIN based on country code.
 * Uses the same validation logic as onboarding flow.
 */
export const validateTIN = (
	value: string | undefined,
	countryCode: string | undefined | null,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const trimmed = value.trim();
	const isValid = isValidTaxId(trimmed, countryCode);

	if (!isValid) {
		return getTaxIdErrorMessage(countryCode, "valid");
	}

	return true;
};

/**
 * Get validation rules for a specific field.
 * Returns react-hook-form RegisterOptions.
 */
export const getFieldValidationRules = (
	fieldKey: keyof BusinessRegistrationTabFormValues,
	countryCode?: string | null,
): RegisterOptions<BusinessRegistrationTabFormValues> | undefined => {
	switch (fieldKey) {
		case "tin":
			return {
				validate: (value: string | undefined) =>
					validateTIN(value, countryCode),
			};
		default:
			return undefined;
	}
};

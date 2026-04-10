import type { RegisterOptions } from "react-hook-form";
import {
	validateEmail as sharedValidateEmail,
	validatePhoneNumber as sharedValidatePhoneNumber,
	validateSSN as sharedValidateSSN,
} from "../../../../utils/validation";
import { ERROR_MESSAGES } from "../../constants/OverviewTab/errorMessages";
import type { OverviewTabFormValues } from "../../schemas/OverviewTab/overviewTabSchema";

/**
 * Validation rules for OverviewTab fields.
 * Uses react-hook-form's RegisterOptions format.
 * Consistent with onboarding flow validations.
 */

/**
 * Validate SSN (9 digits) with OverviewTab error message.
 */
export const validateSSN = (value: string | undefined): boolean | string =>
	sharedValidateSSN(value, ERROR_MESSAGES.VALID_SSN);

/**
 * Validate phone number with OverviewTab error message.
 */
export const validatePhoneNumber = (
	value: string | undefined,
): boolean | string =>
	sharedValidatePhoneNumber(value, ERROR_MESSAGES.VALID_PHONE);

/**
 * Validate email with OverviewTab error message.
 */
export const validateEmail = (value: string | undefined): boolean | string =>
	sharedValidateEmail(value, ERROR_MESSAGES.VALID_EMAIL);

/**
 * Validate ownership percentage (0-100).
 */
export const validateOwnershipPercentage = (
	value: string | undefined,
): boolean | string => {
	if (!value || value.trim() === "") {
		return true; // Empty is valid (field is optional)
	}

	const num = parseFloat(value);
	if (isNaN(num)) {
		return ERROR_MESSAGES.VALID_OWNERSHIP;
	}

	const isValid = num >= 0 && num <= 100;
	return isValid || ERROR_MESSAGES.VALID_OWNERSHIP;
};

/**
 * Create a cumulative ownership percentage validator.
 * Validates both individual (0-100) and cumulative total across all owners.
 *
 * @param allOwners - Array of all owners with their current ownership percentages
 * @param currentOwnerId - The ID of the owner being edited
 * @returns Validation function for react-hook-form
 */
export const createCumulativeOwnershipValidator = (
	allOwners: Array<{ id: string; ownership_percentage?: number | null }>,
	currentOwnerId: string,
) => {
	return (value: string | undefined): boolean | string => {
		// First run the basic individual validation
		const basicResult = validateOwnershipPercentage(value);
		if (basicResult !== true) {
			return basicResult;
		}

		// If value is empty or no other owners, no cumulative check needed
		if (!value || value.trim() === "" || !allOwners.length) {
			return true;
		}

		const currentValue = parseFloat(value);
		if (isNaN(currentValue)) {
			return true; // Already handled by basic validation
		}

		// Sum ownership percentages from all OTHER owners
		const otherOwnersTotal = allOwners
			.filter((owner) => owner.id !== currentOwnerId)
			.reduce((sum, owner) => {
				const pct = owner.ownership_percentage ?? 0;
				return sum + pct;
			}, 0);

		const cumulativeTotal = otherOwnersTotal + currentValue;
		if (cumulativeTotal > 100) {
			return ERROR_MESSAGES.CUMULATIVE_OWNERSHIP;
		}

		return true;
	};
};

/**
 * Optional context for validation rules that need access to external data.
 */
export interface ValidationContext {
	/** All owners data for cumulative ownership validation */
	allOwners?: Array<{ id: string; ownership_percentage?: number | null }>;
	/** Current owner ID for ownership validation */
	currentOwnerId?: string;
}

/**
 * Get validation rules for a specific field.
 * Returns react-hook-form RegisterOptions.
 *
 * @param fieldKey - The field key to get rules for
 * @param context - Optional context for validators that need external data
 */
export const getFieldValidationRules = (
	fieldKey: keyof OverviewTabFormValues,
	context?: ValidationContext,
): RegisterOptions<OverviewTabFormValues> | undefined => {
	switch (fieldKey) {
		case "ssn":
			return {
				validate: validateSSN,
			};
		case "mobile":
			return {
				validate: validatePhoneNumber,
			};
		case "email":
			return {
				validate: validateEmail,
			};
		case "ownership_percentage": {
			// Use cumulative validator if context is provided
			if (context?.allOwners && context?.currentOwnerId) {
				return {
					validate: createCumulativeOwnershipValidator(
						context.allOwners,
						context.currentOwnerId,
					),
				};
			}
			return {
				validate: validateOwnershipPercentage,
			};
		}
		default:
			return undefined;
	}
};

/**
 * Map of field keys to their validation rules.
 * Can be used to get all validation rules at once.
 */
export const FIELD_VALIDATION_RULES: Partial<
	Record<keyof OverviewTabFormValues, RegisterOptions<OverviewTabFormValues>>
> = {
	ssn: { validate: validateSSN },
	mobile: { validate: validatePhoneNumber },
	email: { validate: validateEmail },
	ownership_percentage: { validate: validateOwnershipPercentage },
};

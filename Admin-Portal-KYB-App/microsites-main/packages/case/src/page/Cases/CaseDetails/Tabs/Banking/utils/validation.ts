import type { RegisterOptions } from "react-hook-form";
import type { ProcessingHistoryFormValues } from "../schemas/processingHistorySchema";

/**
 * Validation rules for Processing History fields
 * Uses react-hook-form's RegisterOptions format.
 */

/**
 * Validates that percentage fields sum to 100% or 0%
 */
export const validatePercentageSum = (
	value: string | string[],
	formValues: ProcessingHistoryFormValues,
): boolean | string => {
	// If value is an array, we can't validate it this way
	if (Array.isArray(value)) {
		return true;
	}
	const swiped = Number(formValues.pos_card_swiped) || 0;
	const typed = Number(formValues.pos_card_typed) || 0;
	const ecommerce = Number(formValues.pos_ecommerce) || 0;
	const mailTelephone = Number(formValues.pos_mail_telephone) || 0;

	const sum = swiped + typed + ecommerce + mailTelephone;

	// Allow sum to be exactly 100% or exactly 0%
	if (sum !== 100 && sum !== 0) {
		return "All Point of Sale Volume fields must sum to 100% or 0%";
	}

	return true;
};

/**
 * Validation rules for currency fields
 */
export const currencyFieldRules: RegisterOptions<
	ProcessingHistoryFormValues,
	keyof ProcessingHistoryFormValues
> = {
	min: {
		value: 0,
		message: "Value must be greater than or equal to 0",
	},
	valueAsNumber: false, // Keep as string for EditableField
};

/**
 * Validation rules for percentage fields
 */
export const percentageFieldRules: RegisterOptions<
	ProcessingHistoryFormValues,
	keyof ProcessingHistoryFormValues
> = {
	min: {
		value: 0,
		message: "Value must be between 0 and 100",
	},
	max: {
		value: 100,
		message: "Value must be between 0 and 100",
	},
	validate: validatePercentageSum,
	valueAsNumber: false, // Keep as string for EditableField
};

/**
 * Validation rules for long text fields
 */
export const longTextFieldRules: RegisterOptions<
	ProcessingHistoryFormValues,
	keyof ProcessingHistoryFormValues
> = {
	maxLength: {
		value: 1000,
		message: "Text must be less than 1000 characters",
	},
};

/**
 * Get validation rules for a specific field
 */
export function getFieldValidationRules(
	fieldKey: keyof ProcessingHistoryFormValues,
): RegisterOptions<
	ProcessingHistoryFormValues,
	keyof ProcessingHistoryFormValues
> {
	// Currency fields
	if (
		fieldKey.includes("annual_volume") ||
		fieldKey.includes("monthly_volume") ||
		fieldKey.includes("average_volume") ||
		fieldKey.includes("high_ticket") ||
		fieldKey.includes("desired_limit")
	) {
		return currencyFieldRules;
	}

	// Percentage fields (Point of Sale)
	if (fieldKey.startsWith("pos_")) {
		return percentageFieldRules;
	}

	// Long text fields
	if (fieldKey.includes("explanation")) {
		return longTextFieldRules;
	}

	// Default: no validation
	return {};
}

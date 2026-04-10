import type { UseMutateAsyncFunction } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
	PatchBusinessFactsOverrideRequestPayload,
	PatchBusinessFactsOverrideResponse,
} from "@/types/case";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export type SaveStatusSetter = (
	fieldKey: string,
	status: "idle" | "saving" | "saved" | "error",
) => void;
export type FieldValidator = (fieldKey: string, value: string) => string | null;

export interface CreateHandleEditCompleteOptions {
	businessId: string;
	patchBusinessFactsOverride: UseMutateAsyncFunction<
		PatchBusinessFactsOverrideResponse,
		unknown,
		PatchBusinessFactsOverrideRequestPayload,
		unknown
	>;
	setSaveStatus: SaveStatusSetter;
	setLastAutoSavedAt: (date: Date) => void;
	setShowAutoSaveToast: (show: boolean) => void;
	fieldValidators?: Record<string, FieldValidator>;
	convertToApiValue?: (fieldKey: string, displayValue: string) => any;
}

/**
 * Fields that expect boolean values in the API across all tabs.
 * These fields display "Yes"/"No"/"N/A" in the UI but are stored as boolean/null in the API.
 *
 * Note: If other tabs have additional boolean fields, they can either:
 * 1. Extend this array, or
 * 2. Pass a custom `convertToApiValue` function to `createHandleEditComplete`
 */
export const KYB_BOOLEAN_FIELDS = [
	"minority_owned",
	"woman_owned",
	"veteran_owned",
];

/**
 * Fields that expect array of strings values in the API.
 */
export const STRING_ARRAY_FIELDS = ["dba"];

/**
 * Convert display string to API value (handles boolean and string array fields)
 *
 * This is the default converter used by `createHandleEditComplete`. It handles:
 * - Boolean fields: Converts "Yes"/"No"/"N/A" to true/false/null
 * - String array fields: Converts comma-separated string to array of strings
 * - Other fields: Returns the value as-is
 *
 * @param fieldKey - The field key being edited
 * @param displayValue - The display value from the UI
 * @returns The value to send to the API (string, boolean, string[], or null)
 *
 * @example
 * ```ts
 * // For boolean fields
 * convertToApiValue("minority_owned", "Yes") // returns true
 * convertToApiValue("minority_owned", "No") // returns false
 * convertToApiValue("minority_owned", "N/A") // returns null
 *
 * // For regular fields
 * convertToApiValue("business_name", "Acme Corp") // returns "Acme Corp"
 * ```
 */
export const convertToApiValue = (
	fieldKey: string,
	displayValue: string,
): string | boolean | string[] | null => {
	if (KYB_BOOLEAN_FIELDS.includes(fieldKey)) {
		// Convert Yes/No/N/A to boolean/null for API
		if (displayValue === "Yes") return true;
		if (displayValue === "No") return false;
		// N/A, VALUE_NOT_AVAILABLE, or empty should be null
		if (
			displayValue === "N/A" ||
			displayValue === VALUE_NOT_AVAILABLE ||
			displayValue === ""
		)
			return null;
		return null; // Default to null for any other value
	}

	// String array fields: wrap single value in array
	if (STRING_ARRAY_FIELDS.includes(fieldKey)) {
		// Empty or N/A values return empty array
		if (
			displayValue === "" ||
			displayValue === "N/A" ||
			displayValue === VALUE_NOT_AVAILABLE
		) {
			return [];
		}
		// Wrap single value in array
		const trimmed = displayValue.trim();
		return trimmed.length > 0 ? [trimmed] : [];
	}

	return displayValue;
};

/**
 * Normalize a value for comparison (converts VALUE_NOT_AVAILABLE and empty strings to empty string)
 */
export const normalizeValue = (value: string): string => {
	return value === VALUE_NOT_AVAILABLE || value === "" ? "" : value;
};

/**
 * Create a handleEditComplete callback function for inline editing
 *
 * This helper can be used across all tabs that need inline editing functionality.
 * It handles validation, value conversion, API calls, and status updates.
 *
 * @param options - Configuration options for the handler
 * @returns A callback function to handle edit completion
 *
 * @example
 * ```ts
 * const handleEditComplete = useCallback(
 *   createHandleEditComplete({
 *     businessId,
 *     patchBusinessFactsOverride,
 *     setSaveStatus,
 *     setLastAutoSavedAt,
 *     setShowAutoSaveToast,
 *     fieldValidators: {
 *       tin: validateTin,
 *     },
 *   }),
 *   [businessId, patchBusinessFactsOverride, setSaveStatus, setLastAutoSavedAt, setShowAutoSaveToast, validateTin]
 * );
 * ```
 */
export const createHandleEditComplete = (
	options: CreateHandleEditCompleteOptions,
) => {
	const {
		businessId,
		patchBusinessFactsOverride,
		setSaveStatus,
		setLastAutoSavedAt,
		setShowAutoSaveToast,
		fieldValidators = {},
		convertToApiValue: customConvertToApiValue = convertToApiValue,
	} = options;

	return async (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => {
		// Don't save if businessId is not available
		if (!businessId || businessId === VALUE_NOT_AVAILABLE) {
			return;
		}

		// Run field-specific validation if provided
		const validator = fieldValidators[fieldKey];
		if (validator) {
			const validationError = validator(fieldKey, newValue);
			if (validationError) {
				setSaveStatus(fieldKey, "error");
				toast.error(validationError);
				return;
			}
		}

		// Normalize empty values and VALUE_NOT_AVAILABLE to compare properly
		const normalizedOriginal = normalizeValue(originalValue);
		const normalizedNew = normalizeValue(newValue);

		// Don't save if value hasn't actually changed
		if (normalizedOriginal === normalizedNew) {
			return;
		}

		// Set status to saving
		setSaveStatus(fieldKey, "saving");

		// Convert the value to the correct type for the API
		const apiValue = customConvertToApiValue(fieldKey, normalizedNew);

		// Convert empty string to null for API (unless it's already been converted by convertToApiValue)
		const finalApiValue = apiValue === "" ? null : apiValue;

		// Use async/await pattern to ensure callbacks run
		try {
			await patchBusinessFactsOverride({
				businessId,
				overrides: {
					[fieldKey]: {
						value: finalApiValue,
						comment: `Changed from "${originalValue}" to "${newValue}"`,
					},
				},
			});
			setSaveStatus(fieldKey, "saved");
			setLastAutoSavedAt(new Date());
			setShowAutoSaveToast(true);
		} catch (error) {
			// Error is handled by setting status to "error"
			setSaveStatus(fieldKey, "error");
		}
	};
};

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import {
	type BusinessRegistrationTabFieldKey,
	type BusinessRegistrationTabFormValues,
	defaultBusinessRegistrationTabValues,
} from "../../schemas/BusinessRegistrationTab/businessRegistrationTabSchema";

import { VALUE_NOT_AVAILABLE } from "@/constants";

interface UseBusinessRegistrationTabFormParams {
	/** Original values from the data sources */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseBusinessRegistrationTabFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<BusinessRegistrationTabFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: BusinessRegistrationTabFieldKey) => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: BusinessRegistrationTabFieldKey) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: BusinessRegistrationTabFieldKey) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: BusinessRegistrationTabFieldKey[];
}

/**
 * Map from original values object keys to form field keys.
 * This handles the naming differences between the data layer and form schema.
 */
const ORIGINAL_VALUE_TO_FORM_KEY: Record<
	string,
	BusinessRegistrationTabFieldKey
> = {
	businessName: "business_name",
	tin: "tin",
};

/**
 * Convert original values object to form values.
 */
function mapOriginalValuesToFormValues(
	originalValues: Record<string, string>,
): BusinessRegistrationTabFormValues {
	const formValues = { ...defaultBusinessRegistrationTabValues };

	for (const [originalKey, formKey] of Object.entries(
		ORIGINAL_VALUE_TO_FORM_KEY,
	)) {
		const value = originalValues[originalKey];
		if (value !== undefined && value !== VALUE_NOT_AVAILABLE) {
			formValues[formKey] = value;
		}
	}

	return formValues;
}

/**
 * Hook that manages react-hook-form state for the BusinessRegistrationTab.
 *
 * Features:
 * - Initializes form with data from useBusinessRegistrationTabData
 * - Syncs form values when data loads
 * - Tracks dirty state per field
 * - Provides utilities for field-level operations
 */
export function useBusinessRegistrationTabForm({
	originalValues,
	isLoading,
}: UseBusinessRegistrationTabFormParams): UseBusinessRegistrationTabFormReturn {
	const hasInitialized = useRef(false);

	// Convert original values to form-compatible format
	const formDefaultValues = useMemo(
		() => mapOriginalValuesToFormValues(originalValues),
		[originalValues],
	);

	// Initialize react-hook-form (no resolver needed for simple string fields)
	const form = useForm<BusinessRegistrationTabFormValues>({
		defaultValues: defaultBusinessRegistrationTabValues,
		mode: "onBlur",
	});

	const { formState, reset, watch } = form;

	// Watch all form values to detect changes in real-time
	const currentFormValues = watch();

	// Sync form values when data loads (only once after initial load)
	useEffect(() => {
		if (!isLoading && !hasInitialized.current) {
			reset(formDefaultValues, {
				keepDirty: false,
				keepDirtyValues: false,
			});
			hasInitialized.current = true;
		}
	}, [isLoading, formDefaultValues, reset]);

	// Reset the initialized flag if we need to reload data
	useEffect(() => {
		if (isLoading) {
			hasInitialized.current = false;
		}
	}, [isLoading]);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: BusinessRegistrationTabFieldKey): string => {
			// Find the original key that maps to this form key
			const originalKey = Object.entries(ORIGINAL_VALUE_TO_FORM_KEY).find(
				([, formKey]) => formKey === fieldKey,
			)?.[0];

			if (originalKey) {
				return originalValues[originalKey] || "";
			}
			return "";
		},
		[originalValues],
	);

	// Check if a specific field is dirty
	// A field is dirty if it's marked as dirty by react-hook-form OR if its current value differs from the original
	const isFieldDirty = useCallback(
		(fieldKey: BusinessRegistrationTabFieldKey): boolean => {
			// Check react-hook-form's dirty state
			if (formState.dirtyFields[fieldKey]) {
				return true;
			}

			// Also check if current value differs from original value
			const currentValue = currentFormValues[fieldKey] ?? "";
			const originalValue = getOriginalValue(fieldKey);
			return currentValue !== originalValue;
		},
		[formState.dirtyFields, currentFormValues, getOriginalValue],
	);

	// Handle field blur - stub for potential future save logic
	const handleFieldBlur = useCallback(
		(_fieldKey: BusinessRegistrationTabFieldKey) => {
			// Can be extended to trigger saves or validation
		},
		[],
	);

	// Get array of dirty field keys
	// A field is dirty if it's marked as dirty by react-hook-form OR if its current value differs from the original
	const dirtyFieldKeys = useMemo(() => {
		const dirtyKeys: BusinessRegistrationTabFieldKey[] = [];

		// Check all form fields
		(
			Object.keys(formDefaultValues) as BusinessRegistrationTabFieldKey[]
		).forEach((fieldKey) => {
			// Check react-hook-form's dirty state
			if (formState.dirtyFields[fieldKey]) {
				dirtyKeys.push(fieldKey);
				return;
			}

			// Also check if current value differs from original value
			const currentValue = currentFormValues[fieldKey] ?? "";
			const originalKey = Object.entries(ORIGINAL_VALUE_TO_FORM_KEY).find(
				([, formKey]) => formKey === fieldKey,
			)?.[0];
			const originalValue =
				originalKey &&
				originalValues[originalKey] &&
				originalValues[originalKey] !== VALUE_NOT_AVAILABLE
					? originalValues[originalKey]
					: "";

			if (currentValue !== originalValue) {
				dirtyKeys.push(fieldKey);
			}
		});

		return dirtyKeys;
	}, [
		formState.dirtyFields,
		currentFormValues,
		formDefaultValues,
		originalValues,
	]);

	return {
		form,
		isFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	};
}

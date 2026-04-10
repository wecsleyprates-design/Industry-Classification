import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type DefaultValues,
	type FieldValues,
	useForm,
	type UseFormReturn,
} from "react-hook-form";

import { VALUE_NOT_AVAILABLE } from "@/constants";

/**
 * Parameters for the generic tab form hook.
 */
interface UseTabFormParams<TFormValues extends FieldValues> {
	/** Original values from the data sources (keyed by original field names) */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
	/** Default form values */
	defaultValues: DefaultValues<TFormValues>;
	/** Map from original value keys to form field keys */
	originalToFormKeyMap: Record<string, keyof TFormValues>;
	/** Whether to track dirty fields with explicit state (for proxy issues) */
	trackDirtyExplicitly?: boolean;
}

/**
 * Return type for the generic tab form hook.
 */
interface UseTabFormReturn<TFormValues extends FieldValues> {
	/** The react-hook-form instance */
	form: UseFormReturn<TFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: keyof TFormValues) => boolean;
	/** Check if any field is dirty */
	isAnyFieldDirty: () => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: keyof TFormValues) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: keyof TFormValues) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: Array<keyof TFormValues>;
}

/**
 * Convert original values object to form values using the provided mapping.
 */
function mapOriginalValuesToFormValues<TFormValues extends FieldValues>(
	originalValues: Record<string, string>,
	defaultValues: DefaultValues<TFormValues>,
	keyMap: Record<string, keyof TFormValues>,
): TFormValues {
	const formValues = { ...defaultValues } as TFormValues;

	for (const [originalKey, formKey] of Object.entries(keyMap)) {
		const value = originalValues[originalKey];
		if (value !== undefined && value !== VALUE_NOT_AVAILABLE) {
			(formValues as Record<string, unknown>)[formKey as string] = value;
		}
	}

	return formValues;
}

/**
 * Factory function to create a generic form hook for any tab.
 *
 * This reduces duplication between useOverviewTabForm, useBackgroundTabForm,
 * and similar hooks by extracting the common patterns:
 * - Form initialization with react-hook-form
 * - Syncing form values when data loads
 * - Dirty state tracking
 * - Original value lookup
 *
 * @example
 * ```tsx
 * // In useOverviewTabForm.ts
 * export function useOverviewTabForm(params: UseOverviewTabFormParams) {
 *   return useTabFormFactory<OverviewTabFormValues>({
 *     originalValues: params.originalValues,
 *     isLoading: params.isLoading,
 *     defaultValues: defaultOverviewTabValues,
 *     originalToFormKeyMap: ORIGINAL_VALUE_TO_FORM_KEY,
 *     trackDirtyExplicitly: true,
 *   });
 * }
 * ```
 */
export function useTabFormFactory<TFormValues extends FieldValues>({
	originalValues,
	isLoading,
	defaultValues,
	originalToFormKeyMap,
	trackDirtyExplicitly = false,
}: UseTabFormParams<TFormValues>): UseTabFormReturn<TFormValues> {
	const hasInitialized = useRef(false);

	// Convert original values to form-compatible format
	const formDefaultValues = useMemo(
		() =>
			mapOriginalValuesToFormValues(
				originalValues,
				defaultValues,
				originalToFormKeyMap,
			),
		[originalValues, defaultValues, originalToFormKeyMap],
	);

	// Initialize react-hook-form
	const form = useForm<TFormValues>({
		defaultValues,
		mode: "onBlur",
	});

	const { formState, reset } = form;

	// Optional: Track dirty fields explicitly for components that need it
	// (react-hook-form's formState.dirtyFields uses a proxy that may not
	// trigger React's dependency detection properly in some cases)
	const [dirtyFieldsSnapshot, setDirtyFieldsSnapshot] = useState<
		Record<string, boolean>
	>({});

	// Update dirty fields snapshot when formState.dirtyFields changes
	useEffect(() => {
		if (trackDirtyExplicitly) {
			const currentDirtyFields = { ...formState.dirtyFields };
			setDirtyFieldsSnapshot(
				currentDirtyFields as Record<string, boolean>,
			);
		}
	}, [formState.dirtyFields, trackDirtyExplicitly]);

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

	// Check if a specific field is dirty
	const isFieldDirty = useCallback(
		(fieldKey: keyof TFormValues): boolean => {
			if (trackDirtyExplicitly) {
				return Boolean(dirtyFieldsSnapshot[fieldKey as string]);
			}
			return Boolean(
				(formState.dirtyFields as Record<string, boolean>)[
					fieldKey as string
				],
			);
		},
		[formState.dirtyFields, dirtyFieldsSnapshot, trackDirtyExplicitly],
	);

	// Check if any field is dirty
	const isAnyFieldDirty = useCallback((): boolean => {
		if (trackDirtyExplicitly) {
			return Object.keys(dirtyFieldsSnapshot).length > 0;
		}
		return Object.keys(formState.dirtyFields).length > 0;
	}, [formState.dirtyFields, dirtyFieldsSnapshot, trackDirtyExplicitly]);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: keyof TFormValues): string => {
			// Find the original key that maps to this form key
			const originalKey = Object.entries(originalToFormKeyMap).find(
				([, formKey]) => formKey === fieldKey,
			)?.[0];

			if (originalKey) {
				return originalValues[originalKey] || "";
			}
			return "";
		},
		[originalValues, originalToFormKeyMap],
	);

	// Handle field blur - stub for potential future save logic
	const handleFieldBlur = useCallback((_fieldKey: keyof TFormValues) => {
		// Can be extended to trigger saves or validation
	}, []);

	// Get array of dirty field keys
	const dirtyFieldKeys = useMemo(() => {
		if (trackDirtyExplicitly) {
			return Object.keys(dirtyFieldsSnapshot) as Array<keyof TFormValues>;
		}
		return Object.keys(formState.dirtyFields) as Array<keyof TFormValues>;
	}, [formState.dirtyFields, dirtyFieldsSnapshot, trackDirtyExplicitly]);

	return {
		form,
		isFieldDirty,
		isAnyFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	};
}

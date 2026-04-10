import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import {
	defaultPublicFilingsTabValues,
	type PublicFilingsTabFieldKey,
	type PublicFilingsTabFormValues,
} from "../../schemas/PublicFilingsTab/publicFilingsTabSchema";

import { VALUE_NOT_AVAILABLE } from "@/constants";

interface UsePublicFilingsTabFormParams {
	/** Original values from the data sources */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UsePublicFilingsTabFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<PublicFilingsTabFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: PublicFilingsTabFieldKey) => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: PublicFilingsTabFieldKey) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: PublicFilingsTabFieldKey) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: PublicFilingsTabFieldKey[];
}

/**
 * Map from original values object keys to form field keys.
 * This handles the naming differences between the data layer and form schema.
 */
const ORIGINAL_VALUE_TO_FORM_KEY: Record<string, PublicFilingsTabFieldKey> = {
	// Judgements
	numJudgements: "num_judgements",
	judgementsMostRecent: "judgements_most_recent",
	judgementsMostRecentStatus: "judgements_most_recent_status",
	judgementsMostRecentAmount: "judgements_most_recent_amount",
	judgementsTotalAmount: "judgements_total_amount",
	// Liens
	numLiens: "num_liens",
	liensMostRecent: "liens_most_recent",
	liensMostRecentStatus: "liens_most_recent_status",
	liensMostRecentAmount: "liens_most_recent_amount",
	liensTotalAmount: "liens_total_amount",
	// Bankruptcies
	numBankruptcies: "num_bankruptcies",
	bankruptciesMostRecent: "bankruptcies_most_recent",
	bankruptciesMostRecentStatus: "bankruptcies_most_recent_status",
};

/**
 * Convert original values object to form values.
 */
function mapOriginalValuesToFormValues(
	originalValues: Record<string, string>,
): PublicFilingsTabFormValues {
	const formValues = { ...defaultPublicFilingsTabValues };

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
 * Hook that manages react-hook-form state for the PublicFilingsTab.
 *
 * Features:
 * - Initializes form with data from usePublicFilingsTabData
 * - Syncs form values when data loads
 * - Tracks dirty state per field
 * - Provides utilities for field-level operations
 *
 * @example
 * ```tsx
 * const { form, isFieldDirty, handleFieldBlur } = usePublicFilingsTabForm({
 *   originalValues,
 *   isLoading: loadingStates.bjl,
 * });
 *
 * // Wrap component with FormProvider
 * <FormProvider {...form}>
 *   <EditableField name="num_judgements" ... />
 * </FormProvider>
 * ```
 */
export function usePublicFilingsTabForm({
	originalValues,
	isLoading,
}: UsePublicFilingsTabFormParams): UsePublicFilingsTabFormReturn {
	const hasInitialized = useRef(false);

	// Convert original values to form-compatible format
	const formDefaultValues = useMemo(
		() => mapOriginalValuesToFormValues(originalValues),
		[originalValues],
	);

	// Initialize react-hook-form (no resolver needed for simple string fields)
	const form = useForm<PublicFilingsTabFormValues>({
		defaultValues: defaultPublicFilingsTabValues,
		mode: "onBlur",
	});

	const { formState, reset } = form;

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
		(fieldKey: PublicFilingsTabFieldKey): boolean => {
			return Boolean(formState.dirtyFields[fieldKey]);
		},
		[formState.dirtyFields],
	);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: PublicFilingsTabFieldKey): string => {
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

	// Handle field blur - stub for potential future save logic
	const handleFieldBlur = useCallback(
		(_fieldKey: PublicFilingsTabFieldKey) => {
			// Can be extended to trigger saves or validation
		},
		[],
	);

	// Get array of dirty field keys
	const dirtyFieldKeys = useMemo(
		() => Object.keys(formState.dirtyFields) as PublicFilingsTabFieldKey[],
		[formState.dirtyFields],
	);

	return {
		form,
		isFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	};
}

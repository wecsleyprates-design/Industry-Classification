import { useCallback } from "react";
import { type UseFormReturn } from "react-hook-form";
import { useTabFormFactory } from "../../../../hooks/useTabFormFactory";
import {
	defaultOverviewTabValues,
	type OverviewTabFieldKey,
	type OverviewTabFormValues,
} from "../../schemas/OverviewTab/overviewTabSchema";

interface UseOverviewTabFormParams {
	/** Original values from the data sources */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseOverviewTabFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<OverviewTabFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: OverviewTabFieldKey) => boolean;
	/** Check if any field is dirty */
	isAnyFieldDirty: () => boolean;
	/** Check if email field specifically is dirty */
	isEmailDirty: () => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: OverviewTabFieldKey) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: OverviewTabFieldKey) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: OverviewTabFieldKey[];
}

/**
 * Map from original values object keys to form field keys.
 * This handles the naming differences between the data layer and form schema.
 */
const ORIGINAL_VALUE_TO_FORM_KEY: Record<string, OverviewTabFieldKey> = {
	firstName: "first_name",
	lastName: "last_name",
	dateOfBirth: "date_of_birth",
	ssn: "ssn",
	homeAddress: "home_address",
	mobile: "mobile",
	email: "email",
	title: "title",
	ownershipPercentage: "ownership_percentage",
};

/**
 * Hook that manages react-hook-form state for the OverviewTab.
 *
 * Features:
 * - Initializes form with data from useOverviewTabData
 * - Syncs form values when data loads
 * - Tracks dirty state per field
 * - Provides utilities for field-level operations
 *
 * Uses the shared useTabFormFactory for common form logic.
 *
 * @example
 * ```tsx
 * const { form, isFieldDirty, isAnyFieldDirty } = useOverviewTabForm({
 *   originalValues,
 *   isLoading: loadingStates.owner,
 * });
 *
 * // Wrap component with FormProvider
 * <FormProvider {...form}>
 *   <EditableField name="first_name" ... />
 * </FormProvider>
 * ```
 */
export function useOverviewTabForm({
	originalValues,
	isLoading,
}: UseOverviewTabFormParams): UseOverviewTabFormReturn {
	// Use the shared form factory for common logic
	const {
		form,
		isFieldDirty,
		isAnyFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	} = useTabFormFactory<OverviewTabFormValues>({
		originalValues,
		isLoading,
		defaultValues: defaultOverviewTabValues,
		originalToFormKeyMap: ORIGINAL_VALUE_TO_FORM_KEY,
		trackDirtyExplicitly: true, // KYC needs explicit tracking for proxy issues
	});

	// KYC-specific: Check if email field specifically is dirty
	const isEmailDirty = useCallback((): boolean => {
		return isFieldDirty("email");
	}, [isFieldDirty]);

	return {
		form,
		isFieldDirty,
		isAnyFieldDirty,
		isEmailDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	};
}

import { type UseFormReturn } from "react-hook-form";
import { useTabFormFactory } from "../../../../hooks/useTabFormFactory";
import {
	type BackgroundTabFieldKey,
	type BackgroundTabFormValues,
	defaultBackgroundTabValues,
} from "../../schemas/BackgroundTab/backgroundTabSchema";

interface UseBackgroundTabFormParams {
	/** Original values from the data sources */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseBackgroundTabFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<BackgroundTabFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: BackgroundTabFieldKey) => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: BackgroundTabFieldKey) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: BackgroundTabFieldKey) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: BackgroundTabFieldKey[];
}

/**
 * Map from original values object keys to form field keys.
 * This handles the naming differences between the data layer and form schema.
 */
const ORIGINAL_VALUE_TO_FORM_KEY: Record<string, BackgroundTabFieldKey> = {
	businessName: "business_name",
	legalName: "legal_name",
	dba: "dba",
	businessAddress: "primary_address",
	mailingAddress: "mailing_address",
	formationDate: "formation_date",
	annualRevenue: "revenue",
	netIncome: "net_income",
	corporationType: "corporation",
	numEmployees: "num_employees",
	phoneNumber: "business_phone",
	businessEmail: "email",
	minorityOwned: "minority_owned",
	womanOwned: "woman_owned",
	veteranOwned: "veteran_owned",
	industryName: "industry",
	naicsCode: "naics_code",
	mccCode: "mcc_code",
	npiNumber: "npi_number",
};

/**
 * Hook that manages react-hook-form state for the BackgroundTab.
 *
 * Features:
 * - Initializes form with data from useBackgroundTabData
 * - Syncs form values when data loads
 * - Tracks dirty state per field
 * - Provides utilities for field-level operations
 *
 * Uses the shared useTabFormFactory for common form logic.
 *
 * @example
 * ```tsx
 * const { form, isFieldDirty, handleFieldBlur } = useBackgroundTabForm({
 *   originalValues,
 *   isLoading: loadingStates.businessDetails,
 * });
 *
 * // Wrap component with FormProvider
 * <FormProvider {...form}>
 *   <EditableField name="business_name" ... />
 * </FormProvider>
 * ```
 */
export function useBackgroundTabForm({
	originalValues,
	isLoading,
}: UseBackgroundTabFormParams): UseBackgroundTabFormReturn {
	// Use the shared form factory for common logic
	const {
		form,
		isFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	} = useTabFormFactory<BackgroundTabFormValues>({
		originalValues,
		isLoading,
		defaultValues: defaultBackgroundTabValues,
		originalToFormKeyMap: ORIGINAL_VALUE_TO_FORM_KEY,
		trackDirtyExplicitly: false, // KYB doesn't need explicit tracking
	});

	return {
		form,
		isFieldDirty,
		getOriginalValue,
		handleFieldBlur,
		dirtyFieldKeys,
	};
}

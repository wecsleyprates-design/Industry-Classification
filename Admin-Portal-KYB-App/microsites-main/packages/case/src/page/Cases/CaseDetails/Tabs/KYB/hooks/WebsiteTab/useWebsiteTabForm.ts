import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import {
	defaultWebsiteTabValues,
	type WebsiteTabFieldKey,
	type WebsiteTabFormValues,
} from "../../schemas/WebsiteTab/websiteTabSchema";

import { VALUE_NOT_AVAILABLE } from "@/constants";

interface UseWebsiteTabFormParams {
	/** Original values from the data sources */
	originalValues: Record<string, string>;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseWebsiteTabFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<WebsiteTabFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: WebsiteTabFieldKey) => boolean;
	/** Get the original value for a field (for comparison/display) */
	getOriginalValue: (fieldKey: WebsiteTabFieldKey) => string;
	/** Handle field blur - called when user finishes editing a field */
	handleFieldBlur: (fieldKey: WebsiteTabFieldKey) => void;
	/** Get dirty fields as an array of field keys */
	dirtyFieldKeys: WebsiteTabFieldKey[];
}

/**
 * Map from original values object keys to form field keys.
 */
const ORIGINAL_VALUE_TO_FORM_KEY: Record<string, WebsiteTabFieldKey> = {
	website: "website",
};

/**
 * Convert original values object to form values.
 */
function mapOriginalValuesToFormValues(
	originalValues: Record<string, string>,
): WebsiteTabFormValues {
	const formValues = { ...defaultWebsiteTabValues };

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
 * Hook that manages react-hook-form state for the WebsiteTab.
 */
export function useWebsiteTabForm({
	originalValues,
	isLoading,
}: UseWebsiteTabFormParams): UseWebsiteTabFormReturn {
	const hasInitialized = useRef(false);

	// Convert original values to form-compatible format
	const formDefaultValues = useMemo(
		() => mapOriginalValuesToFormValues(originalValues),
		[originalValues],
	);

	// Initialize react-hook-form
	const form = useForm<WebsiteTabFormValues>({
		defaultValues: defaultWebsiteTabValues,
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
		(fieldKey: WebsiteTabFieldKey): boolean => {
			return Boolean(formState.dirtyFields[fieldKey]);
		},
		[formState.dirtyFields],
	);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: WebsiteTabFieldKey): string => {
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
	const handleFieldBlur = useCallback((_fieldKey: WebsiteTabFieldKey) => {
		// Can be extended to trigger saves or validation
	}, []);

	// Get array of dirty field keys
	const dirtyFieldKeys = useMemo(
		() => Object.keys(formState.dirtyFields) as WebsiteTabFieldKey[],
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

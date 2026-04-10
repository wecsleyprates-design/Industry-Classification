import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useUpdateCustomFields } from "@/services/queries/case.query";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import type { CustomField } from "@/types/case";

import { VALUE_NOT_AVAILABLE } from "@/constants";

/** Form field key type for custom fields - uses the field ID */
export type CustomFieldKey = string;

/** Form values type - maps field IDs to their string values */
export type CustomFieldsFormValues = Record<CustomFieldKey, string>;

interface UseCustomFieldsFormParams {
	/** Original custom fields data */
	customFields: CustomField[];
	/** Business ID */
	businessId: string;
	/** Case ID */
	caseId: string;
	/** Template ID for custom fields */
	templateId: string;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseCustomFieldsFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<CustomFieldsFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: CustomFieldKey) => boolean;
	/** Get the original value for a field */
	getOriginalValue: (fieldKey: CustomFieldKey) => string;
	/** Get save status for a field */
	getSaveStatus: (
		fieldKey: CustomFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	/** Handle field edit complete */
	handleEditComplete: (
		fieldKey: CustomFieldKey,
		originalValue: string,
		newValue: string,
	) => Promise<void>;
}

/**
 * Convert a CustomField value to a string for form state
 */
function customFieldValueToString(field: CustomField): string {
	if (field.value === null || field.value === undefined) {
		return "";
	}

	// Handle boolean fields
	if (field.property === "boolean") {
		return field.value === "true" || field.value === "Yes" ? "Yes" : "No";
	}

	// Handle checkbox fields (stored as JSON)
	if (field.property === "checkbox") {
		if (typeof field.value === "string") {
			return field.value;
		}
		if (Array.isArray(field.value)) {
			return JSON.stringify(field.value);
		}
	}

	// Handle upload fields (array of signed URLs)
	if (field.property === "upload") {
		if (Array.isArray(field.value)) {
			return JSON.stringify(field.value);
		}
		return field.value ? String(field.value) : "";
	}

	// Handle arrays (dropdown multi-select, etc.)
	if (Array.isArray(field.value)) {
		return String(field.value[0] ?? "");
	}

	// Handle object values
	if (typeof field.value === "object" && field.value !== null) {
		if ("value" in (field.value as Record<string, unknown>)) {
			return String((field.value as Record<string, unknown>).value ?? "");
		}
	}

	return String(field.value);
}

/**
 * Convert form values to API format based on field type
 */
function formValueToApiValue(
	value: string,
	fieldType: CustomField["property"],
): string | number | boolean | null {
	if (value === "" || value === VALUE_NOT_AVAILABLE) {
		return null;
	}

	switch (fieldType) {
		case "integer":
			return parseInt(value, 10) || 0;
		case "decimal":
			return parseFloat(value) || 0;
		case "boolean":
			return value === "Yes" || value === "true";
		case "text":
		case "full_text":
		case "alphanumeric":
		case "dropdown":
		case "checkbox":
		case "upload":
		case "phone_number":
		case "email":
		case "date":
		default:
			return value;
	}
}

/**
 * Map custom fields to form default values
 */
function mapCustomFieldsToFormValues(
	customFields: CustomField[],
): CustomFieldsFormValues {
	return customFields.reduce<CustomFieldsFormValues>((acc, field) => {
		acc[field.id] = customFieldValueToString(field);
		return acc;
	}, {});
}

/**
 * Hook for managing custom fields inline editing form state.
 * Similar to useProcessingHistoryForm but for custom fields.
 */
export function useCustomFieldsForm({
	customFields,
	businessId,
	caseId,
	templateId,
	isLoading,
}: UseCustomFieldsFormParams): UseCustomFieldsFormReturn {
	const hasInitialized = useRef(false);
	const saveStatusRef = useRef<
		Record<CustomFieldKey, "idle" | "saving" | "saved" | "error">
	>({});
	const customFieldsMapRef = useRef<Map<string, CustomField>>(new Map());

	const { setLastAutoSavedAt, setShowAutoSaveToast } =
		useInlineEditStore(caseId);

	// Build a map of field ID to field for quick lookup
	useEffect(() => {
		const map = new Map<string, CustomField>();
		customFields.forEach((field) => {
			map.set(field.id, field);
		});
		customFieldsMapRef.current = map;
	}, [customFields]);

	// Convert custom fields to form default values
	const formDefaultValues = useMemo(
		() => mapCustomFieldsToFormValues(customFields),
		[customFields],
	);

	// Initialize react-hook-form
	const form = useForm<CustomFieldsFormValues>({
		defaultValues: {},
		mode: "onBlur",
	});

	const { formState, reset } = form;

	// Mutation for updating custom fields
	const { mutateAsync: updateCustomFields } = useUpdateCustomFields();

	// Sync form values when data loads
	useEffect(() => {
		if (!isLoading && !hasInitialized.current && customFields.length > 0) {
			reset(formDefaultValues, {
				keepDirty: false,
				keepDirtyValues: false,
			});
			hasInitialized.current = true;
		}
	}, [isLoading, formDefaultValues, reset, customFields.length]);

	// Reset the initialized flag if we need to reload data
	useEffect(() => {
		if (isLoading) {
			hasInitialized.current = false;
		}
	}, [isLoading]);

	// Check if a specific field is dirty
	const isFieldDirty = useCallback(
		(fieldKey: CustomFieldKey): boolean => {
			return Boolean(
				formState.dirtyFields[fieldKey as keyof CustomFieldsFormValues],
			);
		},
		[formState.dirtyFields],
	);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: CustomFieldKey): string => {
			return formDefaultValues[fieldKey] ?? "";
		},
		[formDefaultValues],
	);

	// Get save status for a field
	const getSaveStatus = useCallback(
		(fieldKey: CustomFieldKey): "idle" | "saving" | "saved" | "error" => {
			return saveStatusRef.current[fieldKey] ?? "idle";
		},
		[],
	);

	// Handle field edit complete - saves the field change
	const handleEditComplete = useCallback(
		async (
			fieldKey: CustomFieldKey,
			originalValue: string,
			newValue: string,
		) => {
			if (!businessId || !templateId) {
				return;
			}

			const normalizedOriginal =
				originalValue === VALUE_NOT_AVAILABLE || originalValue === ""
					? ""
					: originalValue;
			const normalizedNew =
				newValue === VALUE_NOT_AVAILABLE || newValue === ""
					? ""
					: newValue;

			if (normalizedOriginal === normalizedNew) {
				return;
			}

			const field = customFieldsMapRef.current.get(fieldKey);
			if (!field) {
				return;
			}

			saveStatusRef.current[fieldKey] = "saving";

			const apiValue = formValueToApiValue(newValue, field.property);

			try {
				await updateCustomFields({
					businessId,
					overrides: {
						[fieldKey]: {
							value: apiValue,
							comment: `Changed ${field.label} from "${originalValue}" to "${newValue}"`,
						},
					},
				});
				saveStatusRef.current[fieldKey] = "saved";
				setLastAutoSavedAt(new Date());
				setShowAutoSaveToast(true);
			} catch (error) {
				saveStatusRef.current[fieldKey] = "error";
			}
		},
		[
			businessId,
			updateCustomFields,
			setLastAutoSavedAt,
			setShowAutoSaveToast,
		],
	);

	return {
		form,
		isFieldDirty,
		getOriginalValue,
		getSaveStatus,
		handleEditComplete,
	};
}

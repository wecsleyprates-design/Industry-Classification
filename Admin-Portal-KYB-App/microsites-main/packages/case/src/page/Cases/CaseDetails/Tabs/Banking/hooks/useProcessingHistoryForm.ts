import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { ProcessingHistoryData } from "@/types/integrations";
import {
	defaultProcessingHistoryValues,
	mapProcessingHistoryToFormValues,
	type ProcessingHistoryFieldKey,
	type ProcessingHistoryFormValues,
} from "../schemas/processingHistorySchema";
import {
	extractValuesFromFacts,
	useProcessingHistoryEditState,
} from "./useProcessingHistoryEditState";

import { VALUE_NOT_AVAILABLE } from "@/constants/ValueConstants";

interface UseProcessingHistoryFormParams {
	/** Original processing history data */
	data?: ProcessingHistoryData;
	/** Facts data with overrides applied (from /facts/business/:id/processing-history) */
	factsData?: Record<string, any>;
	/** Business ID */
	businessId: string;
	/** Case ID */
	caseId: string;
	/** Whether data is still loading */
	isLoading: boolean;
}

interface UseProcessingHistoryFormReturn {
	/** The react-hook-form instance */
	form: UseFormReturn<ProcessingHistoryFormValues>;
	/** Check if a specific field is dirty */
	isFieldDirty: (fieldKey: ProcessingHistoryFieldKey) => boolean;
	/** Get the original value for a field */
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	/** Get save status for a field */
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	/** Handle field edit complete */
	handleEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
}

export function useProcessingHistoryForm({
	data,
	factsData,
	businessId,
	caseId,
	isLoading,
}: UseProcessingHistoryFormParams): UseProcessingHistoryFormReturn {
	const hasInitialized = useRef(false);

	// Convert data to form values, applying overrides from facts if available
	const formDefaultValues = useMemo(() => {
		// Start with raw data values
		const rawValues = mapProcessingHistoryToFormValues(data);

		// If we have facts data, apply overridden values
		if (factsData) {
			const { values: overriddenValues } =
				extractValuesFromFacts(factsData);
			// Merge overridden values (only for fields that have values)
			for (const [key, value] of Object.entries(overriddenValues)) {
				if (
					value !== undefined &&
					value !== null &&
					value !== VALUE_NOT_AVAILABLE
				) {
					const fieldKey = key as ProcessingHistoryFieldKey;
					// Handle array fields (seasonal_high_volume_months)
					if (fieldKey === "seasonal_high_volume_months") {
						rawValues[fieldKey] = Array.isArray(value) ? value : [];
					} else {
						// Convert to string for form values
						rawValues[fieldKey] = String(value) as any;
					}
				}
			}
		}

		return rawValues;
	}, [data, factsData]);

	// Initialize react-hook-form
	const form = useForm<ProcessingHistoryFormValues>({
		defaultValues: defaultProcessingHistoryValues,
		mode: "onBlur",
	});

	const { formState, reset } = form;

	const { getSaveStatus: getFieldSaveStatus, handleEditComplete } =
		useProcessingHistoryEditState(caseId, businessId, {
			processingHistoryData: data,
			factsData,
		});

	// Sync form values when data loads
	useEffect(() => {
		if (!isLoading && !hasInitialized.current && data) {
			reset(formDefaultValues, {
				keepDirty: false,
				keepDirtyValues: false,
			});
			hasInitialized.current = true;
		}
	}, [isLoading, formDefaultValues, reset, data]);

	// Reset the initialized flag if we need to reload data
	useEffect(() => {
		if (isLoading) {
			hasInitialized.current = false;
		}
	}, [isLoading]);

	const isFieldDirty = useCallback(
		(fieldKey: ProcessingHistoryFieldKey): boolean => {
			return Boolean(formState.dirtyFields[fieldKey]);
		},
		[formState.dirtyFields],
	);

	// Get the original value for a field
	const getOriginalValue = useCallback(
		(fieldKey: ProcessingHistoryFieldKey): string | string[] => {
			return formDefaultValues[fieldKey] ?? "";
		},
		[formDefaultValues],
	);

	return {
		form,
		isFieldDirty,
		getOriginalValue,
		getSaveStatus: getFieldSaveStatus,
		handleEditComplete,
	};
}

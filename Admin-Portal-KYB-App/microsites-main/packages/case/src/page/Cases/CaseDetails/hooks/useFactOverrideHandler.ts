import { useCallback } from "react";
import { usePatchBusinessFactsOverride } from "@/services/queries/case.query";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import {
	convertToApiValue,
	getNestedFieldMapping,
	isNestedField,
} from "../utils/apiValueConverter";

import { VALUE_NOT_AVAILABLE } from "@/constants";

/**
 * Custom hook that provides a handler for saving fact overrides when edits are complete.
 * Handles value normalization, API value conversion, and save status tracking.
 *
 * This hook is designed to be used with editable fields across different tabs.
 * It manages the complete flow of saving fact overrides:
 * - Validates businessId is available
 * - Normalizes values for comparison
 * - Skips save if value hasn't changed
 * - Converts display values to API format (handles boolean, numeric, and nested fields)
 * - Handles nested fields (e.g., judgements.most_recent_amount)
 * - Tracks save status (saving, saved, error)
 * - Updates auto-save timestamp and shows toast notification
 *
 * @param caseId - The case ID to scope operations to
 * @param businessId - The business ID to save overrides for
 * @param setSaveStatus - Function to update save status for a field
 * @returns A callback function to handle edit completion: (fieldKey, originalValue, newValue) => void
 *
 * @example
 * ```tsx
 * const { setSaveStatus } = useFieldSaveStatus();
 * const handleEditComplete = useFactOverrideHandler(caseId, businessId, setSaveStatus);
 *
 * <SaveTrackingEditableField
 *   fieldKey="business_name"
 *   onEditComplete={handleEditComplete}
 * />
 * handleEditComplete("business_name", oldVal, newVal);
 * ```
 */
export function useFactOverrideHandler(
	caseId: string,
	businessId: string,
	setSaveStatus: (
		fieldKey: string,
		status: "idle" | "saving" | "saved" | "error",
	) => void,
) {
	const { mutateAsync: patchBusinessFactsOverride } =
		usePatchBusinessFactsOverride();
	const { setLastAutoSavedAt, setShowAutoSaveToast, addEditedFact } =
		useInlineEditStore(caseId);

	// Handle saving fact overrides when an edit is complete
	const handleEditComplete = useCallback(
		(
			fieldKey: string,
			originalValue: string | string[],
			newValue: string | string[],
		) => {
			// Don't save if businessId is not available
			if (businessId === VALUE_NOT_AVAILABLE) {
				return;
			}

			// Normalize values for comparison (arrays are sorted and joined)
			const normalizeForComparison = (val: string | string[]): string => {
				if (Array.isArray(val)) return [...val].sort().join(",");
				return val === VALUE_NOT_AVAILABLE || val === "" ? "" : val;
			};
			const normalizedOriginal = normalizeForComparison(originalValue);
			const normalizedNew = normalizeForComparison(newValue);

			// Don't save if value hasn't actually changed
			if (normalizedOriginal === normalizedNew) {
				return;
			}

			// Set status to saving
			setSaveStatus(fieldKey, "saving");

			// Convert the value to the correct type for the API
			const apiValue = convertToApiValue(fieldKey, newValue);

			// Build the overrides object
			// For nested fields, we need to send as { parentFact: { childKey: value } }
			let overrides: Record<string, any>;

			if (isNestedField(fieldKey)) {
				const mapping = getNestedFieldMapping(fieldKey);
				if (mapping) {
					overrides = {
						[mapping.parentFact]: {
							value: {
								[mapping.childKey]: apiValue,
							},
							comment: `Changed ${mapping.childKey} from "${originalValue}" to "${newValue}"`,
						},
					};
				} else {
					// Fallback if mapping not found
					overrides = {
						[fieldKey]: {
							value: apiValue,
							comment: `Changed from "${originalValue}" to "${newValue}"`,
						},
					};
				}
			} else {
				// Standard flat field
				overrides = {
					[fieldKey]: {
						value: apiValue,
						comment: `Changed from "${originalValue}" to "${newValue}"`,
					},
				};
			}

			// Use async/await pattern to ensure callbacks run
			const doSave = async () => {
				try {
					await patchBusinessFactsOverride({
						businessId,
						overrides,
					});
					setSaveStatus(fieldKey, "saved");
					setLastAutoSavedAt(new Date());
					setShowAutoSaveToast(true);
					// Mark that an edit has been made (global tracking)
					addEditedFact(fieldKey);
				} catch (error) {
					// Error is handled by setting status to "error"
					setSaveStatus(fieldKey, "error");
				}
			};
			void doSave();
		},
		[
			businessId,
			patchBusinessFactsOverride,
			setSaveStatus,
			setLastAutoSavedAt,
			setShowAutoSaveToast,
			addEditedFact,
		],
	);

	return handleEditComplete;
}

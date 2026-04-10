import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePatchBusinessFactsOverride } from "@/services/queries/case.query";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { useFieldSaveStatus } from "../../../../hooks";
import {
	convertToApiValue,
	getNestedFieldMapping,
	isNestedField,
} from "../../../../utils/apiValueConverter";

import { VALUE_NOT_AVAILABLE } from "@/constants";

interface PublicFilingsTabData {
	bjlData?: any;
}

/**
 * Hook that manages edit state for PublicFilingsTab.
 * Handles save status tracking, override timestamps, and edit completion.
 *
 * For BJL nested fields (judgements, liens, bankruptcies), this hook
 * ensures the entire parent object is sent with all existing values
 * preserved, only updating the specific subfield that changed.
 */
export function usePublicFilingsTabEditState(
	caseId: string,
	businessId: string,
	data: PublicFilingsTabData,
) {
	const { getSaveStatus, setSaveStatus } = useFieldSaveStatus();
	const { setLastAutoSavedAt, setShowAutoSaveToast } =
		useInlineEditStore(caseId);
	const { mutateAsync: patchBusinessFactsOverride } =
		usePatchBusinessFactsOverride();

	// Local cache of pending edits per parent fact (judgements, liens, bankruptcies)
	// This prevents race conditions when multiple nested fields are edited before data refreshes
	const pendingEditsRef = useRef<Record<string, Record<string, any>>>({});

	// Compute the latest override timestamp from BJL data
	const latestOverrideTimestamp = useMemo(() => {
		const bjlData = data.bjlData;

		if (!bjlData) return null;

		let latestTimestamp: Date | null = null;

		// Check all BJL fields for override timestamps
		const bjlFields = [
			"num_liens",
			"num_judgements",
			"num_bankruptcies",
			"bankruptcies",
			"liens",
			"judgements",
		];

		for (const key of bjlFields) {
			const fact = bjlData[key as keyof typeof bjlData];
			if (fact && typeof fact === "object" && "override" in fact) {
				const override = (fact as { override?: { timestamp?: string } })
					.override;
				if (override?.timestamp) {
					const timestamp = new Date(override.timestamp);
					if (!latestTimestamp || timestamp > latestTimestamp) {
						latestTimestamp = timestamp;
					}
				}
			}
		}

		return latestTimestamp;
	}, [data.bjlData]);

	// Update the inline edit store with the latest override timestamp
	useEffect(() => {
		if (latestOverrideTimestamp) {
			setLastAutoSavedAt(latestOverrideTimestamp);
		}
	}, [latestOverrideTimestamp, setLastAutoSavedAt]);

	/**
	 * Get the current value object for a parent BJL fact (judgements, liens, bankruptcies).
	 * This merges:
	 * 1. Original values from the API (bjlData)
	 * 2. Any pending edits that haven't been reflected in refetched data yet
	 *
	 * This prevents race conditions when multiple fields are edited rapidly.
	 */
	const getParentFactValue = useCallback(
		(parentFact: string): Record<string, any> => {
			const bjlData = data.bjlData;

			// Start with API data (if available)
			const apiValue =
				bjlData?.[parentFact]?.value &&
				typeof bjlData[parentFact].value === "object"
					? { ...bjlData[parentFact].value }
					: {};

			// Merge in any pending edits for this parent fact
			const pendingEdits = pendingEditsRef.current[parentFact] ?? {};

			return {
				...apiValue,
				...pendingEdits,
			};
		},
		[data.bjlData],
	);

	/**
	 * Track a pending edit in the local cache.
	 * This ensures subsequent edits to the same parent include previous edits.
	 */
	const trackPendingEdit = useCallback(
		(parentFact: string, childKey: string, value: any) => {
			if (!pendingEditsRef.current[parentFact]) {
				pendingEditsRef.current[parentFact] = {};
			}
			pendingEditsRef.current[parentFact][childKey] = value;
		},
		[],
	);

	/**
	 * Custom edit completion handler for PublicFilingsTab.
	 * Handles both simple fields and nested BJL fields.
	 *
	 * For nested BJL fields (e.g., judgements_total_amount):
	 * - Gets the original parent object with all values
	 * - Merges the new value with existing values
	 * - Sends the complete object to the API
	 */
	const handleEditComplete = useCallback(
		(fieldKey: string, originalValue: string, newValue: string) => {
			// Don't save if businessId is not available
			if (businessId === VALUE_NOT_AVAILABLE) {
				return;
			}

			// Normalize empty values and VALUE_NOT_AVAILABLE to compare properly
			const normalizedOriginal =
				originalValue === VALUE_NOT_AVAILABLE || originalValue === ""
					? ""
					: originalValue;
			const normalizedNew =
				newValue === VALUE_NOT_AVAILABLE || newValue === ""
					? ""
					: newValue;

			// Don't save if value hasn't actually changed
			if (normalizedOriginal === normalizedNew) {
				return;
			}

			// Set status to saving
			setSaveStatus(fieldKey, "saving");

			// Convert the value to the correct type for the API
			const apiValue = convertToApiValue(fieldKey, newValue);

			// Build the overrides object
			let overrides: Record<string, any>;

			if (isNestedField(fieldKey)) {
				const mapping = getNestedFieldMapping(fieldKey);
				if (mapping) {
					// Track this edit in the local cache BEFORE getting parent value
					// This ensures we include this edit in the merged object
					trackPendingEdit(
						mapping.parentFact,
						mapping.childKey,
						apiValue,
					);

					// Get the parent object with all existing values + pending edits
					const mergedValue = getParentFactValue(mapping.parentFact);

					overrides = {
						[mapping.parentFact]: {
							value: mergedValue,
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
				// Standard flat field (num_judgements, num_liens, num_bankruptcies)
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
			getParentFactValue,
			trackPendingEdit,
		],
	);

	return {
		getSaveStatus,
		handleEditComplete,
		latestOverrideTimestamp,
	};
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { useFactOverrideHandler } from "../../../../hooks/useFactOverrideHandler";
import { useFieldSaveStatus } from "../../../../hooks/useFieldSaveStatus";
import {
	getChildFieldKeys,
	hasChildFields,
} from "../../config/BackgroundTab/fieldRelationships";

interface BackgroundTabData {
	factsBusinessDetails?: any;
	getFactsKybData?: any;
	getFactsFinancialsData?: any;
}

/**
 * Hook that manages edit state for BackgroundTab.
 * Handles save status tracking, override timestamps, edit completion,
 * and tracking of edited parent fields (to clear dependent child values).
 */
export function useBackgroundTabEditState(
	caseId: string,
	businessId: string,
	data: BackgroundTabData,
) {
	const { getSaveStatus, setSaveStatus } = useFieldSaveStatus();
	const { setLastAutoSavedAt } = useInlineEditStore(caseId);

	// Track which parent fields have been edited in this session
	// Their child fields should show as cleared until page refresh
	const [editedParentFields, setEditedParentFields] = useState<Set<string>>(
		new Set(),
	);

	// Compute the latest override timestamp from all facts data
	const latestOverrideTimestamp = useMemo(() => {
		const allFactsData = [
			data.factsBusinessDetails?.data,
			data.getFactsKybData?.data,
			data.getFactsFinancialsData?.data,
		].filter(Boolean);

		let latestTimestamp: Date | null = null;

		for (const factsData of allFactsData) {
			if (!factsData) continue;
			for (const key of Object.keys(factsData)) {
				const fact = factsData[key as keyof typeof factsData];
				if (fact && typeof fact === "object" && "override" in fact) {
					const override = fact.override;
					if (override?.timestamp) {
						const timestamp = new Date(override.timestamp);
						if (!latestTimestamp || timestamp > latestTimestamp) {
							latestTimestamp = timestamp;
						}
					}
				}
			}
		}

		return latestTimestamp;
	}, [
		data.factsBusinessDetails?.data,
		data.getFactsKybData?.data,
		data.getFactsFinancialsData?.data,
	]);

	// Update the inline edit store with the latest override timestamp
	useEffect(() => {
		if (latestOverrideTimestamp) {
			setLastAutoSavedAt(latestOverrideTimestamp);
		}
	}, [latestOverrideTimestamp, setLastAutoSavedAt]);

	// Base edit completion handler (calls fact override API)
	const baseHandleEditComplete = useFactOverrideHandler(
		caseId,
		businessId,
		setSaveStatus,
	);

	// Wrapped edit completion handler that also tracks parent field edits
	const handleEditComplete = useCallback(
		(fieldKey: string, originalValue: string, newValue: string) => {
			// Call the base handler to perform the API update
			baseHandleEditComplete(fieldKey, originalValue, newValue);

			// If this field has child fields, mark it as edited
			// This will cause child fields to show as cleared until refresh
			if (hasChildFields(fieldKey)) {
				setEditedParentFields((prev) => new Set([...prev, fieldKey]));
			}
		},
		[baseHandleEditComplete],
	);

	// Check if a child field's parent has been edited (and child should be cleared)
	const isChildFieldCleared = useCallback(
		(childFieldKey: string): boolean => {
			// Check if any parent of this child field has been edited
			for (const parentField of editedParentFields) {
				const childFields = getChildFieldKeys(parentField);
				if (childFields.includes(childFieldKey)) {
					return true;
				}
			}
			return false;
		},
		[editedParentFields],
	);

	// Get list of all child fields that should be cleared
	const clearedChildFields = useMemo(() => {
		const cleared: string[] = [];
		for (const parentField of editedParentFields) {
			cleared.push(...getChildFieldKeys(parentField));
		}
		return cleared;
	}, [editedParentFields]);

	return {
		getSaveStatus,
		handleEditComplete,
		latestOverrideTimestamp,
		editedParentFields,
		isChildFieldCleared,
		clearedChildFields,
	};
}

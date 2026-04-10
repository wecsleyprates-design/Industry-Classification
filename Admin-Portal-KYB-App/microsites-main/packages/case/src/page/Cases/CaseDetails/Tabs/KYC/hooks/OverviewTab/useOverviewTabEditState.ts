import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getFactsKyc } from "@/services/api/integration.service";
import { usePatchBusinessFactsOverride } from "@/services/queries/case.query";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { type FactsKycOwnerData } from "@/types/integrations";
import { useFieldSaveStatus } from "../../../../hooks/useFieldSaveStatus";
import { convertToApiValue } from "../../../../utils/apiValueConverter";
import {
	cleanOwnerForOverride,
	isAddressField,
	parseAddressString,
} from "../../utils/OverviewTab";

import { VALUE_NOT_AVAILABLE } from "@/constants";

interface UseOverviewTabEditStateParams {
	businessId: string;
	ownerId: string;
	caseId: string;
	/** Current array of all owners from KYC facts API */
	currentOwners: FactsKycOwnerData[] | undefined;
	/** Function to look up title by name (from useOwnerTitleOptions hook) */
	getTitleByName?: (
		name: string,
	) => { id: number; title: string } | undefined;
}

/**
 * Hook that manages edit state for OverviewTab (KYC).
 * Handles save status tracking and edit completion via fact override API.
 *
 * ## Why KYC Uses a Different Edit Pattern Than KYB
 *
 * **KYB tabs** use the shared `useFactOverrideHandler` hook which sends
 * single-field overrides like: `{ business_name: { value: "New Name" } }`
 *
 * **KYC OverviewTab** cannot use that pattern because:
 * - The `owners_submitted` fact stores an ARRAY of all owners
 * - The override API expects the complete array, not a single owner's field
 * - When editing one owner's `first_name`, we must send the entire owners array
 *   with that one field updated
 *
 * This requires custom logic to:
 * 1. Merge the edit into the full owners array
 * 2. Clean all owner data to match the backend Zod schema
 * 3. Track pending edits locally to prevent race conditions
 * 4. Parse address strings back into individual fields
 *
 * @see useFactOverrideHandler - The simpler pattern used by KYB tabs
 * @see cleanOwnerForOverride - Utility that cleans owner data for the API
 */
export function useOverviewTabEditState({
	businessId,
	ownerId,
	caseId,
	currentOwners,
	getTitleByName,
}: UseOverviewTabEditStateParams) {
	const queryClient = useQueryClient();
	const { getSaveStatus, setSaveStatus, resetAllSaveStatuses } =
		useFieldSaveStatus();
	const { mutateAsync: patchBusinessFactsOverride } =
		usePatchBusinessFactsOverride();
	const { setLastAutoSavedAt, setShowAutoSaveToast, addEditedFact } =
		useInlineEditStore(caseId);

	// Local cache of pending edits per owner (keyed by ownerId, then by fieldKey)
	// This prevents race conditions when multiple fields are edited before data refreshes
	const pendingEditsRef = useRef<Record<string, Record<string, unknown>>>({});

	/**
	 * Track a pending edit in the local cache.
	 * This ensures subsequent edits include previous edits that haven't been
	 * reflected in the API response yet.
	 */
	const trackPendingEdit = useCallback(
		(targetOwnerId: string, fieldKey: string, value: unknown) => {
			if (!pendingEditsRef.current[targetOwnerId]) {
				pendingEditsRef.current[targetOwnerId] = {};
			}
			pendingEditsRef.current[targetOwnerId][fieldKey] = value;
		},
		[],
	);

	/**
	 * Get the merged owner data that includes both API data and pending edits.
	 * This ensures all local changes are included even if the API hasn't refreshed.
	 */
	const getMergedOwnerData = useCallback(
		(owner: FactsKycOwnerData): FactsKycOwnerData => {
			const pendingEdits = pendingEditsRef.current[owner.id] ?? {};
			return {
				...owner,
				...pendingEdits,
			} as FactsKycOwnerData;
		},
		[],
	);

	// Handler for KYC fact overrides - builds full array with updated field
	const handleOwnerEditComplete = useCallback(
		(fieldKey: string, originalValue: string, newValue: string) => {
			// Don't save if businessId or ownerId is not available
			if (businessId === VALUE_NOT_AVAILABLE || !ownerId) {
				return;
			}

			// Don't save if we don't have the current owners data
			if (!currentOwners || currentOwners.length === 0) {
				console.error("Cannot save: no current owners data available");
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

			// Track this edit for report hiding (email report/fraud report)
			// Prefix with ownerId so edits are scoped per-owner (multiple owners share the same case store)
			addEditedFact(`${ownerId}:${fieldKey}`);

			// Set status to saving
			setSaveStatus(fieldKey, "saving");

			// Handle address field specially - parse the combined string into individual fields
			if (isAddressField(fieldKey)) {
				// Get original address components from the current owner for fallback
				const currentOwner = currentOwners.find(
					(o) => o.id === ownerId,
				);
				const originalAddressComponents = currentOwner
					? {
							address_line_1: currentOwner.address_line_1,
							address_line_2: currentOwner.address_line_2,
							address_apartment: currentOwner.address_apartment,
							address_city: currentOwner.address_city,
							address_state: currentOwner.address_state,
							address_postal_code:
								currentOwner.address_postal_code,
							address_country: currentOwner.address_country,
						}
					: undefined;

				// Parse the new address string into individual fields
				const parsedAddress = parseAddressString(
					newValue,
					originalAddressComponents,
				);

				// Track all parsed address fields as pending edits
				trackPendingEdit(
					ownerId,
					"address_line_1",
					parsedAddress.address_line_1,
				);
				trackPendingEdit(
					ownerId,
					"address_line_2",
					parsedAddress.address_line_2,
				);
				trackPendingEdit(
					ownerId,
					"address_apartment",
					parsedAddress.address_apartment,
				);
				trackPendingEdit(
					ownerId,
					"address_city",
					parsedAddress.address_city,
				);
				trackPendingEdit(
					ownerId,
					"address_state",
					parsedAddress.address_state,
				);
				trackPendingEdit(
					ownerId,
					"address_postal_code",
					parsedAddress.address_postal_code,
				);
				trackPendingEdit(
					ownerId,
					"address_country",
					parsedAddress.address_country,
				);
			} else {
				// Convert the value to the correct type for the API
				const apiValue = convertToApiValue(fieldKey, newValue);

				// Track this edit in the local cache BEFORE building the payload
				// This ensures subsequent edits include this change
				trackPendingEdit(ownerId, fieldKey, apiValue);
			}

			// Build the complete array of owners with all pending edits merged
			// The API expects the entire fact value, not just the changed field
			// Clean each owner to ensure it matches the backend schema
			const updatedOwners = currentOwners.map((owner) => {
				// Get merged data (API data + pending edits) for this owner
				const mergedOwner = getMergedOwnerData(owner);
				// Clean to match backend schema, passing original owner to preserve title id
				// Pass getTitleByName to convert title string to { id, title } object
				return cleanOwnerForOverride(
					mergedOwner,
					owner,
					getTitleByName,
				);
			});

			const overrides = {
				owners_submitted: {
					value: updatedOwners,
					comment: `Changed ${fieldKey} from "${originalValue}" to "${newValue}" for owner ${ownerId}`,
					changedField: fieldKey,
					changedOwnerId: ownerId,
				},
			};

			// Use async/await pattern to ensure callbacks run
			// After saving, fetch fresh data with noCache=true to update React Query cache
			const doSave = async () => {
				try {
					await patchBusinessFactsOverride({
						businessId,
						overrides,
					});
					setSaveStatus(fieldKey, "saved");
					setLastAutoSavedAt(new Date());
					setShowAutoSaveToast(true);

					// Fetch fresh KYC data with noCache=true to bypass backend cache
					// This ensures the React Query cache has the latest override data
					const freshData = await getFactsKyc(businessId, true);
					queryClient.setQueryData(
						["getKycFacts", businessId],
						freshData,
					);
				} catch (error) {
					setSaveStatus(fieldKey, "error");
				}
			};
			void doSave();
		},
		[
			businessId,
			ownerId,
			currentOwners,
			patchBusinessFactsOverride,
			setSaveStatus,
			setLastAutoSavedAt,
			setShowAutoSaveToast,
			addEditedFact,
			trackPendingEdit,
			getMergedOwnerData,
			queryClient,
			getTitleByName,
		],
	);

	return {
		getSaveStatus,
		handleEditComplete: handleOwnerEditComplete,
		resetAllSaveStatuses,
	};
}

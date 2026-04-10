import { useEffect, useMemo } from "react";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { useFactOverrideHandler } from "../../../../hooks/useFactOverrideHandler";
import { useFieldSaveStatus } from "../../../../hooks/useFieldSaveStatus";

interface WebsiteTabData {
	factsBusinessDetails?: any;
	businessWebsiteData?: any;
}

/**
 * Hook that manages edit state for WebsiteTab.
 * Handles save status tracking, override timestamps, and edit completion.
 */
export function useWebsiteTabEditState(
	caseId: string,
	businessId: string,
	data: WebsiteTabData,
) {
	const { getSaveStatus, setSaveStatus } = useFieldSaveStatus();
	const { setLastAutoSavedAt } = useInlineEditStore(caseId);

	// Compute the latest override timestamp from all facts data
	const latestOverrideTimestamp = useMemo(() => {
		const allFactsData = [
			data.factsBusinessDetails?.data,
			data.businessWebsiteData?.data,
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
	}, [data.factsBusinessDetails?.data, data.businessWebsiteData?.data]);

	// Update the inline edit store with the latest override timestamp
	useEffect(() => {
		if (latestOverrideTimestamp) {
			setLastAutoSavedAt(latestOverrideTimestamp);
		}
	}, [latestOverrideTimestamp, setLastAutoSavedAt]);

	// Base edit completion handler (calls fact override API)
	const handleEditComplete = useFactOverrideHandler(
		caseId,
		businessId,
		setSaveStatus,
	);

	return {
		getSaveStatus,
		handleEditComplete,
		latestOverrideTimestamp,
	};
}

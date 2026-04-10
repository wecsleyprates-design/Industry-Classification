import { useMemo } from "react";
import {
	combineAlternatives,
	createSuggestionGroups,
} from "../../../../utils/suggestionUtils";

interface WebsiteTabData {
	factsBusinessDetails?: any;
	businessWebsiteData?: any;
}

/**
 * Hook that generates all suggestion groups for WebsiteTab fields.
 * Returns a map of fieldKey -> SuggestionGroup[] for easy lookup.
 */
export function useWebsiteTabSuggestions(data: WebsiteTabData) {
	const { factsBusinessDetails } = data;

	// Website suggestions
	const websiteSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					factsBusinessDetails?.data?.website?.alternatives,
				),
				(val: unknown) => String(val),
			),
		[factsBusinessDetails?.data?.website?.alternatives],
	);

	// Return as a map for easy lookup
	return useMemo(
		() => ({
			website: websiteSuggestions,
		}),
		[websiteSuggestions],
	);
}

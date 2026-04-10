import { useMemo } from "react";
import {
	combineAlternatives,
	createSuggestionGroups,
} from "../../../../utils/suggestionUtils";

interface BusinessRegistrationTabData {
	getFactsKybData?: any;
	factsBusinessDetails?: any;
}

/**
 * Hook that generates all suggestion groups for BusinessRegistrationTab fields.
 * Returns a map of fieldKey -> SuggestionGroup[] for easy lookup.
 */
export function useBusinessRegistrationTabSuggestions(
	data: BusinessRegistrationTabData,
) {
	const { getFactsKybData, factsBusinessDetails } = data;

	// Business name suggestions - combines legal_name and names_found
	const businessNameSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					getFactsKybData?.data?.legal_name?.alternatives,
					getFactsKybData?.data?.names_found?.alternatives,
					factsBusinessDetails?.data?.business_name?.alternatives,
				),
				(val: unknown) => (Array.isArray(val) ? val[0] : String(val)),
			),
		[
			getFactsKybData?.data?.legal_name?.alternatives,
			getFactsKybData?.data?.names_found?.alternatives,
			factsBusinessDetails?.data?.business_name?.alternatives,
		],
	);

	// TIN suggestions
	const tinSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				getFactsKybData?.data?.tin?.alternatives,
				(val: unknown) => String(val),
			),
		[getFactsKybData?.data?.tin?.alternatives],
	);

	// Return as a map for easy lookup
	return useMemo(
		() => ({
			business_name: businessNameSuggestions,
			tin: tinSuggestions,
		}),
		[businessNameSuggestions, tinSuggestions],
	);
}

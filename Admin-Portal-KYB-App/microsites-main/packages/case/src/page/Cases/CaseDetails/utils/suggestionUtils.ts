import { type SuggestionGroup } from "@/components/EditableField";
import { getCurrencyDisplayValue } from "./fieldFormatters";

/**
 * Helper to convert facts alternatives to suggestion groups
 */
export const createSuggestionGroups = (
	alternatives:
		| Array<{ value: unknown; source: string | number }>
		| undefined,
	formatValue?: (val: unknown) => string,
	options?: { includeSource?: boolean },
): SuggestionGroup[] => {
	if (!alternatives || alternatives.length === 0) return [];

	const suggestions = alternatives
		.filter((alt) => alt.value !== null && alt.value !== undefined)
		.map((alt) => ({
			label: formatValue ? formatValue(alt.value) : String(alt.value),
			value: String(alt.value),
			// Only include source if explicitly requested (for address fields)
			source: options?.includeSource ? String(alt.source) : undefined,
		}));

	// Deduplicate suggestions based on the value (case-insensitive)
	const seenValues = new Set<string>();
	const uniqueSuggestions = suggestions.filter((suggestion) => {
		const valueLower = suggestion.value.toLowerCase().trim();
		if (seenValues.has(valueLower)) {
			return false;
		}
		seenValues.add(valueLower);
		return true;
	});

	if (uniqueSuggestions.length === 0) return [];

	return [
		{
			title: "SUGGESTIONS FROM FOUND DATA SOURCES",
			options: uniqueSuggestions,
		},
	];
};

/**
 * Helper to combine alternatives from multiple sources
 */
export const combineAlternatives = (
	...alternativeArrays: Array<
		Array<{ value: unknown; source: string | number }> | undefined
	>
): Array<{ value: unknown; source: string | number }> | undefined => {
	const combined: Array<{ value: unknown; source: string | number }> = [];
	for (const arr of alternativeArrays) {
		if (arr && Array.isArray(arr)) {
			combined.push(...arr);
		}
	}
	return combined.length > 0 ? combined : undefined;
};

/**
 * Expands alternatives that have array values into individual alternatives.
 * Useful for fields like dba_found where a single alternative contains an array of values.
 *
 * Example input: [{ value: ["DBA1", "DBA2", "DBA3"], source: 24 }]
 * Example output: [{ value: "DBA1", source: 24 }, { value: "DBA2", source: 24 }, { value: "DBA3", source: 24 }]
 */
export const expandArrayAlternatives = (
	alternatives:
		| Array<{ value: unknown; source: string | number }>
		| undefined,
): Array<{ value: unknown; source: string | number }> | undefined => {
	if (!alternatives || alternatives.length === 0) return undefined;

	const expanded: Array<{ value: unknown; source: string | number }> = [];

	for (const alt of alternatives) {
		if (Array.isArray(alt.value)) {
			// Expand array values into individual alternatives
			for (const item of alt.value) {
				expanded.push({
					value: item,
					source: alt.source,
				});
			}
		} else {
			// Keep non-array values as-is
			expanded.push(alt);
		}
	}

	return expanded.length > 0 ? expanded : undefined;
};

/**
 * Common formatters for suggestion values
 */
export const suggestionFormatters = {
	/** Convert value to string */
	string: (val: unknown) => String(val),
	/** Extract first element from array, otherwise convert to string */
	firstArrayElement: (val: unknown) =>
		Array.isArray(val) ? val[0] : String(val),
	/** Join array elements with comma, otherwise convert to string */
	arrayJoin: (val: unknown) =>
		Array.isArray(val) ? val.join(", ") : String(val),
	/** Format currency values */
	currency: (val: unknown) => getCurrencyDisplayValue(val as number),
	/** Extract name property from object, otherwise convert to string */
	objectName: (val: unknown) =>
		(val as { name?: string })?.name ?? String(val),
};

/**
 * Create suggestions from a single fact source
 * @param alternatives - The alternatives array from a fact
 * @param formatter - Formatter function (defaults to string formatter)
 * @returns Suggestion groups
 */
export const createSuggestionsFromFact = (
	alternatives:
		| Array<{ value: unknown; source: string | number }>
		| undefined,
	formatter: (val: unknown) => string = suggestionFormatters.string,
): SuggestionGroup[] => {
	return createSuggestionGroups(alternatives, formatter);
};

/**
 * Create suggestions from multiple combined fact sources
 * @param alternativeArrays - Array of alternatives arrays to combine
 * @param formatter - Formatter function (defaults to firstArrayElement formatter)
 * @returns Suggestion groups
 */
export const createSuggestionsFromCombinedFacts = (
	alternativeArrays: Array<
		Array<{ value: unknown; source: string | number }> | undefined
	>,
	formatter: (
		val: unknown,
	) => string = suggestionFormatters.firstArrayElement,
): SuggestionGroup[] => {
	const combined = combineAlternatives(...alternativeArrays);
	return createSuggestionGroups(combined, formatter);
};

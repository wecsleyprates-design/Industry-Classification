export type EditableFieldInputType =
	| "text"
	| "number"
	| "dropdown"
	| "date"
	| "address";

export interface SuggestionOption {
	/** Display label for the suggestion */
	label: string;
	/** Value to use when selected */
	value: string | number;
	/** Optional source/category for grouping */
	source?: string;
}

export interface SuggestionGroup {
	/** Group title (e.g., "SUGGESTIONS FROM FOUND DATA SOURCES") */
	title: string;
	/** Suggestions in this group */
	options: SuggestionOption[];
}

/** Save status for the field */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

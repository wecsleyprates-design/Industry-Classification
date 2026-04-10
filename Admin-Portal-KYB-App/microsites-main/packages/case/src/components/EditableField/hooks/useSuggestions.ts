import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	FieldPath,
	FieldValues,
	UseControllerReturn,
} from "react-hook-form";
import type { SuggestionGroup, SuggestionOption } from "../types";

export interface UseSuggestionsParams<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
	/** Flat list of suggestions */
	suggestions?: SuggestionOption[];
	/** Grouped suggestions with titles */
	suggestionGroups?: SuggestionGroup[];
	/** Field controller from useController */
	field: UseControllerReturn<TFieldValues, TName>["field"];
	/** Whether currently in edit mode */
	isEditing: boolean;
	/** Set editing state */
	setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
	/** Ref to track if edit was completed */
	editCompletedRef: React.MutableRefObject<boolean>;
	/** Ref to track value before edit */
	valueBeforeEditRef: React.MutableRefObject<string>;
	/** Field name */
	name: TName;
	/** Callback when edit is complete */
	onEditComplete?: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
}

export interface UseSuggestionsReturn {
	/** Whether to show suggestions dropdown */
	showSuggestions: boolean;
	/** Set show suggestions state */
	setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
	/** Index of currently focused suggestion */
	focusedSuggestionIndex: number;
	/** Set focused suggestion index */
	setFocusedSuggestionIndex: React.Dispatch<React.SetStateAction<number>>;
	/** Flat list of all options */
	flatOptions: SuggestionOption[];
	/** Whether there are any suggestions */
	hasSuggestions: boolean;
	/** Handle suggestion selection */
	handleSuggestionSelect: (suggestion: SuggestionOption) => void;
}

/**
 * Hook to manage suggestions state and selection.
 */
export function useSuggestions<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	suggestions,
	suggestionGroups,
	field,
	isEditing,
	setIsEditing,
	editCompletedRef,
	valueBeforeEditRef,
	name,
	onEditComplete,
}: UseSuggestionsParams<TFieldValues, TName>): UseSuggestionsReturn {
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);

	// Reset state when exiting edit mode
	useEffect(() => {
		if (!isEditing) {
			setShowSuggestions(false);
			setFocusedSuggestionIndex(-1);
		}
	}, [isEditing]);

	// Check if there are any suggestions
	const hasSuggestions =
		(suggestions?.length ?? 0) > 0 || (suggestionGroups?.length ?? 0) > 0;

	// Build flat list of options for keyboard navigation
	const flatOptions = useMemo(() => {
		const options: SuggestionOption[] = [];
		if (suggestionGroups && suggestionGroups.length > 0) {
			suggestionGroups.forEach((g) => {
				g.options.forEach((o) => options.push(o));
			});
		} else if (suggestions && suggestions.length > 0) {
			suggestions.forEach((s) => options.push(s));
		}
		return options;
	}, [suggestions, suggestionGroups]);

	// Handle suggestion selection
	const handleSuggestionSelect = useCallback(
		(suggestion: SuggestionOption) => {
			const newValue = String(suggestion.value);
			const previousValue = valueBeforeEditRef.current;
			field.onChange(newValue);
			setShowSuggestions(false);
			setIsEditing(false);

			if (onEditComplete && newValue !== previousValue) {
				editCompletedRef.current = true;
				onEditComplete(name as string, previousValue, newValue);
			}
		},
		[
			field,
			onEditComplete,
			name,
			setIsEditing,
			editCompletedRef,
			valueBeforeEditRef,
		],
	);

	return {
		showSuggestions,
		setShowSuggestions,
		focusedSuggestionIndex,
		setFocusedSuggestionIndex,
		flatOptions,
		hasSuggestions,
		handleSuggestionSelect,
	};
}

import React from "react";
import { cn } from "@/lib/utils";
import { isEmpty } from "../constants";
import type { SuggestionGroup, SuggestionOption } from "../types";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export interface SuggestionsDropdownProps {
	/** Whether to show the dropdown */
	show: boolean;
	/** Flat list of all options for selection */
	flatOptions: SuggestionOption[];
	/** Grouped suggestions with titles (optional) */
	suggestionGroups?: SuggestionGroup[];
	/** Current value for highlighting selected option */
	value: string;
	/** Index of currently focused suggestion (-1 for none) */
	focusedIndex: number;
	/** Whether to render above the input */
	renderAbove: boolean;
	/** Whether to show location pin icon (for address fields) */
	showIcon?: boolean;
	/** Callback when a suggestion is selected */
	onSelect: (suggestion: SuggestionOption) => void;
	/** Callback when mouse enters a suggestion */
	onHover: (index: number) => void;
	/** Refs array for suggestion elements */
	suggestionRefs: React.MutableRefObject<
		Array<HTMLDivElement | HTMLLIElement | null>
	>;
}

/**
 * Dropdown component for displaying suggestions/options.
 * Supports both grouped and flat suggestion lists.
 */
export function SuggestionsDropdown({
	show,
	flatOptions,
	suggestionGroups,
	value,
	focusedIndex,
	renderAbove,
	showIcon = false,
	onSelect,
	onHover,
	suggestionRefs,
}: SuggestionsDropdownProps) {
	if (!show || flatOptions.length === 0) return null;

	const hasGroupedSuggestions =
		suggestionGroups && suggestionGroups.length > 0;

	return (
		<div
			role="listbox"
			className={cn(
				"absolute left-0 z-50 max-h-60 min-w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5",
				renderAbove ? "bottom-full mb-1" : "top-full mt-1",
			)}
		>
			{hasGroupedSuggestions ? (
				<GroupedSuggestions
					suggestionGroups={suggestionGroups}
					focusedIndex={focusedIndex}
					showIcon={showIcon}
					onSelect={onSelect}
					onHover={onHover}
					suggestionRefs={suggestionRefs}
				/>
			) : (
				<FlatSuggestions
					options={flatOptions}
					value={value}
					focusedIndex={focusedIndex}
					onSelect={onSelect}
					onHover={onHover}
					suggestionRefs={suggestionRefs}
				/>
			)}
		</div>
	);
}

/** Grouped suggestions with section titles */
function GroupedSuggestions({
	suggestionGroups,
	focusedIndex,
	showIcon,
	onSelect,
	onHover,
	suggestionRefs,
}: {
	suggestionGroups: SuggestionGroup[];
	focusedIndex: number;
	showIcon: boolean;
	onSelect: (suggestion: SuggestionOption) => void;
	onHover: (index: number) => void;
	suggestionRefs: React.MutableRefObject<
		Array<HTMLDivElement | HTMLLIElement | null>
	>;
}) {
	return (
		<>
			{suggestionGroups.map((group, groupIndex) => {
				let globalIndex = 0;
				for (let i = 0; i < groupIndex; i++) {
					globalIndex += suggestionGroups[i].options.length;
				}
				return (
					<div key={groupIndex}>
						<div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-600 whitespace-nowrap">
							{group.title}
						</div>
						{group.options.map((suggestion, idx) => {
							const index = globalIndex + idx;
							return (
								<div
									key={`${groupIndex}-${idx}`}
									ref={(el) => {
										suggestionRefs.current[index] = el;
									}}
									className={cn(
										"flex items-center gap-2 px-3 py-2 text-sm text-gray-900 cursor-pointer",
										focusedIndex === index
											? "bg-blue-50"
											: "hover:bg-blue-50",
									)}
									role="option"
									aria-selected={focusedIndex === index}
									onMouseDown={(e) => {
										e.preventDefault();
										onSelect(suggestion);
									}}
									onMouseEnter={() => {
										onHover(index);
									}}
								>
									{showIcon && <LocationIcon />}
									<div className="font-medium">
										{suggestion.label}
									</div>
								</div>
							);
						})}
					</div>
				);
			})}
		</>
	);
}

/** Flat list of suggestions (for dropdowns) */
function FlatSuggestions({
	options,
	value,
	focusedIndex,
	onSelect,
	onHover,
	suggestionRefs,
}: {
	options: SuggestionOption[];
	value: string;
	focusedIndex: number;
	onSelect: (suggestion: SuggestionOption) => void;
	onHover: (index: number) => void;
	suggestionRefs: React.MutableRefObject<
		Array<HTMLDivElement | HTMLLIElement | null>
	>;
}) {
	return (
		<ul role="listbox">
			{options.map((suggestion, index) => {
				// Check if this option is selected - also handle N/A matching empty values
				const isNaOption =
					suggestion.label === VALUE_NOT_AVAILABLE ||
					suggestion.value === "" ||
					suggestion.value === "N/A";
				const isSelected =
					String(suggestion.value) === value ||
					(isNaOption && isEmpty(value));

				return (
					<li
						key={index}
						ref={(el) => {
							suggestionRefs.current[index] = el;
						}}
						className={cn(
							"px-3 py-2 text-sm flex items-center justify-between text-gray-900 cursor-pointer",
							focusedIndex === index
								? "bg-blue-50"
								: "hover:bg-blue-50",
						)}
						role="option"
						aria-selected={focusedIndex === index || isSelected}
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(suggestion);
						}}
						onMouseEnter={() => {
							onHover(index);
						}}
					>
						<span
							className={
								isSelected
									? "text-blue-600 font-medium"
									: "font-medium"
							}
						>
							{suggestion.label}
						</span>
						{isSelected && <CheckIcon />}
					</li>
				);
			})}
		</ul>
	);
}

/** Location pin icon for address suggestions */
function LocationIcon() {
	return (
		<svg
			className="h-5 w-5 text-gray-400 flex-shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	);
}

/** Checkmark icon for selected options */
function CheckIcon() {
	return (
		<svg
			className="h-4 w-4 text-blue-600"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 13l4 4L19 7"
			/>
		</svg>
	);
}

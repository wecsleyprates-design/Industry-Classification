import { type SuggestionOption } from "@/components/EditableField";

/** Dropdown options for Yes/No/N/A fields */
export const YES_NO_NA_OPTIONS: SuggestionOption[] = [
	{ label: "Yes", value: "Yes" },
	{ label: "No", value: "No" },
	{ label: "N/A", value: "N/A" },
];

/** Dropdown options for Corporation Type */
export const CORPORATION_TYPE_OPTIONS: SuggestionOption[] = [
	{ label: "Public", value: "Public" },
	{ label: "Private", value: "Private" },
	{ label: "N/A", value: "N/A" },
];

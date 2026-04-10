import { type SuggestionOption } from "@/components/EditableField";

/**
 * Dropdown options for BJL Status fields.
 * Based on BJLStatus type: "active" | "closed" | "pending" | "unknown" | "withdrawn" | null
 */
export const BJL_STATUS_OPTIONS: SuggestionOption[] = [
	{ label: "Active", value: "active" },
	{ label: "Closed", value: "closed" },
	{ label: "Pending", value: "pending" },
	{ label: "Unknown", value: "unknown" },
	{ label: "Withdrawn", value: "withdrawn" },
	{ label: "N/A", value: "N/A" },
];

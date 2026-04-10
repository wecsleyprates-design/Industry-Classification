import type { ReactNode } from "react";
import type {
	SuggestionGroup,
	SuggestionOption,
} from "@/components/EditableField";
import { capitalize } from "@/lib/helper";
import { getCurrencyDisplayValue } from "../../../../utils/fieldFormatters";
import { BJL_STATUS_OPTIONS } from "../../constants/fieldOptions";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export type FieldInputType =
	| "text"
	| "number"
	| "dropdown"
	| "date"
	| "currency";
export type LoadingStateKey = "bjl";

export interface FieldConfig {
	/** Unique field key for API */
	fieldKey: string;
	/** Display label (can be ReactNode for tooltips) */
	label: string | ReactNode;
	/** Which section this field belongs to */
	section: "judgements" | "liens" | "bankruptcies";
	/** Skeleton width class */
	skeletonWidth: string;
	/** Input type for editable fields */
	inputType?: FieldInputType;
	/** Whether field is editable */
	editable: boolean;
	/** Placeholder text */
	placeholder?: string;
	/** Key in suggestions map to use */
	suggestionKey?: string;
	/** Static suggestions for dropdowns */
	suggestions?: SuggestionOption[];
	/** Format function for display value */
	formatDisplayValue?: (val: string) => string;
	/** Custom renderer function (for special cases) */
	customRenderer?: (props: FieldRenderProps) => ReactNode;
	/** Function to get original value from data */
	getOriginalValue: (originalValues: any, data?: any) => string;
	/** Function to get display value for read-only fields */
	getDisplayValue?: (data: any) => string | ReactNode;
	/** Additional props for EditableField */
	additionalProps?: Record<string, any>;
}

export interface FieldRenderProps {
	fieldConfig: FieldConfig;
	originalValue: string;
	loading: boolean;
	canEdit: boolean;
	saveStatus: "idle" | "saving" | "saved" | "error";
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	suggestionGroups?: SuggestionGroup[];
	suggestions?: SuggestionOption[];
	skeletonWidth: string;
}

/**
 * Field configurations for PublicFilingsTab.
 * Adding a new field = adding one entry here.
 */
export const PUBLIC_FILINGS_TAB_FIELD_CONFIGS: FieldConfig[] = [
	// ================================
	// Judgements Section
	// ================================
	{
		fieldKey: "num_judgements",
		label: "Number of Judgement Filings",
		section: "judgements",
		skeletonWidth: "w-20",
		inputType: "number",
		editable: true,
		placeholder: "Enter number",
		suggestionKey: "num_judgements",
		getOriginalValue: (ov) => ov.numJudgements || "",
		additionalProps: { min: 0 },
	},
	{
		fieldKey: "judgements_most_recent",
		label: "Most Recent Filing Date",
		section: "judgements",
		skeletonWidth: "w-28",
		inputType: "date",
		editable: true,
		placeholder: "Select date",
		suggestionKey: "judgements_most_recent",
		getOriginalValue: (ov) => ov.judgementsMostRecent || "",
	},
	{
		fieldKey: "judgements_most_recent_status",
		label: "Most Recent Status",
		section: "judgements",
		skeletonWidth: "w-24",
		inputType: "dropdown",
		editable: true,
		suggestions: BJL_STATUS_OPTIONS,
		suggestionKey: "judgements_most_recent_status",
		getOriginalValue: (ov) => ov.judgementsMostRecentStatus || "",
		formatDisplayValue: (val: string) =>
			val && val !== VALUE_NOT_AVAILABLE
				? capitalize(val)
				: VALUE_NOT_AVAILABLE,
	},
	{
		fieldKey: "judgements_most_recent_amount",
		label: "Most Recent Amount",
		section: "judgements",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter amount (e.g. 5000)",
		suggestionKey: "judgements_most_recent_amount",
		getOriginalValue: (ov) => ov.judgementsMostRecentAmount || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
	},
	{
		fieldKey: "judgements_total_amount",
		label: "Total Amount",
		section: "judgements",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter amount (e.g. 10000)",
		suggestionKey: "judgements_total_amount",
		getOriginalValue: (ov) => ov.judgementsTotalAmount || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
	},

	// ================================
	// Liens Section
	// ================================
	{
		fieldKey: "num_liens",
		label: "Number of Liens",
		section: "liens",
		skeletonWidth: "w-20",
		inputType: "number",
		editable: true,
		placeholder: "Enter number",
		suggestionKey: "num_liens",
		getOriginalValue: (ov) => ov.numLiens || "",
		additionalProps: { min: 0 },
	},
	{
		fieldKey: "liens_most_recent",
		label: "Most Recent Filing Date",
		section: "liens",
		skeletonWidth: "w-28",
		inputType: "date",
		editable: true,
		placeholder: "Select date",
		suggestionKey: "liens_most_recent",
		getOriginalValue: (ov) => ov.liensMostRecent || "",
	},
	{
		fieldKey: "liens_most_recent_status",
		label: "Most Recent Status",
		section: "liens",
		skeletonWidth: "w-24",
		inputType: "dropdown",
		editable: true,
		suggestions: BJL_STATUS_OPTIONS,
		suggestionKey: "liens_most_recent_status",
		getOriginalValue: (ov) => ov.liensMostRecentStatus || "",
		formatDisplayValue: (val: string) =>
			val && val !== VALUE_NOT_AVAILABLE
				? capitalize(val)
				: VALUE_NOT_AVAILABLE,
	},
	{
		fieldKey: "liens_most_recent_amount",
		label: "Most Recent Amount",
		section: "liens",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter amount (e.g. 5000)",
		suggestionKey: "liens_most_recent_amount",
		getOriginalValue: (ov) => ov.liensMostRecentAmount || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
	},
	{
		fieldKey: "liens_total_amount",
		label: "Total Amount",
		section: "liens",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter amount (e.g. 10000)",
		suggestionKey: "liens_total_amount",
		getOriginalValue: (ov) => ov.liensTotalAmount || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
	},

	// ================================
	// Bankruptcies Section
	// ================================
	{
		fieldKey: "num_bankruptcies",
		label: "Number of Bankruptcies",
		section: "bankruptcies",
		skeletonWidth: "w-20",
		inputType: "number",
		editable: true,
		placeholder: "Enter number",
		suggestionKey: "num_bankruptcies",
		getOriginalValue: (ov) => ov.numBankruptcies || "",
		additionalProps: { min: 0 },
	},
	{
		fieldKey: "bankruptcies_most_recent",
		label: "Most Recent Filing Date",
		section: "bankruptcies",
		skeletonWidth: "w-28",
		inputType: "date",
		editable: true,
		placeholder: "Select date",
		suggestionKey: "bankruptcies_most_recent",
		getOriginalValue: (ov) => ov.bankruptciesMostRecent || "",
	},
	{
		fieldKey: "bankruptcies_most_recent_status",
		label: "Most Recent Status",
		section: "bankruptcies",
		skeletonWidth: "w-24",
		inputType: "dropdown",
		editable: true,
		suggestions: BJL_STATUS_OPTIONS,
		suggestionKey: "bankruptcies_most_recent_status",
		getOriginalValue: (ov) => ov.bankruptciesMostRecentStatus || "",
		formatDisplayValue: (val: string) =>
			val && val !== VALUE_NOT_AVAILABLE
				? capitalize(val)
				: VALUE_NOT_AVAILABLE,
	},
];

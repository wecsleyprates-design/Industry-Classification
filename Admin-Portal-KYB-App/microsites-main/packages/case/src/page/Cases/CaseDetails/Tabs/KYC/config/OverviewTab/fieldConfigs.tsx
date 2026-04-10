import type { ReactNode } from "react";
import type { SuggestionOption } from "@/components/EditableField";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { maskValue } from "@/helpers/maskValue";

export type FieldInputType =
	| "text"
	| "number"
	| "dropdown"
	| "date"
	| "address";

export type LoadingStateKey = "owner" | "verification";

export interface FieldConfig {
	/** Unique field key for API */
	fieldKey: string;
	/** Display label (can be ReactNode for tooltips) */
	label: string | ReactNode;
	/** Key to check in loadingStates */
	loadingStateKey: LoadingStateKey;
	/** Skeleton width class */
	skeletonWidth: string;
	/** Input type for editable fields */
	inputType?: FieldInputType;
	/** Whether field is editable */
	editable: boolean;
	/** Placeholder text */
	placeholder?: string;
	/** Static suggestions for dropdowns */
	suggestions?: SuggestionOption[];
	/** Format function for display value */
	formatDisplayValue?: (val: string) => string;
	/** Custom renderer function (for special cases) */
	customRenderer?: (props: FieldRenderProps) => ReactNode;
	/** Function to get original value from owner data */
	getOriginalValue: (owner: any) => string;
	/** Function to check if field is internally provided */
	getInternallyProvided: (guestOwnerEdits: string[]) => boolean;
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
	suggestions?: SuggestionOption[];
	skeletonWidth: string;
}

/**
 * Field configurations for OverviewTab (KYC).
 * Adding a new field = adding one entry here.
 */
export const OVERVIEW_TAB_FIELD_CONFIGS: FieldConfig[] = [
	// Personal Information
	{
		fieldKey: "first_name",
		label: "Legal First Name",
		loadingStateKey: "owner",
		skeletonWidth: "w-32",
		inputType: "text",
		editable: true,
		placeholder: "Enter first name",
		getOriginalValue: (owner) => owner?.first_name || "",
		getInternallyProvided: (goe) => goe.includes("first_name"),
	},
	{
		fieldKey: "last_name",
		label: "Legal Last Name",
		loadingStateKey: "owner",
		skeletonWidth: "w-32",
		inputType: "text",
		editable: true,
		placeholder: "Enter last name",
		getOriginalValue: (owner) => owner?.last_name || "",
		getInternallyProvided: (goe) => goe.includes("last_name"),
	},
	{
		fieldKey: "date_of_birth",
		label: "Date of Birth",
		loadingStateKey: "owner",
		skeletonWidth: "w-28",
		inputType: "date",
		editable: true,
		placeholder: "Enter date of birth",
		getOriginalValue: (owner) => owner?.date_of_birth || "",
		getInternallyProvided: (goe) => goe.includes("date_of_birth"),
	},
	{
		fieldKey: "ssn",
		label: "Social Security Number",
		loadingStateKey: "owner",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter SSN",
		formatDisplayValue: (val: string) => {
			if (!val) return VALUE_NOT_AVAILABLE;
			// Mask SSN showing only last 4 digits: XXX-XX-1234
			const digitsOnly = val.replace(/\D/g, "");
			if (digitsOnly.length < 4) return maskValue(val);
			const lastFour = digitsOnly.slice(-4);
			return `XXX-XX-${lastFour}`;
		},
		getOriginalValue: (owner) => owner?.ssn || "",
		getInternallyProvided: (goe) => goe.includes("ssn"),
	},
	{
		fieldKey: "home_address",
		label: "Home Address",
		loadingStateKey: "owner",
		skeletonWidth: "w-64",
		inputType: "address",
		editable: true,
		placeholder: "Enter home address",
		getOriginalValue: (owner) => {
			// Format address from owner fields
			const parts = [
				owner?.address_line_1,
				owner?.address_apartment,
				owner?.address_city,
				owner?.address_state,
				owner?.address_postal_code,
				owner?.address_country,
			].filter(Boolean);
			return parts.join(", ") || "";
		},
		getInternallyProvided: (goe) =>
			[
				"address_line_1",
				"address_city",
				"address_postal_code",
				"address_state",
				"address_apartment",
				"address_country",
			].some((e) => goe.includes(e)),
		additionalProps: { showSuggestionIcon: true },
	},
	{
		fieldKey: "mobile",
		label: "Phone Number",
		loadingStateKey: "owner",
		skeletonWidth: "w-32",
		inputType: "text",
		editable: true,
		placeholder: "Enter phone number",
		getOriginalValue: (owner) => owner?.mobile || "",
		getInternallyProvided: (goe) => goe.includes("mobile"),
	},
	{
		fieldKey: "email",
		label: "Email Address",
		loadingStateKey: "owner",
		skeletonWidth: "w-48",
		inputType: "text",
		editable: true,
		placeholder: "Enter email address",
		getOriginalValue: (owner) => owner?.email || "",
		getInternallyProvided: (goe) => goe.includes("email"),
	},
	{
		fieldKey: "title",
		label: "Job Title",
		loadingStateKey: "owner",
		skeletonWidth: "w-32",
		inputType: "dropdown",
		editable: true,
		getOriginalValue: (owner) => owner?.title?.title || "",
		getInternallyProvided: (goe) => goe.includes("title"),
	},
	{
		fieldKey: "ownership_percentage",
		label: "Ownership",
		loadingStateKey: "owner",
		skeletonWidth: "w-16",
		inputType: "number",
		editable: true,
		placeholder: "Enter ownership %",
		getOriginalValue: (owner) =>
			owner?.ownership_percentage != null
				? String(owner.ownership_percentage)
				: "",
		formatDisplayValue: (val: string) =>
			val ? `${val}%` : VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("ownership_percentage"),
		additionalProps: { min: 0, max: 100, step: 1 },
	},
];

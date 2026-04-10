import type { ReactNode } from "react";
import React from "react";
import type { SuggestionOption } from "@/components/EditableField";
import { EditableField } from "@/components/EditableField";
import { ExternalLink } from "../../../../components";
import {
	extractOverride,
	type FieldOverrideInfo,
} from "../../../../components/fieldSource.utils";
import { getFieldValidationRules } from "../../utils/WebsiteTab/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { formatUrl } from "@/helpers";

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
	suggestionGroups?: any[];
	suggestions?: SuggestionOption[];
	skeletonWidth: string;
}

export type FieldInputType = "text" | "number" | "dropdown" | "date";
export type LoadingStateKey = "websiteDetails";

export interface FieldConfig {
	/** Unique field key for API */
	fieldKey: string;
	/** Display label */
	label: string | ReactNode;
	/** Which section this field belongs to */
	section: "websiteDetails";
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
	/** Key in suggestions map to use */
	suggestionKey?: string;
	/** Static suggestions for dropdowns */
	suggestions?: SuggestionOption[];
	/** Format function for display value */
	formatDisplayValue?: (val: string) => string;
	/** Function to get original value from data */
	getOriginalValue: (originalValues: any, data?: any) => string;
	/** Function to get display value for read-only fields */
	getDisplayValue?: (data: any) => string | ReactNode;
	/** Function to check if field is internally provided */
	getInternallyProvided: (guestOwnerEdits: string[]) => boolean;
	/** Extract override metadata (userID + timestamp) from the facts API response */
	getFieldOverride?: (data: any) => FieldOverrideInfo | null;
	/** Custom renderer function (for special cases like website with external link) */
	customRenderer?: (props: FieldRenderProps) => ReactNode;
	/** Additional props for EditableField */
	additionalProps?: Record<string, any>;
}

/**
 * Custom renderer for website field that shows ExternalLink icon when value exists
 */
const renderWebsiteField = (props: FieldRenderProps): ReactNode => {
	const {
		fieldConfig,
		originalValue,
		loading,
		canEdit,
		saveStatus,
		handleEditComplete,
		suggestionGroups,
		skeletonWidth,
	} = props;

	if (loading) {
		return (
			<div
				className={`h-4 ${skeletonWidth} bg-gray-200 animate-pulse rounded`}
			/>
		);
	}

	const formattedValue = fieldConfig.formatDisplayValue
		? fieldConfig.formatDisplayValue(originalValue)
		: originalValue || VALUE_NOT_AVAILABLE;

	// Get validation rules for this field
	const validationRules = getFieldValidationRules(
		fieldConfig.fieldKey as any,
	);

	// If field is editable, show EditableField with ExternalLink icon when value exists
	if (canEdit) {
		const hasValidValue =
			originalValue &&
			originalValue !== VALUE_NOT_AVAILABLE &&
			originalValue.trim() !== "";

		return (
			<div className="flex items-center gap-2">
				<EditableField
					name={fieldConfig.fieldKey as any}
					inputType={fieldConfig.inputType ?? "text"}
					onEditComplete={handleEditComplete}
					editingEnabled={canEdit}
					saveStatus={saveStatus}
					placeholder={fieldConfig.placeholder}
					label={
						typeof fieldConfig.label === "string"
							? fieldConfig.label
							: "Website"
					}
					suggestionGroups={suggestionGroups}
					suggestions={fieldConfig.suggestions}
					formatDisplayValue={fieldConfig.formatDisplayValue}
					originalValue={originalValue}
					rules={validationRules}
					isLoading={loading}
					skeletonWidth={skeletonWidth}
					{...fieldConfig.additionalProps}
				/>
				{hasValidValue && (
					<ExternalLink href={formatUrl(originalValue)}>
						{""}
					</ExternalLink>
				)}
			</div>
		);
	}

	// Read-only mode
	if (
		formattedValue !== VALUE_NOT_AVAILABLE &&
		formattedValue.trim() !== ""
	) {
		return (
			<ExternalLink href={formatUrl(originalValue)}>
				{formattedValue.length > 50
					? `${formattedValue.slice(0, 50)}...`
					: formattedValue}
			</ExternalLink>
		);
	}

	return <span className="text-sm text-gray-900">{VALUE_NOT_AVAILABLE}</span>;
};

/**
 * Field configurations for WebsiteTab.
 */
export const WEBSITE_TAB_FIELD_CONFIGS: FieldConfig[] = [
	{
		fieldKey: "website",
		label: "Website",
		section: "websiteDetails",
		loadingStateKey: "websiteDetails",
		skeletonWidth: "w-64",
		inputType: "text",
		editable: true,
		placeholder: "Enter website URL",
		suggestionKey: "website",
		formatDisplayValue: (val: string) => {
			if (!val || val === VALUE_NOT_AVAILABLE) {
				return VALUE_NOT_AVAILABLE;
			}
			return formatUrl(val);
		},
		getOriginalValue: (ov) => ov.website || "",
		getInternallyProvided: (goe) => goe.includes("official_website"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.website),
		customRenderer: renderWebsiteField,
	},
];

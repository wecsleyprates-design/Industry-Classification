import type { ReactNode } from "react";
import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import type {
	SuggestionGroup,
	SuggestionOption,
} from "@/components/EditableField";
import {
	extractOverride,
	type FieldOverrideInfo,
} from "../../../../components/fieldSource.utils";
import {
	formatFormationDateWithAge,
	getCurrencyDisplayValue,
} from "../../../../utils/fieldFormatters";
import {
	CORPORATION_TYPE_OPTIONS,
	YES_NO_NA_OPTIONS,
} from "../../constants/fieldOptions";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Tooltip } from "@/ui/tooltip";

export type { FieldOverrideInfo };

export type FieldInputType =
	| "text"
	| "number"
	| "dropdown"
	| "date"
	| "address";
export type LoadingStateKey =
	| "businessDetails"
	| "businessApi"
	| "kyb"
	| "financials"
	| "verification"
	| "npi";

export interface FieldConfig {
	/** Unique field key for API */
	fieldKey: string;
	/** Display label (can be ReactNode for tooltips) */
	label: string | ReactNode;
	/** Which section this field belongs to */
	section: "businessDetails" | "industry";
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
	/** Custom renderer function (for special cases like phone) */
	customRenderer?: (props: FieldRenderProps) => ReactNode;
	/** Function to get original value from data */
	getOriginalValue: (originalValues: any, data?: any) => string;
	/** Function to get display value for read-only fields */
	getDisplayValue?: (data: any) => string | ReactNode;
	/** Function to check if field is internally provided */
	getInternallyProvided: (guestOwnerEdits: string[]) => boolean;
	/** Extract override metadata (userID + timestamp) from the facts API response */
	getFieldOverride?: (data: any) => FieldOverrideInfo | null;
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
	countryCode?: string;
	phoneNumber?: string | null;
	skeletonWidth: string;
}

/**
 * Field configurations for BackgroundTab.
 * Adding a new field = adding one entry here.
 */
export const BACKGROUND_TAB_FIELD_CONFIGS: FieldConfig[] = [
	// Business Details Section
	{
		fieldKey: "business_name",
		label: "Provided Business Name",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-48",
		inputType: "text",
		editable: true,
		placeholder: "Enter business name",
		suggestionKey: "business_name",
		getOriginalValue: (ov) => ov.businessName || "",
		getInternallyProvided: (goe) => goe.includes("name"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.business_name),
	},
	{
		fieldKey: "legal_name",
		label: "Legal Business Name",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-52",
		editable: false,
		getDisplayValue: (data) =>
			data?.getFactsKybData?.data?.legal_name?.value ??
			VALUE_NOT_AVAILABLE,
		getOriginalValue: () => "",
		getInternallyProvided: (goe) => goe.includes("legal_name"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.legal_name),
	},
	{
		fieldKey: "dba",
		label: "DBA",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-32",
		inputType: "text",
		editable: true,
		placeholder: "Enter DBA",
		suggestionKey: "dba",
		getOriginalValue: (ov) => ov.dba || "",
		getInternallyProvided: (goe) => goe.includes("dba_names"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.dba),
	},
	{
		fieldKey: "primary_address",
		label: "Business Address",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-72",
		inputType: "address",
		editable: true,
		placeholder: "Enter business address",
		suggestionKey: "primary_address",
		getOriginalValue: (ov) => ov.businessAddress || "",
		getInternallyProvided: (goe) =>
			[
				"address_line_1",
				"address_city",
				"address_postal_code",
				"address_state",
				"address_line_2",
				"address_country",
			].some((e) => goe.includes(e)),
		getFieldOverride: (data) =>
			extractOverride(
				data?.factsBusinessDetails?.data?.primary_address_string,
			),
		additionalProps: { showSuggestionIcon: true },
	},
	{
		fieldKey: "mailing_address",
		label: "Mailing Address",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-64",
		inputType: "address",
		editable: true,
		placeholder: "Enter mailing address",
		suggestionKey: "mailing_address",
		getOriginalValue: (ov) => ov.mailingAddress || "",
		getInternallyProvided: (goe) =>
			[
				"mailing_address.line_1",
				"mailing_address.apartment",
				"mailing_address.city",
				"mailing_address.state",
				"mailing_address.postal_code",
				"mailing_address.country",
			].some((e) => goe.includes(e)),
		getFieldOverride: (data) =>
			extractOverride(
				data?.factsBusinessDetails?.data?.mailing_address_strings,
			),
		additionalProps: { showSuggestionIcon: true },
	},
	{
		fieldKey: "formation_date",
		label: "Business Age",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-24",
		inputType: "date",
		editable: true,
		placeholder: "Enter formation date",
		getOriginalValue: (ov) => ov.formationDate || "",
		formatDisplayValue: (val: string) =>
			val ? formatFormationDateWithAge(val) : VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("formation_date"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.formation_date),
	},
	{
		fieldKey: "revenue",
		label: (
			<Tooltip
				trigger={
					<span className="flex flex-row items-center gap-1">
						{"Annual Revenue"}
						<InformationCircleIcon className="text-gray-800 size-4" />
					</span>
				}
				content="This value is generated using the most reputable source available for this business."
			/>
		),
		section: "businessDetails",
		loadingStateKey: "financials",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter annual revenue (e.g. 25000)",
		suggestionKey: "revenue",
		getOriginalValue: (ov) => ov.annualRevenue || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
		getInternallyProvided: () => false,
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsFinancialsData?.data?.revenue),
	},
	{
		fieldKey: "revenue_equally_weighted_average",
		label: (
			<Tooltip
				trigger={
					<span className="flex flex-row items-center gap-1">
						{"Avg. Annual Revenue"}
						<InformationCircleIcon className="text-gray-800 size-4" />
					</span>
				}
				content="This value is generated using the most reputable source available for this business."
			/>
		),
		section: "businessDetails",
		loadingStateKey: "financials",
		skeletonWidth: "w-28",
		editable: false,
		getDisplayValue: (data) =>
			getCurrencyDisplayValue(
				data?.getFactsFinancialsData?.data
					?.revenue_equally_weighted_average?.value,
			),
		getOriginalValue: () => "",
		getInternallyProvided: () => false,
		getFieldOverride: (data) =>
			extractOverride(
				data?.getFactsFinancialsData?.data
					?.revenue_equally_weighted_average,
			),
	},
	{
		fieldKey: "net_income",
		label: "Net Income",
		section: "businessDetails",
		loadingStateKey: "financials",
		skeletonWidth: "w-28",
		inputType: "text",
		editable: true,
		placeholder: "Enter net income (e.g. 25000)",
		suggestionKey: "net_income",
		getOriginalValue: (ov) => ov.netIncome || "",
		formatDisplayValue: (val: string) =>
			val ? getCurrencyDisplayValue(val) : VALUE_NOT_AVAILABLE,
		getInternallyProvided: () => false,
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsFinancialsData?.data?.net_income),
	},
	{
		fieldKey: "corporation",
		label: "Corporation Type",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-32",
		inputType: "dropdown",
		editable: true,
		suggestions: CORPORATION_TYPE_OPTIONS,
		suggestionKey: "corporation",
		getOriginalValue: (ov) => ov.corporationType || "",
		getInternallyProvided: (goe) => goe.includes("corporation_type"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.corporation),
	},
	{
		fieldKey: "num_employees",
		label: "Number of Employees",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-20",
		inputType: "text",
		editable: true,
		placeholder: "Enter number of employees",
		suggestionKey: "num_employees",
		getOriginalValue: (ov) => ov.numEmployees || "",
		// Show "N/A" for empty values in display mode, but allow empty during editing
		formatDisplayValue: (val: string) => val || VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("number_of_employees"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.num_employees),
	},
	{
		fieldKey: "business_phone",
		label: "Business Phone Number",
		section: "businessDetails",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-32",
		inputType: "text",
		editable: true,
		placeholder: "e.g. (800) 123-4567 or +18001234567",
		suggestionKey: "business_phone",
		getOriginalValue: (ov) => ov.phoneNumber || "",
		getInternallyProvided: (goe) =>
			["business_phone", "mobile"].some((e) => goe.includes(e)),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.business_phone),
	},
	{
		fieldKey: "email",
		label: "Business Email",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-40",
		inputType: "text",
		editable: true,
		placeholder: "Enter business email",
		getOriginalValue: (ov) => ov.businessEmail || "",
		getInternallyProvided: (goe) => goe.includes("email"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.email),
	},
	{
		fieldKey: "minority_owned",
		label: "Minority Business Enterprise",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-16",
		inputType: "dropdown",
		editable: true,
		suggestions: YES_NO_NA_OPTIONS,
		getOriginalValue: (ov) => ov.minorityOwned || VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("minority_owned"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.minority_owned),
	},
	{
		fieldKey: "woman_owned",
		label: "Woman-Owned Business",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-16",
		inputType: "dropdown",
		editable: true,
		suggestions: YES_NO_NA_OPTIONS,
		getOriginalValue: (ov) => ov.womanOwned || VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("woman_owned"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.woman_owned),
	},
	{
		fieldKey: "veteran_owned",
		label: "Veteran-Owned Business",
		section: "businessDetails",
		loadingStateKey: "kyb",
		skeletonWidth: "w-16",
		inputType: "dropdown",
		editable: true,
		suggestions: YES_NO_NA_OPTIONS,
		getOriginalValue: (ov) => ov.veteranOwned || VALUE_NOT_AVAILABLE,
		getInternallyProvided: (goe) => goe.includes("veteran_owned"),
		getFieldOverride: (data) =>
			extractOverride(data?.getFactsKybData?.data?.veteran_owned),
	},
	// Industry Section
	{
		fieldKey: "industry",
		label: "Industry Name",
		section: "industry",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-40",
		inputType: "text",
		editable: true,
		placeholder: "Enter industry name",
		suggestionKey: "industry",
		getOriginalValue: (ov) => ov.industryName || "",
		getInternallyProvided: (goe) => goe.includes("industry"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.industry),
	},
	{
		fieldKey: "naics_code",
		label: "NAICS Code",
		section: "industry",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-20",
		inputType: "text",
		editable: true,
		placeholder: "Enter NAICS code",
		suggestionKey: "naics_code",
		getOriginalValue: (ov) => ov.naicsCode || "",
		getInternallyProvided: (goe) => goe.includes("naics_code"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.naics_code),
	},
	{
		fieldKey: "naics_description",
		label: "NAICS Description",
		section: "industry",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-48",
		editable: false,
		getDisplayValue: (data) =>
			data?.factsBusinessDetails?.data?.naics_description?.value ??
			VALUE_NOT_AVAILABLE,
		getOriginalValue: () => "",
		getInternallyProvided: (goe) => goe.includes("naics_description"),
		getFieldOverride: (data) =>
			extractOverride(
				data?.factsBusinessDetails?.data?.naics_description,
			),
	},
	{
		fieldKey: "mcc_code",
		label: "MCC Code",
		section: "industry",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-20",
		inputType: "text",
		editable: true,
		placeholder: "Enter MCC code",
		suggestionKey: "mcc_code",
		getOriginalValue: (ov) => ov.mccCode || "",
		getInternallyProvided: (goe) => goe.includes("mcc_code"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.mcc_code),
	},
	{
		fieldKey: "mcc_description",
		label: "MCC Description",
		section: "industry",
		loadingStateKey: "businessDetails",
		skeletonWidth: "w-48",
		editable: false,
		getDisplayValue: (data) =>
			data?.factsBusinessDetails?.data?.mcc_description?.value ??
			VALUE_NOT_AVAILABLE,
		getOriginalValue: () => "",
		getInternallyProvided: (goe) => goe.includes("mcc_description"),
		getFieldOverride: (data) =>
			extractOverride(data?.factsBusinessDetails?.data?.mcc_description),
	},
];

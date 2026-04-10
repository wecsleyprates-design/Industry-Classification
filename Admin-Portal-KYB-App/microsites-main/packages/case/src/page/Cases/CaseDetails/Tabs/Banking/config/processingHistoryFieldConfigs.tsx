import type { ProcessingHistoryFormValues } from "../schemas/processingHistorySchema";

import { VALUE_NOT_AVAILABLE } from "@/constants/ValueConstants";
import { formatCurrency } from "@/helpers/formatCurrency";

export type ProcessingHistorySection =
	| "general"
	| "seasonal"
	| "card"
	| "amex"
	| "pointOfSale";

export interface ProcessingHistoryFieldConfig {
	/** Unique field key for form */
	fieldKey: keyof ProcessingHistoryFormValues;
	/** Display label */
	label: string;
	/** Which section this field belongs to */
	section: ProcessingHistorySection;
	/** Input type for editable fields */
	inputType?: "number" | "text";
	/** Placeholder text */
	placeholder?: string;
	/** Format function for display value */
	formatDisplayValue?: (value: string) => string;
	/** Custom renderer component name (for special cases like MultiSelectMonthsField) */
	customRenderer?: "multiSelectMonths";
	/** Additional props for EditableField */
	additionalProps?: Record<string, any>;
	/** API field mapping - maps form field to API payload structure */
	apiMapping: {
		/** Path in API payload (e.g., "general_data.annual_volume") */
		path: string[];
		/** Transform function to convert form value to API value */
		transform?: (value: string | string[]) => any;
	};
}

/**
 * Field configurations for Processing History.
 * Adding a new field = adding one entry here.
 */
export const PROCESSING_HISTORY_FIELD_CONFIGS: ProcessingHistoryFieldConfig[] =
	[
		// General Section
		{
			fieldKey: "general_annual_volume",
			label: "Annual Volume",
			section: "general",
			inputType: "number",
			placeholder: "Enter annual volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["general_data", "annual_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "general_monthly_volume",
			label: "Monthly Volume",
			section: "general",
			inputType: "number",
			placeholder: "Enter monthly volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["general_data", "monthly_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "general_average_volume",
			label: "Average Volume",
			section: "general",
			inputType: "number",
			placeholder: "Enter average volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["general_data", "average_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "general_high_ticket",
			label: "High Ticket",
			section: "general",
			inputType: "number",
			placeholder: "Enter high ticket...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["general_data", "high_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "general_desired_limit",
			label: "Desired Limit",
			section: "general",
			inputType: "number",
			placeholder: "Enter desired limit...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["general_data", "desired_limit"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		// Seasonal Section
		{
			fieldKey: "seasonal_high_volume_months",
			label: "High Volume Months",
			section: "seasonal",
			customRenderer: "multiSelectMonths",
			apiMapping: {
				path: ["seasonal_data", "high_volume_months"],
			},
		},
		{
			fieldKey: "seasonal_explanation_of_high_volume_months",
			label: "Explanation of High Volume Months",
			section: "seasonal",
			inputType: "text",
			placeholder: "Enter explanation...",
			formatDisplayValue: (value) => value || VALUE_NOT_AVAILABLE,
			apiMapping: {
				path: ["seasonal_data", "explanation_of_high_volume_months"],
			},
		},
		// Visa/Mastercard/Discover Section
		{
			fieldKey: "card_annual_volume",
			label: "Annual Volume",
			section: "card",
			inputType: "number",
			placeholder: "Enter annual volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["visa_mastercard_discover", "annual_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "card_monthly_volume",
			label: "Monthly Volume",
			section: "card",
			inputType: "number",
			placeholder: "Enter monthly volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["visa_mastercard_discover", "monthly_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "card_average_volume",
			label: "Average Volume",
			section: "card",
			inputType: "number",
			placeholder: "Enter average volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["visa_mastercard_discover", "average_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "card_high_ticket",
			label: "High Ticket",
			section: "card",
			inputType: "number",
			placeholder: "Enter high ticket...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["visa_mastercard_discover", "high_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "card_desired_limit",
			label: "Desired Limit",
			section: "card",
			inputType: "number",
			placeholder: "Enter desired limit...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["visa_mastercard_discover", "desired_limit"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		// American Express Section
		{
			fieldKey: "amex_annual_volume",
			label: "Annual Volume",
			section: "amex",
			inputType: "number",
			placeholder: "Enter annual volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["american_express", "annual_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "amex_monthly_volume",
			label: "Monthly Volume",
			section: "amex",
			inputType: "number",
			placeholder: "Enter monthly volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["american_express", "monthly_volume"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "amex_average_volume",
			label: "Average Volume",
			section: "amex",
			inputType: "number",
			placeholder: "Enter average volume...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["american_express", "average_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "amex_high_ticket",
			label: "High Ticket",
			section: "amex",
			inputType: "number",
			placeholder: "Enter high ticket...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["american_express", "high_ticket_size"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "amex_desired_limit",
			label: "Desired Limit",
			section: "amex",
			inputType: "number",
			placeholder: "Enter desired limit...",
			formatDisplayValue: (value) => formatCurrency(Number(value) || 0),
			additionalProps: { min: 0, step: 0.01 },
			apiMapping: {
				path: ["american_express", "desired_limit"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		// Point of Sale Volume
		{
			fieldKey: "pos_card_swiped",
			label: "Card (Swiped)",
			section: "pointOfSale",
			inputType: "number",
			placeholder: "Enter percentage...",
			formatDisplayValue: (value) => `${Number(value) || 0}%`,
			additionalProps: { min: 0, max: 100, step: 0.01 },
			apiMapping: {
				path: ["point_of_sale_volume", "swiped_cards"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "pos_card_typed",
			label: "Card (Typed)",
			section: "pointOfSale",
			inputType: "number",
			placeholder: "Enter percentage...",
			formatDisplayValue: (value) => `${Number(value) || 0}%`,
			additionalProps: { min: 0, max: 100, step: 0.01 },
			apiMapping: {
				path: ["point_of_sale_volume", "typed_cards"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "pos_ecommerce",
			label: "eCommerce",
			section: "pointOfSale",
			inputType: "number",
			placeholder: "Enter percentage...",
			formatDisplayValue: (value) => `${Number(value) || 0}%`,
			additionalProps: { min: 0, max: 100, step: 0.01 },
			apiMapping: {
				path: ["point_of_sale_volume", "e_commerce"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
		{
			fieldKey: "pos_mail_telephone",
			label: "Mail & Telephone",
			section: "pointOfSale",
			inputType: "number",
			placeholder: "Enter percentage...",
			formatDisplayValue: (value) => `${Number(value) || 0}%`,
			additionalProps: { min: 0, max: 100, step: 0.01 },
			apiMapping: {
				path: ["point_of_sale_volume", "mail_telephone"],
				transform: (value) => (value ? Number(value) : undefined),
			},
		},
	];

/**
 * Get field configs for a specific section
 */
export function getFieldConfigsForSection(
	section: ProcessingHistorySection,
): ProcessingHistoryFieldConfig[] {
	return PROCESSING_HISTORY_FIELD_CONFIGS.filter(
		(config) => config.section === section,
	);
}

/**
 * Get field config by field key
 */
export function getFieldConfigByKey(
	fieldKey: keyof ProcessingHistoryFormValues,
): ProcessingHistoryFieldConfig | undefined {
	return PROCESSING_HISTORY_FIELD_CONFIGS.find(
		(config) => config.fieldKey === fieldKey,
	);
}

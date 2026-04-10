import type { ProcessingHistoryData } from "@/types/integrations";
import { PROCESSING_HISTORY_FIELD_CONFIGS } from "../config/processingHistoryFieldConfigs";

/**
 * Form field keys for Processing History
 */
export type ProcessingHistoryFieldKey =
	// General Section
	| "general_annual_volume"
	| "general_monthly_volume"
	| "general_average_volume"
	| "general_high_ticket"
	| "general_desired_limit"
	// Seasonal Section
	| "seasonal_high_volume_months"
	| "seasonal_explanation_of_high_volume_months"
	// Visa/Mastercard/Discover Section
	| "card_annual_volume"
	| "card_monthly_volume"
	| "card_average_volume"
	| "card_high_ticket"
	| "card_desired_limit"
	// American Express Section
	| "amex_annual_volume"
	| "amex_monthly_volume"
	| "amex_average_volume"
	| "amex_high_ticket"
	| "amex_desired_limit"
	// Point of Sale Volume
	| "pos_card_swiped"
	| "pos_card_typed"
	| "pos_ecommerce"
	| "pos_mail_telephone";

/**
 * Form values for Processing History
 */
export interface ProcessingHistoryFormValues {
	// General Section
	general_annual_volume: string;
	general_monthly_volume: string;
	general_average_volume: string;
	general_high_ticket: string;
	general_desired_limit: string;
	// Seasonal Section
	seasonal_high_volume_months: string[];
	seasonal_explanation_of_high_volume_months: string;
	// Visa/Mastercard/Discover Section
	card_annual_volume: string;
	card_monthly_volume: string;
	card_average_volume: string;
	card_high_ticket: string;
	card_desired_limit: string;
	// American Express Section
	amex_annual_volume: string;
	amex_monthly_volume: string;
	amex_average_volume: string;
	amex_high_ticket: string;
	amex_desired_limit: string;
	// Point of Sale Volume
	pos_card_swiped: string;
	pos_card_typed: string;
	pos_ecommerce: string;
	pos_mail_telephone: string;
}

/**
 * Default form values
 */
export const defaultProcessingHistoryValues: ProcessingHistoryFormValues = {
	general_annual_volume: "",
	general_monthly_volume: "",
	general_average_volume: "",
	general_high_ticket: "",
	general_desired_limit: "",
	seasonal_high_volume_months: [],
	seasonal_explanation_of_high_volume_months: "",
	card_annual_volume: "",
	card_monthly_volume: "",
	card_average_volume: "",
	card_high_ticket: "",
	card_desired_limit: "",
	amex_annual_volume: "",
	amex_monthly_volume: "",
	amex_average_volume: "",
	amex_high_ticket: "",
	amex_desired_limit: "",
	pos_card_swiped: "",
	pos_card_typed: "",
	pos_ecommerce: "",
	pos_mail_telephone: "",
};

/**
 * Convert ProcessingHistoryData to form values
 */
export function mapProcessingHistoryToFormValues(
	data: ProcessingHistoryData | undefined,
): ProcessingHistoryFormValues {
	if (!data) {
		return defaultProcessingHistoryValues;
	}

	return {
		// General Section
		general_annual_volume: String(data.general_data?.annual_volume ?? ""),
		general_monthly_volume: String(data.general_data?.monthly_volume ?? ""),
		general_average_volume: String(
			data.general_data?.average_ticket_size ?? "",
		),
		general_high_ticket: String(data.general_data?.high_ticket_size ?? ""),
		general_desired_limit: String(data.general_data?.desired_limit ?? ""),
		// Seasonal Section
		seasonal_high_volume_months:
			data.seasonal_data?.high_volume_months ?? [],
		seasonal_explanation_of_high_volume_months:
			data.seasonal_data?.explanation_of_high_volume_months ?? "",
		// Visa/Mastercard/Discover Section
		card_annual_volume: String(data.card_data?.annual_volume ?? ""),
		card_monthly_volume: String(data.card_data?.monthly_volume ?? ""),
		card_average_volume: String(data.card_data?.average_ticket_size ?? ""),
		card_high_ticket: String(data.card_data?.high_ticket_size ?? ""),
		card_desired_limit: String(data.card_data?.desired_limit ?? ""),
		// American Express Section
		amex_annual_volume: String(
			data.american_express_data?.annual_volume ?? "",
		),
		amex_monthly_volume: String(
			data.american_express_data?.monthly_volume ?? "",
		),
		amex_average_volume: String(
			data.american_express_data?.average_ticket_size ?? "",
		),
		amex_high_ticket: String(
			data.american_express_data?.high_ticket_size ?? "",
		),
		amex_desired_limit: String(
			data.american_express_data?.desired_limit ?? "",
		),
		// Point of Sale Volume
		pos_card_swiped: String(data.point_of_sale_data?.swiped_cards ?? ""),
		pos_card_typed: String(data.point_of_sale_data?.typed_cards ?? ""),
		pos_ecommerce: String(data.point_of_sale_data?.e_commerce ?? ""),
		pos_mail_telephone: String(
			data.point_of_sale_data?.mail_telephone ?? "",
		),
	};
}

/**
 * Default API payload structure with all required sections
 * Database has NOT NULL constraints on these columns
 */
const DEFAULT_API_PAYLOAD = {
	general_data: {
		annual_volume: 0,
		monthly_volume: 0,
		average_ticket_size: 0,
		high_ticket_size: 0,
		desired_limit: 0,
	},
	seasonal_data: {
		high_volume_months: [] as string[],
		explanation_of_high_volume_months: "",
	},
	visa_mastercard_discover: {
		annual_volume: 0,
		monthly_volume: 0,
		average_ticket_size: 0,
		high_ticket_size: 0,
		desired_limit: 0,
	},
	american_express: {
		annual_volume: 0,
		monthly_volume: 0,
		average_ticket_size: 0,
		high_ticket_size: 0,
		desired_limit: 0,
	},
	point_of_sale_volume: {
		swiped_cards: 0,
		typed_cards: 0,
		e_commerce: 0,
		mail_telephone: 0,
	},
};

/**
 * Convert form values to API payload using field configurations
 * Always includes all sections with default values due to database NOT NULL constraints
 */
export function mapFormValuesToProcessingHistoryPayload(
	formValues: Partial<ProcessingHistoryFormValues>,
): Record<string, unknown> {
	// Start with default payload (deep clone to avoid mutations)
	const payload = JSON.parse(JSON.stringify(DEFAULT_API_PAYLOAD));

	// Iterate through all field configs and map form values to API payload
	PROCESSING_HISTORY_FIELD_CONFIGS.forEach((config) => {
		const formValue = formValues[config.fieldKey];
		if (formValue === undefined) {
			return;
		}

		// Get the API value (apply transform if provided, or use form value)
		let apiValue = config.apiMapping.transform
			? config.apiMapping.transform(formValue)
			: formValue;

		// For number fields, default undefined to 0
		if (apiValue === undefined && config.inputType === "number") {
			apiValue = 0;
		}

		// Skip if still undefined (shouldn't happen with defaults)
		if (apiValue === undefined) {
			return;
		}

		// Navigate to the nested path in the payload
		const [firstKey, ...restKeys] = config.apiMapping.path;
		if (!firstKey || !payload[firstKey]) {
			return;
		}

		// Set the value at the nested path
		let current = payload[firstKey];
		for (let i = 0; i < restKeys.length - 1; i++) {
			const key = restKeys[i];
			if (!current[key]) {
				current[key] = {};
			}
			current = current[key];
		}

		const finalKey = restKeys[restKeys.length - 1];
		if (finalKey) {
			current[finalKey] = apiValue;
		}
	});

	return payload;
}

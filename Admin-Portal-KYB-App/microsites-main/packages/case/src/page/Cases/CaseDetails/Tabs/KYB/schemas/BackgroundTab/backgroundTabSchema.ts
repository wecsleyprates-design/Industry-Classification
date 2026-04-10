/**
 * TypeScript interface for BackgroundTab form fields.
 * All fields are optional strings.
 */
export interface BackgroundTabFormValues {
	// Business Details Section
	business_name?: string;
	legal_name?: string;
	dba?: string;
	primary_address?: string;
	mailing_address?: string;
	formation_date?: string;
	revenue?: string;
	net_income?: string;
	corporation?: string;
	num_employees?: string;
	business_phone?: string;
	email?: string;
	minority_owned?: string;
	woman_owned?: string;
	veteran_owned?: string;

	// Industry Section
	industry?: string;
	naics_code?: string;
	mcc_code?: string;

	// NPI Section (if enabled)
	npi_number?: string;
}

/**
 * Field keys that map to the form schema.
 * Use these for type-safe field access.
 */
export type BackgroundTabFieldKey = keyof BackgroundTabFormValues;

/**
 * Default values for the form.
 * These will be overwritten by actual data when loaded.
 */
export const defaultBackgroundTabValues: BackgroundTabFormValues = {
	business_name: "",
	legal_name: "",
	dba: "",
	primary_address: "",
	mailing_address: "",
	formation_date: "",
	revenue: "",
	net_income: "",
	corporation: "",
	num_employees: "",
	business_phone: "",
	email: "",
	minority_owned: "",
	woman_owned: "",
	veteran_owned: "",
	industry: "",
	naics_code: "",
	mcc_code: "",
	npi_number: "",
};

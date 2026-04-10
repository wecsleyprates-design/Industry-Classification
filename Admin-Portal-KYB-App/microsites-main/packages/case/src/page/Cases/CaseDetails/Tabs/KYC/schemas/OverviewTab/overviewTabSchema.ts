/**
 * TypeScript interface for OverviewTab form fields.
 * All fields are optional strings.
 */
export interface OverviewTabFormValues {
	// Personal Information
	first_name?: string;
	last_name?: string;
	date_of_birth?: string;
	ssn?: string;
	home_address?: string;
	mobile?: string;
	email?: string;
	title?: string;
	ownership_percentage?: string;
}

/**
 * Field keys that map to the form schema.
 * Use these for type-safe field access.
 */
export type OverviewTabFieldKey = keyof OverviewTabFormValues;

/**
 * Default values for the form.
 * These will be overwritten by actual data when loaded.
 */
export const defaultOverviewTabValues: OverviewTabFormValues = {
	first_name: "",
	last_name: "",
	date_of_birth: "",
	ssn: "",
	home_address: "",
	mobile: "",
	email: "",
	title: "",
	ownership_percentage: "",
};

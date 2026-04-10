/**
 * TypeScript interface for BusinessRegistrationTab form fields.
 * All fields are optional strings.
 */
export interface BusinessRegistrationTabFormValues {
	// Business Registration Section
	business_name?: string;
	tin?: string;
}

/**
 * Field keys that map to the form schema.
 * Use these for type-safe field access.
 */
export type BusinessRegistrationTabFieldKey =
	keyof BusinessRegistrationTabFormValues;

/**
 * Default values for the form.
 * These will be overwritten by actual data when loaded.
 */
export const defaultBusinessRegistrationTabValues: BusinessRegistrationTabFormValues =
	{
		business_name: "",
		tin: "",
	};

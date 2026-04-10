/**
 * TypeScript interface for WebsiteTab form fields.
 * All fields are optional strings.
 */
export interface WebsiteTabFormValues {
	website?: string;
}

/**
 * Field keys that map to the form schema.
 * Use these for type-safe field access.
 */
export type WebsiteTabFieldKey = keyof WebsiteTabFormValues;

/**
 * Default values for the form.
 * These will be overwritten by actual data when loaded.
 */
export const defaultWebsiteTabValues: WebsiteTabFormValues = {
	website: "",
};

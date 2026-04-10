/**
 * TypeScript interface for PublicFilingsTab form fields.
 * All fields are optional strings.
 *
 * Note: Complaints section fields are NOT editable (display-only).
 * Only Judgements, Liens, and Bankruptcies sections are editable.
 */
export interface PublicFilingsTabFormValues {
	// Judgements Section
	num_judgements?: string;
	judgements_most_recent?: string;
	judgements_most_recent_status?: string;
	judgements_most_recent_amount?: string;
	judgements_total_amount?: string;

	// Liens Section
	num_liens?: string;
	liens_most_recent?: string;
	liens_most_recent_status?: string;
	liens_most_recent_amount?: string;
	liens_total_amount?: string;

	// Bankruptcies Section
	num_bankruptcies?: string;
	bankruptcies_most_recent?: string;
	bankruptcies_most_recent_status?: string;
}

/**
 * Field keys that map to the form schema.
 * Use these for type-safe field access.
 */
export type PublicFilingsTabFieldKey = keyof PublicFilingsTabFormValues;

/**
 * Default values for the form.
 * These will be overwritten by actual data when loaded.
 */
export const defaultPublicFilingsTabValues: PublicFilingsTabFormValues = {
	// Judgements Section
	num_judgements: "",
	judgements_most_recent: "",
	judgements_most_recent_status: "",
	judgements_most_recent_amount: "",
	judgements_total_amount: "",

	// Liens Section
	num_liens: "",
	liens_most_recent: "",
	liens_most_recent_status: "",
	liens_most_recent_amount: "",
	liens_total_amount: "",

	// Bankruptcies Section
	num_bankruptcies: "",
	bankruptcies_most_recent: "",
	bankruptcies_most_recent_status: "",
};

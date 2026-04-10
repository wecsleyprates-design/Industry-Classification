/**
 * Parent-child field relationships for the KYC Overview tab.
 *
 * When a parent field is updated, the child report sections become stale
 * since they are based on data that was verified with the original values.
 * These sections should show a "stale data" message until re-verification is run.
 *
 * Email Report: Stale when email or name fields are edited (email verification is stale)
 * Fraud Report: Stale when ANY overview field is edited (fraud checks are stale)
 */

/**
 * All editable fields in the KYC Overview section.
 * When any of these are edited, Fraud Report should be hidden.
 */
export const KYC_OVERVIEW_FIELDS = [
	"first_name",
	"last_name",
	"date_of_birth",
	"ssn",
	"home_address",
	"mobile",
	"email",
	"title",
	"ownership_percentage",
] as const;

export type KycOverviewField = (typeof KYC_OVERVIEW_FIELDS)[number];

/**
 * Fields that, when edited, should hide the Email Report.
 * Email verification depends on the owner's identity (name fields) and email address.
 */
export const EMAIL_REPORT_DEPENDENT_FIELDS: string[] = [
	"email",
	"first_name",
	"last_name",
];

/**
 * Fields that, when edited, should hide the Fraud Report.
 * (All KYC overview fields since fraud checks use all identity data)
 */
export const FRAUD_REPORT_DEPENDENT_FIELDS: string[] = [...KYC_OVERVIEW_FIELDS];

/**
 * Fields that, when edited, should invalidate identity verification (IDV).
 * IDV depends on core identity fields (name, DOB, SSN, address, phone).
 */
export const IDV_DEPENDENT_FIELDS: string[] = [
	"first_name",
	"last_name",
	"date_of_birth",
	"ssn",
	"home_address",
	"mobile",
];

/**
 * Check if identity verification should be marked as stale based on edited fields.
 * @param editedFacts - Array of edited field keys for the current case
 * @returns true if identity verification is stale
 */
export function shouldInvalidateIdv(editedFacts: string[]): boolean {
	return IDV_DEPENDENT_FIELDS.some((field) => editedFacts.includes(field));
}

/**
 * Check if the Email Report should be hidden based on edited fields.
 * @param editedFacts - Array of edited field keys for the current case
 * @returns true if Email Report should be hidden
 */
export function shouldHideEmailReport(editedFacts: string[]): boolean {
	return EMAIL_REPORT_DEPENDENT_FIELDS.some((field) =>
		editedFacts.includes(field),
	);
}

/**
 * Check if the Fraud Report should be hidden based on edited fields.
 * @param editedFacts - Array of edited field keys for the current case
 * @returns true if Fraud Report should be hidden
 */
export function shouldHideFraudReport(editedFacts: string[]): boolean {
	return FRAUD_REPORT_DEPENDENT_FIELDS.some((field) =>
		editedFacts.includes(field),
	);
}

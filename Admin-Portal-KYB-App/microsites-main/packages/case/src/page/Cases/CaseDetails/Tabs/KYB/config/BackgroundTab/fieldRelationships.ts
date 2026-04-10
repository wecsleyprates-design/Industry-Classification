/**
 * Parent-child field relationships for the Background tab.
 *
 * When a parent field is updated, the child fields' displayed values become stale
 * since they are calculated/derived from the parent. These child fields are read-only
 * display values (not editable form fields).
 *
 * Child values should be cleared/hidden until the page is refreshed and the API
 * returns the updated calculated values.
 */

/**
 * Map of parent field keys to their dependent child field keys.
 * Child fields are read-only display fields that depend on the parent's value.
 */
export const PARENT_CHILD_FIELD_MAP: Record<string, string[]> = {
	// Annual Revenue → Avg. Annual Revenue (calculated from revenue)
	revenue: ["revenue_equally_weighted_average"],

	// NAICS Code → NAICS Description
	naics_code: ["naics_description"],

	// MCC Code → MCC Description
	mcc_code: ["mcc_description"],

	// NPI Number → Provider, Status, Primary Taxonomy, License info, Last Updated
	// These are displayed in the NPI section, not field configs
	npi_number: [
		"npi_provider",
		"npi_status",
		"npi_primary_taxonomy",
		"npi_license_issuer",
		"npi_license_number",
		"npi_last_updated",
	],
};

/**
 * Get the list of child field keys for a given parent field.
 */
export function getChildFieldKeys(parentFieldKey: string): string[] {
	return PARENT_CHILD_FIELD_MAP[parentFieldKey] ?? [];
}

/**
 * Check if a field has dependent child fields.
 */
export function hasChildFields(fieldKey: string): boolean {
	return (PARENT_CHILD_FIELD_MAP[fieldKey]?.length ?? 0) > 0;
}

/**
 * Check if a field is a child of any parent field.
 */
export function isChildField(fieldKey: string): boolean {
	return Object.values(PARENT_CHILD_FIELD_MAP).some((children) =>
		children.includes(fieldKey),
	);
}

/**
 * Get the parent field key for a child field.
 */
export function getParentFieldKey(childFieldKey: string): string | undefined {
	for (const [parent, children] of Object.entries(PARENT_CHILD_FIELD_MAP)) {
		if (children.includes(childFieldKey)) {
			return parent;
		}
	}
	return undefined;
}

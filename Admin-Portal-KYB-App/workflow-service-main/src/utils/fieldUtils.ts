/**
 * Helper function to check if a field path starts with a specific prefix
 * @param fieldPath - The full field path to check
 * @param prefix - The prefix to check against
 * @returns True if the field path starts with the prefix
 */
export function hasFieldPrefix(fieldPath: string, prefix: string): boolean {
	return fieldPath.startsWith(`${prefix}.`);
}

/**
 * Helper function to extract the field name from a prefixed field path
 * @param fieldPath - The full field path (e.g., "facts.score" or "custom_fields.currency")
 * @param prefix - The prefix to remove (e.g., FIELD_PREFIXES.FACTS)
 * @returns The field name without the prefix (e.g., "score" or "currency")
 */
export function extractFieldName(fieldPath: string, prefix: string): string {
	return fieldPath.replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`), "");
}

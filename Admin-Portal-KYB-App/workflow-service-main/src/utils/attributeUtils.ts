/**
 * Extracts the attribute name from the full path
 * @param path - Full path (e.g., "facts.credit_score")
 * @param source - Source prefix (e.g., "facts")
 * @returns Attribute name without source prefix (e.g., "credit_score")
 */
export function extractAttributeName(path: string, source: string): string {
	if (path.startsWith(`${source}.`)) {
		return path.substring(source.length + 1);
	}
	return path;
}

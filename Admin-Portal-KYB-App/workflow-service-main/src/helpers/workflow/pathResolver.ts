/**
 * Resolve path to value. If path contains [*], resolve to array of values (one per element).
 */
const ARRAY_SEGMENT = "[*]";

export function getFactName(pathAfterFactsPrefix: string): string {
	const firstSegment = pathAfterFactsPrefix.split(".")[0] ?? "";
	return firstSegment.replace(ARRAY_SEGMENT, "");
}

function getByPath(obj: unknown, path: string): unknown {
	return path.split(".").reduce((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}

export function getValueByPathSupportingArray(obj: unknown, path: string): unknown {
	if (!path.includes(ARRAY_SEGMENT)) {
		return getByPath(obj, path);
	}
	const parts = path.split(".");
	// [*] may be a standalone segment or appended (e.g. "owner_verification[*]")
	const idx = parts.findIndex(p => p.includes(ARRAY_SEGMENT));
	if (idx < 0) return getByPath(obj, path);
	const segmentWithWildcard = parts[idx];
	const keyWithoutWildcard = segmentWithWildcard.replace(ARRAY_SEGMENT, "");
	const prefixPath = [...parts.slice(0, idx), keyWithoutWildcard].filter(Boolean).join(".");
	const suffixPath = parts.slice(idx + 1).join(".");
	const collection = getByPath(obj, prefixPath);
	if (collection === undefined || collection === null) return undefined;
	const items = Array.isArray(collection) ? collection : Object.values(collection as object);
	if (!Array.isArray(items)) return undefined;
	return items.map(item => (suffixPath ? getByPath(item, suffixPath) : item));
}

export function pathIsArray(path: string): boolean {
	return path.includes(ARRAY_SEGMENT);
}

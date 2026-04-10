/**
 * Date Normalizer Helper
 * Converts ISO 8601 date strings to timestamps for consistent comparison in JSON Logic
 */

/**
 * Regex patterns for detecting ISO 8601 date strings
 * Matches:
 * - "2024-06-24T00:00:00.000Z" (full ISO with milliseconds)
 * - "2024-06-24T00:00:00Z" (ISO without milliseconds)
 * - "2024-06-24T00:00:00" (ISO without timezone)
 * - "2024-06-24" (date only)
 */
const ISO_DATE_FULL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
const ISO_DATE_SHORT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks if a string is a valid ISO 8601 date format
 * @param value - The value to check
 * @returns true if the value is a valid ISO date string
 */
export function isISODateString(value: unknown): value is string {
	if (typeof value !== "string") {
		return false;
	}
	return ISO_DATE_FULL_REGEX.test(value) || ISO_DATE_SHORT_REGEX.test(value);
}

/**
 * Converts an ISO date string to a timestamp (milliseconds since epoch)
 * @param dateString - The ISO date string to convert
 * @returns The timestamp in milliseconds, or null if invalid
 */
export function dateStringToTimestamp(dateString: string): number | null {
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			return null;
		}
		return date.getTime();
	} catch {
		return null;
	}
}

/**
 * Normalizes a value by converting ISO date strings to timestamps
 * @param value - The value to normalize
 * @returns The normalized value (timestamp if date, original otherwise)
 */
export function normalizeValue(value: unknown): unknown {
	if (isISODateString(value)) {
		const timestamp = dateStringToTimestamp(value);
		return timestamp ?? value;
	}
	return value;
}

/**
 * Recursively normalizes all ISO date strings in an object to timestamps
 * Handles nested objects and arrays
 * @param obj - The object to normalize
 * @returns A new object with all date strings converted to timestamps
 */
export function normalizeDatesInObject(obj: unknown): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (isISODateString(obj)) {
		const timestamp = dateStringToTimestamp(obj);
		return timestamp ?? obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(item => normalizeDatesInObject(item));
	}

	if (typeof obj === "object") {
		const normalized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			normalized[key] = normalizeDatesInObject(value);
		}
		return normalized;
	}

	return obj;
}

/**
 * Normalizes facts data from warehouse by converting all date strings to timestamps
 * @param facts - The facts object from warehouse
 * @returns Facts with all date strings converted to timestamps
 */
export function normalizeFacts(facts: Record<string, unknown>): Record<string, unknown> {
	return normalizeDatesInObject(facts) as Record<string, unknown>;
}

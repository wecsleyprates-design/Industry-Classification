/**
 * Safely converts any value to a JSON string, handling edge cases
 * @param value - The value to stringify
 * @returns A string representation of the value
 */
export function safeStringify(value: unknown): string {
	try {
		const result = JSON.stringify(value);
		return result || String(value);
	} catch {
		return String(value);
	}
}

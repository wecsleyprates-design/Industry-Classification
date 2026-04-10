/**
 * Custom JSON Logic operators
 * Registers additional operators not included in the standard json-logic-js library
 */

import jsonLogic from "json-logic-js";

/**
 * Initializes custom JSON Logic operators
 * Should be called once at application startup before any json-logic-js evaluation
 *
 */
export function initializeJsonLogic(): void {
	/**
	 * Contains operator
	 * Checks if a container (string or array) contains an item
	 *
	 * @param container - The container to search in (string or array)
	 * @param item - The item to search for
	 * @returns true if container contains item, false otherwise
	 *
	 * Examples:
	 * - {"contains": ["hello world", "world"]} → true
	 * - {"contains": [["a", "b", "c"], "b"]} → true
	 * - {"contains": ["hello", "xyz"]} → false
	 * - {"contains": [null, "test"]} → false
	 * - {"contains": ["test", null]} → false
	 */
	jsonLogic.add_operation("contains", function (container: unknown, item: unknown): boolean {
		if (container == null || item == null) {
			return false;
		}

		if (typeof container === "string" && typeof item === "string") {
			return container.includes(item);
		}

		if (Array.isArray(container)) {
			return container.includes(item);
		}

		return false;
	});

	/**
	 * Any equals operator
	 * Checks if any element in the array equals the value
	 *
	 * @param array - The array to search in
	 * @param value - The value to search for
	 * @returns true if any element equals the value, false otherwise
	 *
	 * Examples:
	 * - {"any_equals": [[1, 2, 3], 2]} → true
	 * - {"any_equals": [["a", "b"], "c"]} → false
	 * - {"any_equals": [null, "test"]} → false
	 * - {"any_equals": [[], "test"]} → false
	 */
	jsonLogic.add_operation("any_equals", function (array: unknown, value: unknown): boolean {
		if (!Array.isArray(array) || value == null) {
			return false;
		}

		return array.some(item => item === value);
	});

	/**
	 * Any contains operator
	 * Checks if any element in the array contains the value (for strings)
	 *
	 * @param array - The array to search in
	 * @param value - The value to search for
	 * @returns true if any element contains the value, false otherwise
	 *
	 * Examples:
	 * - {"any_contains": [["hello", "world"], "ell"]} → true
	 * - {"any_contains": [["abc", "def"], "xyz"]} → false
	 * - {"any_contains": [null, "test"]} → false
	 */
	jsonLogic.add_operation("any_contains", function (array: unknown, value: unknown): boolean {
		if (!Array.isArray(array) || value == null || typeof value !== "string") {
			return false;
		}

		return array.some(item => typeof item === "string" && item.includes(value));
	});

	/**
	 * Array intersects operator
	 * Checks if two arrays have any common elements
	 *
	 * @param array1 - The first array
	 * @param array2 - The second array
	 * @returns true if arrays have common elements, false otherwise
	 *
	 * Examples:
	 * - {"array_intersects": [[1, 2, 3], [2, 4, 5]]} → true
	 * - {"array_intersects": [[1, 2], [3, 4]]} → false
	 * - {"array_intersects": [null, [1, 2]]} → false
	 */
	jsonLogic.add_operation("array_intersects", function (array1: unknown, array2: unknown): boolean {
		if (!Array.isArray(array1) || !Array.isArray(array2)) {
			return false;
		}

		return array1.some(item => array2.includes(item));
	});

	/**
	 * Array length operator
	 * Compares the length of an array with a number
	 * Returns true if array length equals the value
	 *
	 * @param array - The array to check
	 * @param length - The expected length
	 * @returns true if array length equals the value, false otherwise
	 *
	 * Examples:
	 * - {"array_length": [[1, 2, 3], 3]} → true
	 * - {"array_length": [[1, 2], 3]} → false
	 * - {"array_length": [null, 0]} → false
	 */
	jsonLogic.add_operation("array_length", function (array: unknown, length: unknown): boolean {
		if (!Array.isArray(array) || typeof length !== "number") {
			return false;
		}

		return array.length === length;
	});

	/**
	 * Array is empty operator
	 * Checks if an array is empty
	 *
	 * @param array - The array to check
	 * @returns true if array is empty or null, false otherwise
	 *
	 * Examples:
	 * - {"array_is_empty": [[]]} → true
	 * - {"array_is_empty": [[1, 2]]} → false
	 * - {"array_is_empty": [null]} → true
	 */
	jsonLogic.add_operation("array_is_empty", function (array: unknown): boolean {
		return array == null || (Array.isArray(array) && array.length === 0);
	});

	/**
	 * Array is not empty operator
	 * Checks if an array is not empty
	 *
	 * @param array - The array to check
	 * @returns true if array has elements, false otherwise
	 *
	 * Examples:
	 * - {"array_is_not_empty": [[1, 2]]} → true
	 * - {"array_is_not_empty": [[]]} → false
	 * - {"array_is_not_empty": [null]} → false
	 */
	jsonLogic.add_operation("array_is_not_empty", function (array: unknown): boolean {
		return Array.isArray(array) && array.length > 0;
	});

	/**
	 * Regex match operator
	 * Tests if the field value (string) matches the given regex pattern.
	 * Returns false if the field value is not a string (null, number, etc.).
	 *
	 * @param fieldValue - The value to test (typically from data)
	 * @param pattern - The regex pattern string (e.g. "^[A-Z]{2}-\\d+$")
	 * @returns true if fieldValue is a string and matches the pattern, false otherwise
	 *
	 * Examples:
	 * - {"regex_match": ["AB-123", "^[A-Z]{2}-\\d+$"]} → true
	 * - {"regex_match": ["invalid", "^[A-Z]{2}-\\d+$"]} → false
	 * - {"regex_match": [null, "^.+$"]} → false
	 * - {"regex_match": [123, "^.+$"]} → false
	 */
	jsonLogic.add_operation("regex_match", function (fieldValue: unknown, pattern: unknown): boolean {
		if (typeof fieldValue !== "string" || typeof pattern !== "string") {
			return false;
		}
		try {
			const regex = new RegExp(pattern);
			return regex.test(fieldValue);
		} catch {
			return false;
		}
	});
}

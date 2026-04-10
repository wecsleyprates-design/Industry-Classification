/**
 * Custom Fields Transformer Helper
 * Transforms custom fields from Case Service format to evaluation-ready format
 * Handles checkbox arrays, dropdown objects, and other field types
 */

import { logger } from "./logger";

/**
 * Type guard to check if a value is a valid checkbox item object
 * @param item - The item to check
 * @returns True if item is a valid checkbox item object
 */
function isValidCheckboxItem(item: unknown): item is { checked?: boolean; label?: unknown } {
	return typeof item === "object" && item !== null;
}

/**
 * Validates and extracts label from a checkbox item
 * @param item - The checkbox item
 * @param fieldName - The field name for logging
 * @returns Trimmed label string or null if invalid
 */
function extractCheckboxLabel(item: { checked?: boolean; label?: unknown }, fieldName: string): string | null {
	if (!item.checked) {
		return null;
	}

	const label = item.label;
	if (label === undefined || label === null) {
		logger.warn(`Custom field ${fieldName}: checkbox item missing label, skipping`);
		return null;
	}

	if (typeof label !== "string") {
		logger.warn(`Custom field ${fieldName}: checkbox item label is not a string, skipping`);
		return null;
	}

	const trimmedLabel = label.trim();
	return trimmedLabel || null;
}

/**
 * Transforms a checkbox array field to an array of label strings
 * @param value - The checkbox array value
 * @param fieldName - The field name for logging
 * @returns Array of trimmed label strings, or null if array is empty
 */
function transformCheckboxArray(value: unknown[], fieldName: string): string[] | null {
	if (!Array.isArray(value) || value.length === 0) {
		return null;
	}

	const labels: string[] = [];

	for (const item of value) {
		if (!isValidCheckboxItem(item)) {
			logger.warn(`Custom field ${fieldName}: checkbox item is not an object, skipping`);
			continue;
		}

		const label = extractCheckboxLabel(item, fieldName);
		if (label) {
			labels.push(label);
		}
	}

	return labels.length > 0 ? labels : null;
}

/**
 * Transforms a dropdown field to a string label
 * @param value - The dropdown value (object with label or string "null")
 * @param fieldName - The field name for logging
 * @returns Trimmed label string, or null if invalid
 */
function transformDropdown(value: unknown, fieldName: string): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string" && value.toLowerCase() === "null") {
		return null;
	}

	if (typeof value === "object" && value !== null) {
		const label = (value as { label?: unknown }).label;
		if (label === undefined || label === null) {
			logger.warn(`Custom field ${fieldName}: dropdown missing label property, converting to null`);
			return null;
		}

		if (typeof label !== "string") {
			logger.warn(`Custom field ${fieldName}: dropdown label is not a string, converting to null`);
			return null;
		}

		return label.trim() || null;
	}

	if (typeof value === "string") {
		return value.trim() || null;
	}

	logger.warn(`Custom field ${fieldName}: dropdown has unexpected type, converting to null`);
	return null;
}

/**
 * Transforms custom fields from Case Service format to evaluation-ready format
 * @param customFields - The custom fields object from Case Service
 * @returns Transformed custom fields object ready for evaluation
 */
export function transformCustomFields(
	customFields: Record<string, unknown> | null | undefined
): Record<string, unknown> {
	if (!customFields || typeof customFields !== "object") {
		return {};
	}

	const transformed: Record<string, unknown> = {};

	for (const [fieldName, value] of Object.entries(customFields)) {
		if (value === null || value === undefined) {
			transformed[fieldName] = null;
			continue;
		}

		if (Array.isArray(value)) {
			const result = transformCheckboxArray(value, fieldName);
			transformed[fieldName] = result;
			continue;
		}

		if (typeof value === "string" && value.toLowerCase() === "null") {
			transformed[fieldName] = null;
			continue;
		}

		if (typeof value === "boolean") {
			transformed[fieldName] = [value];
			continue;
		}

		if (typeof value === "object" && value !== null) {
			if ("label" in value || "value" in value) {
				const result = transformDropdown(value, fieldName);
				transformed[fieldName] = result;
				continue;
			}

			logger.warn(`Custom field ${fieldName}: unexpected object type (not checkbox array or dropdown), keeping as-is`, {
				value
			});
			transformed[fieldName] = value;
			continue;
		}

		if (typeof value === "string") {
			transformed[fieldName] = value.trim();
			continue;
		}

		transformed[fieldName] = value;
	}

	return transformed;
}

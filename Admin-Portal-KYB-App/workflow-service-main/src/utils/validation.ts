import { Utils } from "@joinworth/types";

/**
 * Validation utilities using Zod schemas from @joinworth/types
 * Replaces custom validation constants with proper Zod validation
 */

/**
 * Validates if a string is not empty and has minimum length
 * @param value - The string to validate
 * @param minLength - Minimum length required (default: 1)
 * @returns boolean indicating if the string is valid
 */
export function isValidString(value: string, minLength: number = 1): boolean {
	if (!value?.trim().length) {
		return false;
	}
	const result = Utils.ValidationSchemas.string(minLength).safeParse(value);
	return result.success;
}

/**
 * Validates if a string is not empty (standardized pattern)
 * @param value - The string to validate
 * @returns boolean indicating if the string is not empty after trimming
 */
export function isNotEmptyString(value: string): boolean {
	return value != null && typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates if a string field is valid (not null, string type, and not empty after trim)
 * @param value - The value to validate
 * @returns boolean indicating if the value is a valid non-empty string
 */
export function isValidStringField(value: unknown): value is string {
	return value != null && typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates if a string is a valid UUID
 * @param value - The string to validate
 * @returns boolean indicating if the string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
	if (!uuid?.trim().length) {
		return false;
	}
	return Utils.Utils.isUUID(uuid.trim());
}

import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { AttributeDataType, AttributeSource } from "./types";

/**
 * Validates that a regex pattern is valid
 * @param regex - The regex pattern string to validate
 * @throws ApiError if regex is invalid
 */
export function validateRegex(regex: string | null): void {
	if (!regex) {
		return;
	}

	try {
		new RegExp(regex);
	} catch (error) {
		throw new ApiError(
			`Invalid regex pattern: ${regex}. ${error instanceof Error ? error.message : "Unknown error"}`,
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}
}

/**
 * Validates that a path matches its source prefix
 * @param path - The full attribute path (e.g., facts.credit_score)
 * @param source - The source prefix (e.g., facts)
 * @throws ApiError if path doesn't match source
 */
export function validatePathMatchesSource(path: string, source: AttributeSource): void {
	const expectedPrefix = `${source}.`;

	if (!path.startsWith(expectedPrefix)) {
		throw new ApiError(
			`Path "${path}" must start with "${expectedPrefix}" for source "${source}"`,
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}

	const attributeName = path.substring(expectedPrefix.length);
	if (attributeName?.trim().length === 0) {
		throw new ApiError(
			`Path "${path}" must have an attribute name after the source prefix`,
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}
}

/**
 * Validates all attribute catalog fields
 * @param attribute - The attribute data to validate
 * @throws ApiError if validation fails
 */
export function validateAttributeCatalogEntry(attribute: {
	source: AttributeSource;
	path: string;
	data_type: AttributeDataType;
	validation_regex?: string | null;
}): void {
	validatePathMatchesSource(attribute.path, attribute.source);

	if (attribute.validation_regex) {
		validateRegex(attribute.validation_regex);
	}
}

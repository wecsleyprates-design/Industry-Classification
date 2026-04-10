import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { isValidUUID } from "./validation";

/**
 * Validates if a string is a valid UUID format
 * @param value - The string to validate
 * @param fieldName - The name of the field for error messages
 * @returns The validated UUID string
 * @throws ApiError if validation fails
 */
export const validateUUID = (value: string, fieldName: string = "ID"): string => {
	if (!value || typeof value !== "string") {
		throw new ApiError(`${fieldName} is required and must be a string`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	const trimmedValue = value.trim();
	if (trimmedValue.length === 0) {
		throw new ApiError(`${fieldName} cannot be empty`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	// Use the Zod-based validation for consistent UUID checking
	if (!isValidUUID(trimmedValue)) {
		throw new ApiError(`${fieldName} must be a valid UUID format`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	return trimmedValue;
};

/**
 * Validates workflow ID specifically
 * @param workflowId - The workflow ID to validate
 * @returns The validated workflow ID
 * @throws ApiError if validation fails
 */
export const validateWorkflowId = (workflowId: string): string => {
	return validateUUID(workflowId, "Workflow ID");
};

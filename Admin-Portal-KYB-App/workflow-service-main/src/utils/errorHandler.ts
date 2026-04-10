import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import { ERROR_CODES } from "#constants";

/**
 * Centralized error handling utilities
 * Follows Single Responsibility Principle - only handles error operations
 */
export class ErrorHandler {
	/**
	 * Creates a standardized API error with proper logging
	 * @param message - Error message
	 * @param statusCode - HTTP status code
	 * @param errorCode - Application error code
	 * @param originalError - Original error for logging context
	 * @returns ApiError instance
	 */
	static createApiError(
		message: string,
		statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
		errorCode: keyof typeof ERROR_CODES = ERROR_CODES.UNKNOWN_ERROR,
		originalError?: unknown
	): ApiError {
		if (originalError) {
			logger.error({ err: originalError }, `API Error: ${message}`);
		}

		return new ApiError(message, statusCode, errorCode);
	}

	/**
	 * Handles database-related errors with appropriate status codes
	 * @param error - The original error
	 * @param operation - The operation that failed
	 * @returns ApiError with appropriate status code
	 */
	static handleDatabaseError(error: unknown, operation: string): ApiError {
		const errorMessage = error instanceof Error ? error.message : "Unknown database error";

		// Determine appropriate status code based on error type
		if (errorMessage.includes("timeout")) {
			return this.createApiError(
				`Database timeout during ${operation}`,
				StatusCodes.REQUEST_TIMEOUT,
				ERROR_CODES.UNKNOWN_ERROR,
				error
			);
		}

		if (errorMessage.includes("permission") || errorMessage.includes("access")) {
			return this.createApiError(
				`Database access denied during ${operation}`,
				StatusCodes.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED,
				error
			);
		}

		if (errorMessage.includes("connection")) {
			return this.createApiError(
				`Database connection failed during ${operation}`,
				StatusCodes.SERVICE_UNAVAILABLE,
				ERROR_CODES.UNKNOWN_ERROR,
				error
			);
		}

		return this.createApiError(
			`Database error during ${operation}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR,
			error
		);
	}
}

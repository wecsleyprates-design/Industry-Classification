/**
 * Base class for HTTP service clients
 * Provides common error handling and logging patterns
 */

import axios, { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import { ERROR_CODES } from "#constants";

export interface ServiceError {
	status: StatusCodes;
	errorCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
	message: string;
}

export interface ErrorDetails {
	status?: number;
	statusText?: string;
	url?: string;
	method?: string;
	data?: unknown;
	message: string;
	code?: string;
}

/**
 * Base class for HTTP service clients
 * Provides common error handling utilities
 */
export abstract class BaseHttpService {
	protected baseURL: string;
	protected timeout: number;

	constructor(baseURL: string, timeout: number = 10000) {
		this.baseURL = baseURL;
		this.timeout = timeout;
	}

	/**
	 * Parses an Axios error into a standardized ServiceError format
	 * @param error - Axios error to parse
	 * @returns Standardized service error
	 */
	protected parseError(error: AxiosError): ServiceError {
		return {
			status: error.response?.status ?? StatusCodes.INTERNAL_SERVER_ERROR,
			errorCode: ERROR_CODES.UNKNOWN_ERROR,
			message: error.message
		};
	}

	/**
	 * Builds error details object from Axios error for logging
	 * @param error - Axios error to extract details from
	 * @returns Error details object
	 */
	protected buildErrorDetails(error: AxiosError): ErrorDetails {
		return {
			status: error.response?.status,
			statusText: error.response?.statusText,
			url: error.config?.url,
			method: error.config?.method,
			data: error.response?.data,
			message: error.message,
			code: error.code
		};
	}

	/**
	 * Handles Axios errors with detailed logging
	 * @param error - Axios error to handle
	 * @param serviceName - Name of the service (for logging context)
	 * @param context - Additional context for the error (e.g., resource ID or operation)
	 * @returns Error details for further processing
	 */
	protected handleAxiosError(error: AxiosError, serviceName: string, context?: string): ErrorDetails {
		const errorDetails = this.buildErrorDetails(error);
		const contextStr = context ? ` when ${context}` : "";

		if (error.response) {
			// Server responded with error status
			logger.warn(`${serviceName} returned error status ${error.response.status}${contextStr}`, errorDetails);
			return errorDetails;
		}

		if (error.request) {
			// Request was made but no response received (network error, timeout, etc.)
			logger.error(
				{ error },
				`${serviceName} request failed (no response received)${contextStr}. This might indicate the service is down or unreachable.`
			);
			return errorDetails;
		}

		// Error setting up the request
		logger.error({ error }, `Error setting up request to ${serviceName}${contextStr}`);
		return errorDetails;
	}

	/**
	 * Handles non-Axios errors
	 * @param error - Non-Axios error to handle
	 * @param serviceName - Name of the service (for logging context)
	 * @param context - Additional context for the error (e.g., resource ID or operation)
	 */
	protected handleNonAxiosError(error: unknown, serviceName: string, context?: string): void {
		const contextStr = context ? ` when ${context}` : "";
		logger.error({ error }, `Unexpected error when calling ${serviceName}${contextStr}`);
	}

	/**
	 * Handles any error (Axios or non-Axios) with appropriate logging
	 * @param error - Error to handle
	 * @param serviceName - Name of the service (for logging context)
	 * @param context - Additional context for the error
	 * @returns Error details if Axios error, undefined otherwise
	 */
	protected handleError(error: unknown, serviceName: string, context?: string): ErrorDetails | undefined {
		if (axios.isAxiosError(error)) {
			return this.handleAxiosError(error, serviceName, context);
		} else {
			this.handleNonAxiosError(error, serviceName, context);
			return undefined;
		}
	}
}

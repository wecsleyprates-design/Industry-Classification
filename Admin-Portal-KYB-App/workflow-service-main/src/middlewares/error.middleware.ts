import { logger } from "#helpers/index";
import { envConfig } from "#configs";
import { ENVIRONMENTS } from "#constants/index";
import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "#types/common";

interface ErrorWithDetails {
	message: string;
	status?: number;
	errorCode?: string;
	name?: string;
	code?: string;
	details?: string[];
}

export const errorMiddleware = (error: ErrorWithDetails, req: Request, res: Response, next?: NextFunction): void => {
	if (res.headersSent) {
		return next?.(error);
	}

	// Ensure details is an array
	const details = Array.isArray(error.details) ? error.details : [error.details ?? error.message];

	if (error.status && error.status < 500) {
		if (envConfig.ENV === ENVIRONMENTS.DEVELOPMENT) {
			logger.error(JSON.stringify(error));
		}
		res.jsend.fail(
			error.message,
			{
				errorName: error.name,
				details: envConfig.ENV === ENVIRONMENTS.DEVELOPMENT ? details : undefined
			},
			error.status || null,
			error.status
		);
		return;
	}

	// Handle ApiError instances (created by ErrorHandler utility)
	if (error instanceof ApiError) {
		res.jsend.error(error.message, error.status, null);
		return;
	}

	// Handle validation errors
	if (error.name === "ValidationError" || error.message.toLowerCase().includes("validation")) {
		res.jsend.error(error.message, StatusCodes.BAD_REQUEST);
		return;
	}
	logger.error(JSON.stringify(error));
	res.jsend.error(error.message, error.status ?? 500, 500, {
		errorName: error.name,
		code: error.code,
		details: envConfig.ENV === ENVIRONMENTS.DEVELOPMENT ? details : undefined
	});
};

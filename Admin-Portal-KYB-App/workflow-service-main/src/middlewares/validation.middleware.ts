import { ERROR_CODES } from "#constants";
import { StatusCodes } from "http-status-codes";
import Joi, { type Schema, type ValidationError } from "joi";
import { type Request, type Response, type NextFunction } from "express";
import { ValidationMiddlewareError } from "#types/common";

export const validateSchema =
	(schema: Schema) =>
	(req: Request, res: Response, next: NextFunction): void => {
		const validationResult = Joi.compile(schema)
			.prefs({ errors: { label: "key", wrap: { label: false } }, abortEarly: false })
			.validate(req.body as unknown);

		const { value, error } = validationResult as { value: unknown; error?: ValidationError };

		if (error) {
			const errorMessage = error.details.map(details => details.message).join(", ");
			throw new ValidationMiddlewareError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// Only assign if req.body exists and value is not empty
		if (req.body && value && Object.keys(value).length > 0) {
			Object.assign(req.body, value);
		}
		next();
	};

export const validateQuerySchema =
	(schema: Schema) =>
	(req: Request, res: Response, next: NextFunction): void => {
		const validationResult = Joi.compile(schema)
			.prefs({ errors: { label: "key", wrap: { label: false } }, abortEarly: false })
			.validate(req.query);

		const { value, error } = validationResult as { value: unknown; error?: ValidationError };

		if (error) {
			const errorMessage = error.details.map(details => details.message).join(", ");
			throw new ValidationMiddlewareError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// Assign validated query params back to req.query
		if (value && Object.keys(value).length > 0) {
			Object.assign(req.query, value);
		}
		next();
	};

export const validateMessage = <T>(schema: Schema, payload: unknown): T => {
	// Extract event property before validation (used for Kafka routing/migration).
	// This allows messages to include 'event' in payload without validation errors.
	const { event, ...payloadToValidate } = payload as Record<string, unknown>;

	const { value, error } = Joi.compile(schema)
		.prefs({ errors: { label: "key", wrap: { label: " " } }, abortEarly: false })
		.validate(payloadToValidate);

	if (error) {
		const errorMessage = error.details.map(details => details.message).join(", ");
		throw new Error(errorMessage);
	}

	// Restore event property if it was present
	if (event !== undefined) {
		(value as Record<string, unknown>).event = event;
	}

	return value as T;
};

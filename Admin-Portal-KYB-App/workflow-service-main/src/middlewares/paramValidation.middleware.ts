import { type Request, type Response, type NextFunction } from "express";
import { Utils } from "@joinworth/types";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ERROR_MESSAGES } from "#constants";

const PARAM_KEY = "id";

/**
 * Middleware that validates the path param 'id' is present and a valid UUID.
 */
export const validateIdParam = (req: Request, res: Response, next: NextFunction): void => {
	try {
		const value = req.params[PARAM_KEY];

		if (!value) {
			throw new ApiError(ERROR_MESSAGES.ID_PARAM_REQUIRED, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!Utils.Utils.isUUID(value)) {
			throw new ApiError(ERROR_MESSAGES.ID_PARAM_INVALID_UUID, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		req.params[PARAM_KEY] = value.trim();
		next();
	} catch (error) {
		next(error);
	}
};

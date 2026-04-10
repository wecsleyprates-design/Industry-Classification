import { type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";

export const methodNotAllowed = (req: Request, res: Response): void => {
	res.jsend.fail(
		`Method ${req.method} not allowed for ${req.originalUrl}`,
		null,
		StatusCodes.METHOD_NOT_ALLOWED,
		StatusCodes.METHOD_NOT_ALLOWED
	);
};

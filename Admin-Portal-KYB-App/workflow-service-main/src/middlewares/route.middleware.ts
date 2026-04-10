import { type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";

export const routeNotFound = (req: Request, res: Response): void => {
	res.jsend.fail(`Route ${req.originalUrl} not found`, null, StatusCodes.NOT_FOUND, StatusCodes.NOT_FOUND);
};

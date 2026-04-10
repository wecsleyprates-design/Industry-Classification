import { type NextFunction, type Request, type Response } from "express";

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const catchAsync = (fn: AsyncFunction) => (req: Request, res: Response, next: NextFunction) => {
	return Promise.resolve(fn(req, res, next)).catch((error: Error) => {
		next(error);
	});
};

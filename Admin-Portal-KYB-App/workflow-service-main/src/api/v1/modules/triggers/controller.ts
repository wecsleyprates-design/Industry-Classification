import { triggerManager } from "#core";
import { catchAsync } from "#utils/catchAsync";
import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES } from "#constants";
import { type Request, type Response } from "express";

export const controller = {
	/**
	 * Retrieves all available workflow triggers
	 * @param req - Express request object
	 * @param res - Express response object
	 */
	getTriggers: catchAsync(async (req: Request, res: Response) => {
		const result = await triggerManager.getTriggers();
		res.jsend.success(result, SUCCESS_MESSAGES.TRIGGERS_RETRIEVED, StatusCodes.OK);
	})
};

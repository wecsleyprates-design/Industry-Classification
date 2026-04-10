import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import express, { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Webhook } from "svix";

import { VerificationApiError } from "#api/v1/modules/verification/error";
import { ERROR_CODES } from "#constants";
import { isNotNil } from "@austinburns/type-guards";

const WEBHOOK_SECRET = envConfig.BASELAYER_WEBHOOK_SECRET;

/**
 * Verify Svix signature (Baselayer webhooks) using the raw body buffer.
 * @see https://docs.svix.com/receiving/verifying-payloads/how
 */
export const baselayerSvixVerify = (req: Request, res: Response, buf: Buffer) => {
	if (!WEBHOOK_SECRET) {
		logger.error("BASELAYER_WEBHOOK_SECRET is not configured");
		res.locals.invalidBaselayerSignature = true;
		return;
	}
	try {
		const svixId = req.get("svix-id");
		const svixTimestamp = req.get("svix-timestamp");
		const svixSignature = req.get("svix-signature");
		if (!svixId || !svixTimestamp || !svixSignature) {
			logger.error("Baselayer webhook missing Svix headers");
			res.locals.invalidBaselayerSignature = true;
			return;
		}
		const wh = new Webhook(WEBHOOK_SECRET);
		wh.verify(buf.toString("utf8"), {
			"svix-id": svixId,
			"svix-timestamp": svixTimestamp,
			"svix-signature": svixSignature
		});
	} catch (e) {
		logger.error({ err: e }, "Invalid Baselayer / Svix webhook signature");
		res.locals.invalidBaselayerSignature = true;
	}
};

export const baselayerWebhookJson = express.json({
	limit: "20MB",
	verify: baselayerSvixVerify
});

export const errorOnInvalidBaselayerSignature = (req: Request, res: Response, next: NextFunction) => {
	if (isNotNil(res.locals.invalidBaselayerSignature)) {
		throw new VerificationApiError(
			"Invalid Baselayer webhook signature",
			StatusCodes.UNAUTHORIZED,
			ERROR_CODES.INVALID
		);
	}
	next();
};

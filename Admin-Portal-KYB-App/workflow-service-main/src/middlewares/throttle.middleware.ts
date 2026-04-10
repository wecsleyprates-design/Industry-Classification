import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, UserInfo } from "#types/common";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { ThrottleOptions, ThrottleStores } from "./types";

const throttleStores: ThrottleStores = {};

let cleanupInterval: NodeJS.Timeout | null = null;

const startCleanupInterval = (): void => {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = Date.now();
		const oneMinuteAgo = now - 60000;

		Object.keys(throttleStores).forEach((endpointKey: string) => {
			if (throttleStores[endpointKey]) {
				Object.keys(throttleStores[endpointKey]).forEach((userId: string) => {
					if (throttleStores[endpointKey][userId]) {
						throttleStores[endpointKey][userId] = throttleStores[endpointKey][userId].filter(
							timestamp => timestamp > oneMinuteAgo
						);
						if (throttleStores[endpointKey][userId]?.length === 0) {
							delete throttleStores[endpointKey][userId];
						}
					}
				});
				if (Object.keys(throttleStores[endpointKey]).length === 0) {
					delete throttleStores[endpointKey];
				}
			}
		});
	}, 60000);
};

const stopCleanupInterval = (): void => {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
};

export const throttleMiddleware =
	(options: ThrottleOptions = { maxRequests: 60, windowMs: 60000, endpointKey: "default" }) =>
	(req: Request, res: Response, next: NextFunction): void => {
		const userInfo = res.locals.user as UserInfo | undefined;

		if (!userInfo?.user_id) {
			throw new ApiError("User information not available", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
		}

		startCleanupInterval();

		const endpointKey = options.endpointKey ?? "default";
		const userId: string = userInfo.user_id;
		const now = Date.now();
		const windowStart = now - options.windowMs;

		if (!throttleStores[endpointKey]) {
			throttleStores[endpointKey] = {};
		}

		if (!throttleStores[endpointKey][userId]) {
			throttleStores[endpointKey][userId] = [];
		}

		const recentRequests = throttleStores[endpointKey][userId].filter(timestamp => timestamp > windowStart);

		if (recentRequests.length >= options.maxRequests) {
			throw new ApiError(
				`Rate limit exceeded. Maximum ${options.maxRequests} requests per ${options.windowMs / 1000} seconds.`,
				StatusCodes.TOO_MANY_REQUESTS,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		throttleStores[endpointKey][userId].push(now);
		next();
	};

process.on("SIGTERM", () => {
	stopCleanupInterval();
});

process.on("SIGINT", () => {
	stopCleanupInterval();
});

// Export cleanup function for testing
export { stopCleanupInterval };

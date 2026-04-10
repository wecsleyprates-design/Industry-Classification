import pino, { Logger } from "pino";
import pinoHttp from "pino-http";
import type { Request, Response } from "express";
import { envConfig } from "../configs";

const pinoLogger: Logger = pino({
	level: envConfig.DOPPLER_ENV === "production" ? "info" : envConfig.ENV === "test" ? "silent" : "debug",
	transport:
		envConfig.ENV === "development"
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
						ignore: "pid,hostname"
					}
				}
			: undefined
});

// Pino expects (bindings, message). Support both (msg, obj?) and (obj, msg) for backward compatibility.
function logError(objOrMsg: string | Record<string, unknown>, msgOrObj?: string | unknown): void {
	if (typeof objOrMsg === "string") {
		pinoLogger.error(msgOrObj as Record<string, unknown> | undefined, objOrMsg);
	} else {
		pinoLogger.error(objOrMsg, (msgOrObj as string) ?? "");
	}
}

// Create a typed logger wrapper to fix TypeScript issues
const logger = {
	info: (msg: string, obj?: unknown) => pinoLogger.info(obj, msg),
	error: logError,
	warn: (msg: string, obj?: unknown) => pinoLogger.warn(obj, msg),
	debug: (msg: string, obj?: unknown) => pinoLogger.debug(obj, msg),
	fatal: (msg: string, obj?: unknown) => pinoLogger.fatal(obj, msg),
	trace: (msg: string, obj?: unknown) => pinoLogger.trace(obj, msg)
};

// HTTP request/response logging middleware
// Reuses the shared pino logger instance for consistency
export const pinoHttpLogger = pinoHttp({
	logger: pinoLogger,
	serializers: {
		req: (req: Request) => ({
			method: req.method,
			url: req.url,
			headers: {
				host: req.headers.host,
				"user-agent": req.headers["user-agent"],
				"content-type": req.headers["content-type"]
			}
		}),
		res: (res: Response) => ({
			statusCode: res.statusCode
		})
	}
});

export { logger, pinoLogger };

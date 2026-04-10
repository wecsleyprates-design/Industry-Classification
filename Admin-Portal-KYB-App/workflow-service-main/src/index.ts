// MUST BE THE FIRST IMPORT - DO NOT MOVE - Initialize Datadog tracer
import "@joinworth/worth-core-service";

import "module-alias/register";

import { enableEventLoopMonitor, reportEventLoopBlock } from "@joinworth/worth-core-service";
import { envConfig } from "#configs";
import { logger, pinoLogger, connectDb, initializeJsonLogic, connectRedis } from "#helpers";
import { initWorkers } from "./workers";
import { type Server, type IncomingMessage, type ServerResponse } from "http";
import { initKafkaHandler } from "#messaging";
import { app } from "./app";

let server: Server<typeof IncomingMessage, typeof ServerResponse> | null = null;

export const start = async (): Promise<void> => {
	try {
		// Initialize event loop monitoring with Datadog and pino logger
		enableEventLoopMonitor({
			thresholdMs: 20,
			logger: pinoLogger,
			onBlock: (durationMs: number) => {
				reportEventLoopBlock(durationMs, pinoLogger);
			}
		});

		const isHealthCheckMode = envConfig.HEALTH_CHECK_MODE;

		if (isHealthCheckMode) {
			logger.info(
				"Starting in HEALTH_CHECK_MODE - verifying connectivity only, not consuming messages or processing jobs"
			);
		}

		// Initialize custom JSON Logic operators
		initializeJsonLogic();

		// Always verify database connectivity
		await connectDb();

		await connectRedis();

		// Skip workers in health check mode (they would process Bull queue jobs)
		if (!isHealthCheckMode) {
			// Initialize background workers (Bull Queue workers)
			await initWorkers();
		} else {
			logger.info("Skipping workers initialization (health-check mode)");
		}

		// Kafka: connect-only in health check mode (verifies brokers/credentials without consuming)
		// Normal mode: full consumer initialization with message processing
		await initKafkaHandler(isHealthCheckMode);

		// Start HTTP server
		server = app.listen(envConfig.APP_PORT, () => {
			logger.info(`Workflow Service listening on ${envConfig.HOSTNAME} http://localhost:${envConfig.APP_PORT}`);
			if (isHealthCheckMode) {
				logger.info("Health check mode: All connections verified, service ready for health check");
			}
		});
	} catch (error) {
		logger.error({ error }, "Failed to initialize workflow service");
		process.exit(1);
	}
};

export const stop = async (): Promise<void> => {
	if (server) {
		const currentServer = server;
		await new Promise<void>(resolve => currentServer.close(() => resolve()));
		logger.info("Server closed");
		server = null;
	} else {
		logger.info("Server not running");
	}
};

if (require.main === module) {
	start().catch(err => {
		logger.fatal(`Failed to start: ${err}`);
		process.exit(1);
	});

	process.on("uncaughtException", error => {
		logger.fatal(`uncaughtException ${String(error)}`);
		void stop();
		process.exit(1);
	});

	process.on("unhandledRejection", error => {
		logger.fatal(`unhandledRejection ${String(error)}`);
		void stop();
		process.exit(1);
	});

	process.on("SIGTERM", () => {
		logger.info("SIGTERM received");
		void stop();
	});
}

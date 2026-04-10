import { initMetrics, getMetrics } from "@joinworth/worth-core-service";
import { logger } from "#helpers/logger";

export function initServiceMetrics() {
	return initMetrics({
		prefix: "integration_service.",
		errorHandler(error) {
			logger.warn({ err: error }, "DogStatsD error");
		},
	});
}

export { getMetrics };

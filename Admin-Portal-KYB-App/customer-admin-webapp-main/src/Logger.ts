import type { ILogger } from "@joinworth/worth-core-utils";
import {
	createConsoleLogger,
	createLogger as createWorthLogger,
} from "@joinworth/worth-core-utils";

import { envConfig } from "@/config/envConfig";

const consoleOptions = { level: "debug" as const, prefix: "CustomerAdmin" };

/**
 * App logger. Initialized to a safe console-based default so usage before
 * initLogger() completes does not crash. Replaced with the configured logger
 * once initLogger() is called at app bootstrap.
 * Use via: import { log } from "@/Logger"
 */
export let log: ILogger = createConsoleLogger(consoleOptions);

/**
 * Initialize the logger once at app bootstrap. Uses console logger in dev,
 * Datadog browser logs in production when config is available.
 */
export async function initLogger(): Promise<ILogger> {
	const clientToken = envConfig.VITE_DATADOG_RUM_CLIENT_TOKEN;
	const hasDatadogConfig = Boolean(clientToken);

	if (hasDatadogConfig) {
		log = await createWorthLogger({
			kind: "datadog",
			config: {
				clientToken: clientToken ?? "",
				site: "datadoghq.com",
				service: envConfig.VITE_DATADOG_RUM_SERVICE ?? "customer-admin-webapp",
				env: envConfig.VITE_DATADOG_RUM_ENV ?? import.meta.env.MODE,
				forwardErrorsToLogs: true,
				sessionSampleRate: 100,
			},
		});
	} else {
		log = await createWorthLogger({
			kind: "console",
			options: consoleOptions,
		});
	}
	return log;
}

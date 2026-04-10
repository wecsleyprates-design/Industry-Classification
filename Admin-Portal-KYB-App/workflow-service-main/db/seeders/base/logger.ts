/**
 * Simple logger for seeders
 *
 * Provides basic logging functionality without dependencies on project modules.
 * Uses console.log/error for simplicity and isolation.
 */

/* eslint-disable no-console */

export interface SeederLogger {
	info: (msg: string, ...args: unknown[]) => void;
	error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Creates a simple logger instance for seeders
 * @param prefix - Optional prefix for log messages (e.g., "ATTRIBUTES")
 * @returns Logger instance
 */
export function createSeederLogger(prefix?: string): SeederLogger {
	const logPrefix = prefix ? `[SEEDER:${prefix}]` : "[SEEDER]";
	const errorPrefix = prefix ? `[SEEDER ERROR:${prefix}]` : "[SEEDER ERROR]";

	return {
		info: (msg: string, ...args: unknown[]) => {
			console.log(`${logPrefix} ${msg}`, ...args);
		},
		error: (msg: string, ...args: unknown[]) => {
			console.error(`${errorPrefix} ${msg}`, ...args);
		}
	};
}

/* eslint-enable no-console */

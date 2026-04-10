/**
 * Database connection for seeders
 *
 * This module provides a database connection using the project's envConfig
 * for consistency with the main application.
 *
 * Environment variables required (via envConfig):
 *   CONFIG_DB_HOST, CONFIG_DB_PORT, CONFIG_DB_USER, CONFIG_DB_PASSWORD, CONFIG_DB_NAME
 */

import knex from "knex";
import type { Knex } from "knex";
import { envConfig } from "#configs/env.config";

/**
 * Creates a database connection for seeders
 * Uses envConfig for consistency with the main application
 */
export function createSeederDb(): Knex {
	return knex({
		client: "pg",
		connection: {
			host: envConfig.DB_HOST,
			port: envConfig.DB_PORT ?? "5432",
			user: envConfig.DB_USER,
			password: envConfig.DB_PASSWORD,
			database: envConfig.DB_NAME,
			idle_in_transaction_session_timeout: 30000,
			connectionTimeout: 0,
			ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
		},
		pool: {
			max: envConfig.DB_MAX_CONNECTIONS ?? 5
		},
		searchPath: ["public"]
	});
}

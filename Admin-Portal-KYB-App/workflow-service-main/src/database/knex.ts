import knex from "knex";
import { envConfig } from "#configs";
import { logger } from "#helpers/logger";

const db = knex({
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
		max: envConfig.DB_MAX_CONNECTIONS ?? 10
	},
	searchPath: ["public"]
});

db.on("query", ({ sql, bindings }) => {
	logger.debug(`SQL: ${sql} | data: ${JSON.stringify(bindings)}`);
});

// Test connection
export async function testKnexConnection(): Promise<boolean> {
	try {
		await db.raw("SELECT 1");
		logger.info("Knex database connection successful");
		return true;
	} catch (error) {
		logger.error({ error }, "Knex database connection failed");
		return false;
	}
}

// Graceful shutdown
export async function closeKnexConnection(): Promise<void> {
	try {
		await db.destroy();
		logger.info("Knex database connection closed");
	} catch (error) {
		logger.error({ error }, "Error closing Knex database connection");
	}
}

export { db };

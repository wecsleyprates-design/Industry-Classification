import { Pool } from "pg";
import { envConfig as importedEnvConfig } from "#configs";
import { logger } from "#helpers/logger";

const envConfig = importedEnvConfig || {};
import { DatabaseConfig } from "./types";

const config: DatabaseConfig = {
	host: envConfig.DB_HOST ?? "localhost",
	port: envConfig.DB_PORT ?? 5432,
	user: envConfig.DB_USER ?? "postgres",
	password: envConfig.DB_PASSWORD ?? "",
	database: envConfig.DB_NAME ?? "workflow",
	maxConnections: envConfig.DB_MAX_CONNECTIONS ?? 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 0,
	ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
};

export const pool = new Pool(config);

pool.on("error", (err, _client) => {
	logger.error({ error: err }, "idle client error");
});

interface DatabaseConfig {
	driver: string;
	host: { ENV: string };
	port: { ENV: string };
	database: { ENV: string };
	user: { ENV: string };
	password: { ENV: string };
	ssl: boolean | { rejectUnauthorized: boolean };
}

interface DbMigrateConfig {
	defaultEnv: string;
	development: DatabaseConfig;
	production: DatabaseConfig;
	"sql-file": boolean;
}

const config: DbMigrateConfig = {
	defaultEnv: process.env.NODE_ENV ?? "production",
	development: {
		driver: "pg",
		host: { ENV: "CONFIG_DB_HOST" },
		port: { ENV: "CONFIG_DB_PORT" },
		database: { ENV: "CONFIG_DB_NAME" },
		user: { ENV: "CONFIG_DB_USER" },
		password: { ENV: "CONFIG_DB_PASSWORD" },
		ssl: false
	},
	production: {
		driver: "pg",
		host: { ENV: "CONFIG_DB_HOST" },
		port: { ENV: "CONFIG_DB_PORT" },
		database: { ENV: "CONFIG_DB_NAME" },
		user: { ENV: "CONFIG_DB_USER" },
		password: { ENV: "CONFIG_DB_PASSWORD" },
		ssl: { rejectUnauthorized: false }
	},
	"sql-file": true
};

module.exports = config;

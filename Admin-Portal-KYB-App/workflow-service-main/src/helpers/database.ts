import { pool } from "#database/pool";

import { logger } from "./logger";

class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseError";
	}
}

/**
 * tests connection and returns done, if successful;
 * or else rejects with connection error:
 */
export const connectDb = () => {
	return new Promise((resolve, reject) => {
		// try to connect
		pool.connect((err, _client, done) => {
			if (err) {
				return reject(new DatabaseError(`Error connecting to database: ${err.message}`));
			}

			logger.info("Successfully connected to database !!");

			return resolve(done());
		});
	});
};

export { DatabaseError };

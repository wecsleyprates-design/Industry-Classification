import Redis, {
	type ScanStream,
	type Redis as IRedis,
	type Cluster,
	type RedisKey,
	type RedisValue,
	type ClusterNode,
	type ClusterOptions
} from "ioredis";
import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { ENVIRONMENTS } from "#constants";
const REDIS_READY_STATUS = "ready";

let client: Redis | Cluster;
const TTL = "300";

const disconnectClientQuietly = (redisClient: Redis | Cluster): void => {
	try {
		redisClient.disconnect(false);
	} catch (err: unknown) {
		logger.debug("Redis disconnect raised during cleanup (ignored)", {
			error: err instanceof Error ? err.message : String(err)
		});
	}
};

let connectInFlight: Promise<void> | null = null;

interface RedisConfig {
	ecClusterMode: boolean;
	conn: {
		url: string;
		host: string;
		port: string;
		username?: string;
		password?: string;
		disableTLS: boolean;
		rejectUnauthorized: boolean;
	};
	reconnectMaxWait: number;
}

const credentials: { username?: string; password?: string } = {};
if (envConfig.REDIS_USERNAME) {
	credentials.username = envConfig.REDIS_USERNAME;
}
if (envConfig.REDIS_PASSWORD) {
	credentials.password = envConfig.REDIS_PASSWORD;
}

// Connection parameters for the Redis instance which handles caching.
export const redisConfig: RedisConfig = {
	// Connect to Elasticache using ioRedis cluster mode. Use this if EC is responding with
	// "MOVED" errors.
	ecClusterMode: envConfig.REDIS_EC_CLUSTER,
	// Cache Redis connection credentials
	conn: {
		url: envConfig.REDIS_URL ?? "",
		host: envConfig.REDIS_HOST ?? "",
		port: envConfig.REDIS_PORT ?? "",
		disableTLS: envConfig.REDIS_DISABLE_TLS,
		rejectUnauthorized: !envConfig.REDIS_DISABLE_TLS_REJECT_UNAUTHORIZED,
		...credentials
	},
	// Max milliseconds to wait between reconnection attempts
	reconnectMaxWait: envConfig.REDIS_RECONNECT_MAX_WAIT || 2000
};

const getReconnectMaxWait = (config: RedisConfig): number => config.reconnectMaxWait || 2000;

const createClient = (config: RedisConfig) => {
	const { conn } = config;
	const reconnectMaxWait = getReconnectMaxWait(config);
	const options: Record<string, unknown> = {
		retryStrategy(times: number) {
			logger.warn("Lost Redis connection, reattempting");
			return Math.min(times * 2, reconnectMaxWait);
		},

		reconnectOnError(err: Error) {
			logger.error("Redis reconnection error", { err });
			const targetError = "READONLY";
			if (err.message && err.message.slice(0, targetError.length) === "READONLY") {
				// When a slave is promoted, we might get temporary errors saying
				// READONLY You can't write against a read only slave. Attempt to
				// reconnect if this happens.
				logger.warn("ElastiCache returned a READONLY error, reconnecting");
				return 2; // `1` means reconnect, `2` means reconnect and resend
				// the failed command
			}
		}
	};

	const keyPrefix = envConfig.REDIS_KEY_PREFIX || undefined;

	if (conn.url) {
		return new Redis(conn.url, { ...options, keyPrefix });
	}

	if (conn.username) {
		options.username = conn.username;
	}

	if (conn.password) {
		options.password = conn.password;
	}

	if (conn.disableTLS) {
		logger.warn("Connecting to Redis insecurely");
	} else {
		options.tls = {};
		const { rejectUnauthorized: ru } = conn;
		if (typeof ru === "boolean") {
			if (!ru) {
				logger.warn(
					"Skipping Redis CA validation. Consider changing to a hostname that matches the certificate's names instead of disabling rejectUnauthorized."
				);
			}
			(options.tls as { rejectUnauthorized: boolean }).rejectUnauthorized = ru;
		}
	}

	if (config.ecClusterMode) {
		return new Redis.Cluster([`//${conn.host}:${conn.port}`], {
			scaleReads: "slave",
			keyPrefix,
			redisOptions: {
				...options
			}
		});
	}
	return new Redis(parseInt(conn.port), conn.host, { ...options, keyPrefix });
};

export const redisConnect = (config: RedisConfig) => {
	client = createClient(config);
	client.on("connect", () => {
		logger.info("Connecting to Redis...", {
			clusterMode: config.ecClusterMode ? "YES" : "NO",
			method: config.conn.url ? "URL connection string" : "host + port",
			username: config.conn.username ? "YES" : "NO",
			password: config.conn.password ? "YES" : "NO",
			reconnectMaxWait: getReconnectMaxWait(config)
		});
	});
	client.on("ready", () => {
		logger.info("Redis is ready");
	});
	client.on("error", (err: Error) => {
		logger.error("Redis connection error", { err });
	});
	client.on("close", () => {
		logger.warn("Redis connection closed");
	});
	client.on("reconnecting", (ms: number) => {
		logger.info(`Reconnecting to Redis in ${ms}ms`);
	});
	client.on("end", () => {
		logger.warn("Redis connection ended");
	});
	return client;
};

const pingWhenReady = async (redisClient: Redis | Cluster): Promise<string> => {
	if (redisClient.status !== REDIS_READY_STATUS) {
		throw new Error(`Bad Redis status: ${redisClient.status}`);
	}
	return redisClient.ping();
};

const waitUntilRedisReady = (redisClient: Redis | Cluster, timeoutMs: number): Promise<void> => {
	if (redisClient.status === REDIS_READY_STATUS) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		let settled = false;

		const cleanup = (): void => {
			clearTimeout(timer);
			redisClient.off("ready", onReady);
			redisClient.off("error", onError);
		};

		const settle = (action: () => void): void => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			action();
		};

		const onReady = (): void => {
			settle(() => {
				resolve();
			});
		};

		const onError = (err: unknown): void => {
			settle(() => {
				reject(err instanceof Error ? err : new Error(String(err)));
			});
		};

		const timer = setTimeout((): void => {
			settle(() => {
				reject(new Error(`Redis did not become ready within ${timeoutMs}ms (last status: ${redisClient.status})`));
			});
		}, timeoutMs);

		redisClient.once("ready", onReady);
		redisClient.once("error", onError);
	});
};

export const connectRedis = async (config: RedisConfig = redisConfig, timeoutMs?: number): Promise<void> => {
	if (connectInFlight) {
		return connectInFlight;
	}

	const deadlineMs = timeoutMs ?? envConfig.REDIS_RECONNECT_MAX_WAIT;

	connectInFlight = (async (): Promise<void> => {
		try {
			redisConnect(config);
			await waitUntilRedisReady(client, deadlineMs);
			const pong = await pingWhenReady(client);
			logger.info("Redis connection verified", { pong });
		} catch (err) {
			disconnectClientQuietly(client);
			connectInFlight = null;
			throw err;
		}
	})();

	return connectInFlight;
};

export const isHealthy = async (): Promise<string> => pingWhenReady(client);

export const quitGracefully = async (): Promise<void> => {
	try {
		await client.quit();
	} catch (err) {
		logger.warn("Redis quit failed during shutdown", { err });
		disconnectClientQuietly(client);
	}
};

export const redis = {
	get: async (key: RedisKey): Promise<RedisValue | null> => {
		const result = await client.get(key);
		try {
			return JSON.parse(result ?? "") as RedisValue;
		} catch {
			return result;
		}
	},
	jsonget: async (key: RedisKey, path: string = ".") => {
		const result = await client.call("JSON.GET", key, path);
		return result;
	},
	set: async (key: string, value: string | object): Promise<boolean> => {
		if (typeof value === "object") {
			await client.set(key, JSON.stringify(value));
		} else {
			await client.set(key, value);
		}
		return true;
	},
	jsonset: async (key: RedisKey, path: string, value: string | object) => {
		if (typeof value === "object") {
			await client.call("JSON.SET", key, path, JSON.stringify(value));
		} else {
			await client.call("JSON.SET", key, path, value);
		}
		return true;
	},
	hget: async (key: string, field: string): Promise<string | null> => {
		const result = await client.hget(key, field);
		try {
			return JSON.parse(result ?? "") as string;
		} catch {
			return result;
		}
	},
	hmget: async (key: string, fields: Array<string | Buffer>): Promise<Array<string | null> | object[]> => {
		const result = await client.hmget(key, ...fields);
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return result.map(val => (val ? JSON.parse(val) : null)) as Array<string | null> | object[];
		} catch {
			return result as Array<string | null> | object[];
		}
	},
	hset: async (key: string, field: string, value: string | object): Promise<boolean> => {
		if (typeof value === "object") {
			await client.hset(key, field, JSON.stringify(value));
		} else if (!value && Array.isArray(field)) {
			// field is an array of key-value pairs [ key, JSON.stringify(value), key, JSON.stringify(value), ...]
			await client.hset(key, ...field);
		} else {
			await client.hset(key, field, value);
		}
		return true;
	},

	hgetall: async (rediskey: RedisKey): Promise<Record<string, string | object>> => {
		const result = await client.hgetall(rediskey);
		const processedResult = Object.keys(result).reduce(
			(acc, key) => {
				if (typeof result[key] === "string") {
					try {
						acc[key] = JSON.parse(result[key]) as string | object;
					} catch {
						acc[key] = result[key] as string | object;
					}
				} else {
					acc[key] = result[key] as string | object;
				}
				return acc;
			},
			{} as Record<string, string | object>
		);

		return processedResult;
	},

	exists: async (key: RedisKey): Promise<boolean> => {
		const result = await client.exists(key);
		return Boolean(result);
	},

	expire: async (key: RedisKey, EX: string = TTL): Promise<boolean> => {
		await client.expire(key, EX);
		return true;
	},

	delete: async (key: RedisKey): Promise<boolean> => {
		await client.del(key);
		return true;
	},

	// data is an array of key-value pairs [ key, JSON.stringify(value), key, JSON.stringify(value), ...]
	mset: async (data: Array<[string, string]>) => {
		if (!Array.isArray(data)) {
			throw new Error("Data must be an array");
		}
		if (!data.length) {
			return;
		}
		const convertedData: Array<number | RedisKey> = data.flat();
		const result = await client.mset(...convertedData);
		return result;
	},

	mget: async (keys: string[]): Promise<Array<string | null>> => {
		if (!Array.isArray(keys)) {
			throw new Error("Keys must be an array");
		}
		const result = await client.mget(...keys);
		return result;
	},

	deleteMultipleKeys: async (keys: string[]) => {
		if (!keys.length) {
			return;
		}
		const pipeline = client.pipeline();
		keys.forEach(key => {
			pipeline.del(key);
		});
		await pipeline.exec();
	},

	deleteMultiple: async (pattern: string, keyCount: number) => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		const response = await new Promise(resolve => {
			let stream: ScanStream;
			if (redisConfig.ecClusterMode) {
				const newClient = client as Cluster;
				const node = newClient.nodes("master");
				stream = node[0].scanStream({
					match: prefixedPattern,
					count: keyCount
				});
			} else {
				const newClient = client as IRedis;
				stream = newClient.scanStream({
					match: prefixedPattern,
					count: keyCount
				});
			}
			const pipeline = client.pipeline();
			stream.on("data", (keys: RedisKey[]) => {
				keys.forEach((key: RedisKey) => {
					// SCAN returns full Redis keys (already prefixed), but pipeline.del() auto-prefixes via ioredis keyPrefix — strip to avoid double-prefixing
					const unprefixedKey = prefix ? String(key).slice(prefix.length) : key;
					pipeline.del(unprefixedKey);
				});
			});
			stream.on("end", () => {
				resolve(pipeline.exec());
			});
		});

		return response;
	},

	// limit is a key count under which the scan will stop.
	// scan will look for pattern in all keys and return the values of the keys that match the pattern
	getByPattern: async (pattern: string, limit = 100000) => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		return await new Promise(resolve => {
			const pipeline = client.pipeline();
			let stream: ScanStream;
			if (redisConfig.ecClusterMode) {
				const newClient = client as Cluster;
				const node = newClient.nodes("master");
				stream = node[0].scanStream({
					match: prefixedPattern,
					count: limit
				});
			} else {
				const newClient = client as IRedis;
				stream = newClient.scanStream({
					match: prefixedPattern,
					count: limit
				});
			}
			stream.on("data", (keys: RedisKey[]) => {
				keys.forEach((key: RedisKey) => {
					// SCAN returns full Redis keys (already prefixed), but pipeline.get() auto-prefixes via ioredis keyPrefix — strip to avoid double-prefixing
					const unprefixedKey = prefix ? String(key).slice(prefix.length) : key;
					pipeline.get(unprefixedKey);
				});
			});

			stream.on("end", () => {
				resolve(pipeline.exec());
			});
		});
	},

	/**
	 * @description adds a value to a redis set or creates a new set if it doesn't exist
	 * @param {*} key key of the redis set
	 * @param {*} value can be a string or an array of strings
	 * @returns {Promise<boolean>} true if the value is added to the set
	 */
	sadd: async (key: string, value: string | string[]): Promise<boolean> => {
		const newValues = typeof value === "string" ? [value] : value;
		await client.sadd(key, newValues);
		return true;
	},

	spop: async (key: string, count: number | string = 1): Promise<string[] | null> => {
		const result = await client.spop(key, count);
		return result;
	},

	sismember: async (key: string, value: string): Promise<boolean> => {
		const result = await client.sismember(key, value);
		return Boolean(result);
	},

	scard: async (key: string): Promise<number> => {
		const result = await client.scard(key);
		return result;
	},

	/**
	 * Sets the key to value only if it does not exist, with an expiration in seconds.
	 * @param key - Redis key
	 * @param value - String value to store
	 * @param ttlSeconds - Expiration in seconds
	 * @returns true if the key was set, false if the key already existed
	 */
	setNX: async (key: string, value: string, ttlSeconds: number): Promise<boolean> => {
		const result = await client.set(key, value, "EX", ttlSeconds, "NX");
		return result === "OK";
	},

	/**
	 * Returns all members of the set stored at key.
	 * @param key - Redis key of the set
	 * @returns Array of member strings, or empty array if key does not exist
	 */
	smembers: async (key: string): Promise<string[]> => {
		const result = await client.smembers(key);
		return result ?? [];
	},

	/**
	 * Starts a MULTI/EXEC transaction. Commands are queued until exec() is called; then they run atomically without interleaving from other clients.
	 * @returns Chainable transaction
	 */
	multi: () => client.multi()
};

export type RedisClient = typeof redis;

/**
 * @description creates a new Redis Cluster client as of now only with a single node
 * @param conn
 * @param opts
 * @returns
 */
export const createClusterClient = (
	conn: ClusterNode & { TLS: boolean; username?: string; password?: string },
	opts: ClusterOptions
) => {
	if (conn.username) {
		credentials.username = conn.username;
	}
	if (conn.password) {
		credentials.password = conn.password;
	}

	return new Redis.Cluster([conn], {
		...opts,
		dnsLookup: (address, callback) => {
			callback(null, address);
		},
		redisOptions: {
			tls: {
				rejectUnauthorized: conn.TLS
			},
			...credentials
		}
	});
};

const parsedPort = parseInt(envConfig.REDIS_PORT ?? "6379");
const clusterNode: ClusterNode & { TLS: boolean; username?: string; password?: string } = {
	host: envConfig.REDIS_HOST,
	port: Number.isNaN(parsedPort) ? 6379 : parsedPort,
	TLS: !envConfig.REDIS_DISABLE_TLS,
	...credentials
};

const clusterOptions = {
	enableReadyCheck: false
};

/**
 * Creates a Redis connection configuration object.
 * If Elasticache cluster mode is enabled, attaches a cluster client creator to the config.
 * Otherwise, attaches a standard Redis config.
 *
 * @param config - The configuration object to augment with Redis connection details.
 * @returns The updated configuration object with Redis connection details.
 */
export const createRedisConnection = (config: Record<string, unknown>) => {
	const host = envConfig.REDIS_HOST ?? "";
	const port = Number(envConfig.REDIS_PORT) || 6379;
	const tls = !envConfig.REDIS_DISABLE_TLS
		? { rejectUnauthorized: !envConfig.REDIS_DISABLE_TLS_REJECT_UNAUTHORIZED }
		: {};

	const baseConfig = { host, port, ...credentials };

	if (envConfig.REDIS_EC_CLUSTER) {
		config.createClient = () => createClusterClient(clusterNode, clusterOptions);
	} else if ((host === "localhost" || host === "127.0.0.1") && envConfig.ENV === ENVIRONMENTS.DEVELOPMENT) {
		config.redis = redisConfig;
	} else if (host === "redis" || envConfig.ENV === ENVIRONMENTS.DEVELOPMENT) {
		config.redis = tls && Object.keys(tls).length > 0 ? { ...baseConfig, tls } : baseConfig;
	} else {
		config.createClient = () => createClusterClient(clusterNode, clusterOptions);
	}
	return config;
};

jest.mock("#helpers/redis", () => ({
	createRedisConnection: jest.fn(() => ({
		redis: {
			host: "localhost",
			port: 6379
		},
		prefix: "{bull}"
	})),
	redisConnect: jest.fn(),
	connectRedis: jest.fn().mockResolvedValue(undefined),
	isHealthy: jest.fn().mockResolvedValue("PONG"),
	quitGracefully: jest.fn().mockResolvedValue(undefined),
	redis: {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(true),
		hget: jest.fn().mockResolvedValue(null),
		hset: jest.fn().mockResolvedValue(true),
		hgetall: jest.fn().mockResolvedValue({}),
		exists: jest.fn().mockResolvedValue(false),
		expire: jest.fn().mockResolvedValue(true),
		delete: jest.fn().mockResolvedValue(true),
		mset: jest.fn().mockResolvedValue("OK"),
		mget: jest.fn().mockResolvedValue([]),
		deleteMultipleKeys: jest.fn().mockResolvedValue(undefined),
		deleteMultiple: jest.fn().mockResolvedValue(undefined),
		getByPattern: jest.fn().mockResolvedValue(undefined),
		sadd: jest.fn().mockResolvedValue(true),
		spop: jest.fn().mockResolvedValue(null),
		sismember: jest.fn().mockResolvedValue(false),
		scard: jest.fn().mockResolvedValue(0),
		srem: jest.fn().mockResolvedValue(true),
		setex: jest.fn().mockResolvedValue(true),
		incr: jest.fn().mockResolvedValue(1),
		decr: jest.fn().mockResolvedValue(0)
	}
}));

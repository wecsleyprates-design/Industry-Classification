// Mock external dependencies to prevent connection issues
import { envConfig } from "#configs/env.config";

jest.mock("ioredis", () => ({
	Redis: jest.fn().mockImplementation(() => ({
		connect: jest.fn(),
		disconnect: jest.fn(),
		quit: jest.fn(),
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		exists: jest.fn(),
		expire: jest.fn(),
		ttl: jest.fn(),
		keys: jest.fn(),
		scan: jest.fn(),
		flushall: jest.fn()
	}))
}));

jest.mock("pg", () => ({
	Pool: jest.fn().mockImplementation(() => ({
		connect: jest.fn(),
		query: jest.fn(),
		end: jest.fn(),
		on: jest.fn()
	}))
}));

jest.mock("bull", () => {
	const mockQueue = jest.fn().mockImplementation(() => ({
		add: jest.fn(),
		process: jest.fn(),
		close: jest.fn(),
		isQueueClosed: false
	}));
	return mockQueue;
});

// Set up environment variables for testing
process.env.CONFIG_CASE_SERVICE_URL = envConfig.CASE_SERVICE_URL ?? "http://case-service:3001";
process.env.CONFIG_CASE_API_PREFIX = envConfig.CASE_API_PREFIX ?? "/api/v1";
process.env.CONFIG_CASE_HEALTH_PATH = envConfig.CASE_HEALTH_PATH ?? "/health";
process.env.NODE_ENV = "test";

// Clean up after each test
afterEach(() => {
	jest.clearAllMocks();
});

export {};

/**
 * The real package pulls in dd-trace + @confluentinc/kafka-javascript (native bindings).
 * CI runs `npm ci` without compiling native addons, so loading the full bundle fails.
 * Metrics tests only need an in-memory StatsD client (`mock: true`).
 */
jest.mock("@joinworth/worth-core-service", () => {
	const { StatsD } = require("hot-shots");
	let singleton = null;

	function normalizePrefix(prefix) {
		if (!prefix) return "";
		return prefix.endsWith(".") ? prefix : `${prefix}.`;
	}

	function createMetricsClient(options = {}) {
		const prefix = normalizePrefix(options.prefix);
		const autoTags = {};
		if (process.env.DD_ENV) autoTags.env = process.env.DD_ENV;
		if (process.env.DD_SERVICE) autoTags.service = process.env.DD_SERVICE;
		const errorHandler =
			options.errorHandler ??
			((error) => {
				options.logger?.error?.({ error }, `DogStatsD error: ${error.message}`);
			});
		return new StatsD({
			mock: true,
			prefix,
			globalTags: { ...autoTags, ...options.globalTags },
			errorHandler,
			...options.clientOptions
		});
	}

	function initMetrics(options = {}) {
		if (singleton) singleton.close();
		singleton = createMetricsClient(options);
		return singleton;
	}

	function getMetrics() {
		if (!singleton) singleton = createMetricsClient();
		return singleton;
	}

	return {
		enableEventLoopMonitor: jest.fn(),
		reportEventLoopBlock: jest.fn(),
		createMetricsClient,
		initMetrics,
		getMetrics
	};
});

jest.mock("#helpers/knex", () => {
	const knex = require("knex");

	const { MockClient } = require("knex-mock-client");

	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

// Mock verdata workers to prevent Redis connections during tests
jest.mock("#workers/verdata", () => ({
	verdataRetryQueue: {
		addJob: jest.fn(),
		queue: {
			process: jest.fn(),
			getWaitingCount: jest.fn().mockResolvedValue(0),
			getDelayedCount: jest.fn().mockResolvedValue(0)
		}
	},
	verdataQueue: {
		addJob: jest.fn(),
		queue: {
			process: jest.fn(),
			getWaitingCount: jest.fn().mockResolvedValue(0),
			getDelayedCount: jest.fn().mockResolvedValue(0)
		}
	},
	initVerdataWorker: jest.fn(),
	initEnrichWorker: jest.fn()
}));

// Mock the intuit-oauth package to prevent axios issues
jest.mock("intuit-oauth", () => {
	return function MockOAuthClient() {
		return {
			authorizeUri: jest.fn().mockResolvedValue("mock-auth-uri"),
			createToken: jest.fn().mockResolvedValue("mock-token"),
			refreshToken: jest.fn().mockResolvedValue("mock-refresh-token"),
			getCompanyInfo: jest.fn().mockResolvedValue({})
		};
	};
});

jest.mock("#helpers/logger", () => {
	return { logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } };
});
// Mock node-fetch for HTTP client tests
jest.mock("node-fetch", () => jest.fn());

// Mock environment configurations for consistent test behavior
jest.mock("#configs/env.config", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "abcdef9876543210abcdef9876543210",
		CRYPTO_IV: "0123456789abcdef",
		CRYPTO_SECRET_KEY_V2: "0123456789abcdef0123456789abcdef",
		STRIPE_PUBLIC_KEY: "pk_test_1234567890",
		STRIPE_SECRET_KEY: "sk_test_1234567890",
		STRIPE_WEBHOOK_URL: "https://webhook.site/1234567890",
		AWS_REGION: "us-east-1",
		AWS_COGNITO_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "test-access-key",
		AWS_ACCESS_KEY_SECRET: "test-secret-key",
		AWS_KMS_KEY_ID: "test-kms-key",
		CRYPTO_IV_V2: "abcdef9876543210"
	}
}));

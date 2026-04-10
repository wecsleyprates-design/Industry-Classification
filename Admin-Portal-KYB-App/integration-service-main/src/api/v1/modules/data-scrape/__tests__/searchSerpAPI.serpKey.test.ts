import {
	baseHarnessEnvConfig,
	businessID,
	createMockConstants,
	defaultBusinessAddress,
	defaultBusinessName,
	taskID
} from "./test.utils";

/*
 * Scope: this file documents only the configuration-guard regression added for
 * search-business-details. It isolates the "missing SERP_API_KEY" behavior of
 * DataScrapeService.searchSerpAPI and complements the broader service orchestration
 * coverage in searchSerpAPI.regression.test.ts.
 *
 * Real in this harness:
 * - DataScrapeService.searchSerpAPI
 *
 * Mocked in this harness:
 * - axios
 * - envConfig through every config import path the service graph may use
 * - helpers, TaskManager, Kafka, and S3 upload
 */
const mockAxiosGet = jest.fn();
const mockProducerSend = jest.fn();
const mockTaskManagerGetEnrichedTask = jest.fn();
const mockTaskManagerSaveRawResponseToDB = jest.fn();
const mockLogger = {
	info: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	warn: jest.fn()
};
const mockHelpersModule = {
	__esModule: true,
	getBusinessDetails: jest.fn(),
	getBusinessDetailsForTaxConsent: jest.fn(),
	getFlagValue: jest.fn(),
	internalGetBusinessNamesAndAddresses: jest.fn(),
	logger: mockLogger,
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	db: jest.fn(),
	producer: {
		send: mockProducerSend
	}
};

/*
 * The empty SERP_API_KEY is the variable under test. Everything else mirrors the regression
 * file's harness so this spec stays focused on the early configuration guard instead of
 * changing unrelated defaults at the same time.
 */
const mockEnvConfig = {
	...baseHarnessEnvConfig,
	SERP_API_KEY: ""
};
const mockConstants = createMockConstants();

/*
 * Mock boundary:
 * - axios must never be reached in the passing version of this test
 * - envConfig is mocked for all config import paths so the service always sees an empty key
 * - helpers, TaskManager, Kafka, and S3 stay mocked only to keep module loading deterministic
 */
jest.mock("axios", () => ({
	__esModule: true,
	default: {
		get: mockAxiosGet
	},
	get: mockAxiosGet,
	HttpStatusCode: {
		BadRequest: 400,
		FailedDependency: 424,
		NotFound: 404,
		UnprocessableEntity: 422
	},
	isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError)
}));

jest.mock("#configs/index", () => ({
	__esModule: true,
	envConfig: mockEnvConfig
}));

jest.mock("#configs", () => ({
	__esModule: true,
	envConfig: mockEnvConfig
}));

jest.mock("#configs/env.config", () => ({
	__esModule: true,
	envConfig: mockEnvConfig
}));

jest.mock("#constants", () => ({
	__esModule: true,
	...mockConstants
}));

jest.mock("#utils", () => ({
	__esModule: true,
	AddressUtil: {
		stringToParts: jest.fn((address: string) => ({
			raw: address
		}))
	},
	createOpenAIWithLogging: jest.fn(() => ({
		chat: {
			completions: {
				create: jest.fn(),
				parse: jest.fn()
			}
		}
	}))
}));

jest.mock("#helpers", () => ({
	...mockHelpersModule
}));

jest.mock("#helpers/index", () => ({
	...mockHelpersModule
}));

jest.mock("#helpers/kafka", () => ({
	__esModule: true,
	producer: {
		send: mockProducerSend
	}
}));

jest.mock("#common/common", () => ({
	__esModule: true,
	uploadRawIntegrationDataToS3: jest.fn()
}));

jest.mock("#api/v1/modules/tasks/taskManager", () => {
	class MockTaskManager {
		dbConnection: unknown;
		kafkaProducer: unknown;

		constructor(dbConnection?: unknown) {
			this.dbConnection = dbConnection;
			this.kafkaProducer = null;
		}

		async updateTaskStatus() {
			return mockTaskManagerGetEnrichedTask();
		}

		async sendTaskCompleteMessage() {
			return undefined;
		}

		async getOrCreateTaskForCode() {
			return "22222222-2222-4222-8222-222222222222";
		}
	}

	(MockTaskManager as any).getEnrichedTask = (...args: unknown[]) => mockTaskManagerGetEnrichedTask(...args);
	(MockTaskManager as any).saveRawResponseToDB = (...args: unknown[]) => mockTaskManagerSaveRawResponseToDB(...args);

	return {
		__esModule: true,
		TaskManager: MockTaskManager
	};
});

/*
 * Like the broader regression file, the service is required lazily so the real module binds
 * to the mocks above instead of production config and helper implementations.
 */
const loadDataScrapeService = () =>
	require("../dataScrapeService").DataScrapeService as typeof import("../dataScrapeService").DataScrapeService;

describe("searchSerpAPI missing SERP_API_KEY", () => {
	/*
	 * Branch under test:
	 * - SERP_API_KEY is empty at module load and method execution time
	 * - searchSerpAPI still wraps the failure in DS_I0005
	 * - axios.get must never run, proving the method fails closed before any Serp request
	 *
	 * Regression value:
	 * this protects the configuration guard separately from the broader service tests. If the
	 * key check moved later in the method, the test would fail even if the thrown error code
	 * stayed the same, because network access would start happening too early.
	 */
	it("wraps a missing SERP_API_KEY in DS_I0005 before making a Serp request", async () => {
		const DataScrapeService = loadDataScrapeService();
		const service = new DataScrapeService();

		await expect(
			service.searchSerpAPI({
				businessID: businessID as any,
				businessName: defaultBusinessName,
				businessAddress: defaultBusinessAddress,
				taskID: taskID as any
			})
		).rejects.toMatchObject({
			errorCode: "DS_I0005"
		});

		expect(mockAxiosGet).not.toHaveBeenCalled();
	});
});

export {};

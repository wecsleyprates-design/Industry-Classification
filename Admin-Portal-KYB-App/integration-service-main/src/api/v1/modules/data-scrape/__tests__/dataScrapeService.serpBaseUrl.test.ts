import {
	baseHarnessEnvConfig,
	businessID,
	createMockConstants,
	defaultBusinessAddress,
	defaultBusinessName,
	taskID
} from "./test.utils";

/*
 * Scope: DataScrapeService uses envConfig.SERP_API_BASE_URL for Serp maps (/search)
 * and reviews (/search.json) requests. Env resolution rules live in config-layer tests.
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

const mockEnvConfig = { ...baseHarnessEnvConfig };
const mockConstants = createMockConstants();

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

const loadDataScrapeService = () => {
	let DataScrapeService;
	jest.isolateModules(() => {
		DataScrapeService = require("../dataScrapeService").DataScrapeService as typeof import("../dataScrapeService").DataScrapeService;
	});
	return DataScrapeService;
};

const localSerpBaseUrl = "http://127.0.0.1:18765";

describe("Serp base URL (envConfig.SERP_API_BASE_URL)", () => {
	beforeEach(() => {
		mockAxiosGet.mockReset();
		mockEnvConfig.SERP_API_BASE_URL = baseHarnessEnvConfig.SERP_API_BASE_URL;
	});

	it("searchSerpAPI requests maps data from configured /search origin", async () => {
		mockEnvConfig.SERP_API_BASE_URL = localSerpBaseUrl;
		mockAxiosGet.mockResolvedValue({ data: { local_results: [], place_results: null } });

		const DataScrapeService = loadDataScrapeService();
		const service = new DataScrapeService();
		const res = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any
		});

		expect(res.message).toBe("No business match or local results found");
		expect(mockAxiosGet).toHaveBeenCalledTimes(1);
		const url = mockAxiosGet.mock.calls[0][0] as string;
		expect(url.startsWith(`${localSerpBaseUrl}/search?`)).toBe(true);
		expect(url).toContain("engine=google_maps");
		expect(url).toContain(`api_key=${mockEnvConfig.SERP_API_KEY}`);
	});

	it("scrapeGoogleReviews prepends api_key for the configured /search.json origin", async () => {
		mockEnvConfig.SERP_API_BASE_URL = localSerpBaseUrl;
		mockAxiosGet.mockResolvedValue({ data: { reviews: [] } });

		const DataScrapeService = loadDataScrapeService();
		const service = new DataScrapeService();
		await service.scrapeGoogleReviews(
			`${localSerpBaseUrl}/search.json?engine=google_maps_reviews&data_id=test-data-id`
		);

		expect(mockAxiosGet).toHaveBeenCalledTimes(1);
		const url = mockAxiosGet.mock.calls[0][0] as string;
		expect(url.startsWith(`${localSerpBaseUrl}/search.json?api_key=`)).toBe(true);
		expect(url).toContain("engine=google_maps_reviews");
		expect(url).toContain("data_id=test-data-id");
	});

	it("scrapeGoogleReviews uses the default Serp base URL when no override is configured", async () => {
		mockAxiosGet.mockResolvedValue({ data: { reviews: [] } });

		const DataScrapeService = loadDataScrapeService();
		const service = new DataScrapeService();
		await service.scrapeGoogleReviews(
			"https://serpapi.com/search.json?engine=google_maps_reviews&data_id=test-data-id"
		);

		const url = mockAxiosGet.mock.calls[0][0] as string;
		expect(url.startsWith(`${baseHarnessEnvConfig.SERP_API_BASE_URL}/search.json?api_key=`)).toBe(true);
	});
});

export {};

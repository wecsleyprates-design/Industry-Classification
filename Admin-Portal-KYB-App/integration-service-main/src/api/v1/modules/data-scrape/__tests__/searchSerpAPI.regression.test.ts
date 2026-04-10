import {
	baseHarnessEnvConfig,
	buildBusinessLegitimacyClassification,
	buildDatadogStylePlaceResult,
	buildLocalResult,
	buildPlaceResult,
	buildReview,
	buildReviewSynthesis,
	buildSerializedWebsiteData,
	businessID,
	createMockConstants,
	defaultBusinessAddress,
	defaultBusinessName,
	localResultsFoundMessage,
	serviceSuccessMessage,
	taskID,
	timeoutDegradedMessage
} from "./test.utils";

/*
 * Scope: this file documents only the regression coverage added around
 * DataScrapeService.searchSerpAPI for the search-business-details work.
 *
 * This is a service-level harness, not an HTTP route test:
 * - real DataScrapeService code runs
 * - axios, envConfig, helpers, task manager, S3 upload, and Kafka producer are mocked
 * - assertions focus on orchestration, branch selection, and side effects
 *
 * Sibling coverage:
 * - search-business-details.routes.test.ts locks down the HTTP contract, middleware order,
 *   and controller argument mapping
 * - searchSerpAPI.serpKey.test.ts isolates the empty SERP_API_KEY guard
 */
const mockSqlTransaction = jest.fn();
const mockSqlQuery = jest.fn();
const mockGetFlagValue = jest.fn();
const mockProducerSend = jest.fn();
const mockUploadRawIntegrationDataToS3 = jest.fn();
const mockTaskManagerGetEnrichedTask = jest.fn();
const mockTaskManagerSaveRawResponseToDB = jest.fn();
const mockAddressUtil = {
	stringToParts: jest.fn((address: string) => ({
		raw: address
	}))
};
const mockLogger = {
	info: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	warn: jest.fn()
};
const mockAxiosGet = jest.fn();
const mockHelpersModule = {
	__esModule: true,
	getBusinessDetails: jest.fn(),
	getBusinessDetailsForTaxConsent: jest.fn(),
	getFlagValue: mockGetFlagValue,
	internalGetBusinessNamesAndAddresses: jest.fn(),
	logger: mockLogger,
	sqlQuery: mockSqlQuery,
	sqlTransaction: mockSqlTransaction,
	db: jest.fn(),
	producer: {
		send: mockProducerSend
	}
};

const mockEnvConfig = { ...baseHarnessEnvConfig };
const mockConstants = createMockConstants();

/*
 * Mock boundary:
 * - axios stands in for the Serp HTTP client
 * - envConfig is registered for every config import path the service graph may use
 * - helpers provide fake SQL, logger, flags, db, and Kafka producer behavior
 * - TaskManager and S3 upload are mocked so persistence and messaging can be asserted
 *   without touching real infrastructure
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
	AddressUtil: mockAddressUtil,
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
	uploadRawIntegrationDataToS3: mockUploadRawIntegrationDataToS3
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
 * DataScrapeService is required lazily so the real module binds to the mocks above instead
 * of the production axios/config/helper graph at import time.
 */
const loadDataScrapeService = () =>
	require("../dataScrapeService").DataScrapeService as typeof import("../dataScrapeService").DataScrapeService;

const serializedWebsiteData = buildSerializedWebsiteData();
const businessLegitimacyClassification = buildBusinessLegitimacyClassification();
const reviewSynthesis = buildReviewSynthesis();

const buildEnrichedTask = () =>
	({
		id: taskID,
		connection_id: "connection-1",
		metadata: {}
	}) as any;

/*
 * Refactor-oriented helper:
 * the Linear performance plan expects some downstream persistence to become less strictly
 * sequential. New additive tests can therefore assert which logical insert batches happened
 * without depending on the current call order of mockSqlTransaction.
 */
const getSqlTransactionLabels = () => mockSqlTransaction.mock.calls.map(call => call[0][0] as string);

/*
 * buildService creates a real DataScrapeService instance, then stubs expensive helpers and
 * non-public SQL-builder methods so these tests can prove branch behavior and side-effect order
 * without asserting the raw SQL text or calling OpenAI/Serp-backed enrichment logic directly.
 */
const buildService = () => {
	const DataScrapeService = loadDataScrapeService();
	const service = new DataScrapeService();

	jest.spyOn(service, "getOrCreateTaskForCode").mockResolvedValue(taskID as any);
	jest.spyOn(service, "updateTaskStatus").mockResolvedValue(buildEnrichedTask());
	jest.spyOn(service as any, "sendTaskCompleteMessage").mockResolvedValue(undefined as any);
	jest.spyOn(service, "serializeWebsite").mockResolvedValue(null as any);
	jest.spyOn(service, "classifyLegitimacy").mockResolvedValue(null as any);
	jest.spyOn(service, "scrapeGoogleReviews").mockResolvedValue([]);
	jest.spyOn(service, "synthesizeGoogleReviews").mockResolvedValue(null as any);
	jest.spyOn(service, "predictNaicsCode").mockResolvedValue(null);
	jest.spyOn(service, "determineIndustryConfidence").mockResolvedValue("");

	jest.spyOn(service as any, "getLocalResultAddressDetails").mockResolvedValue([
		{
			addressDetails: {
				raw: defaultBusinessAddress
			},
			source: "serp",
			placeId: "local-place-1"
		}
	]);
	jest.spyOn(service as any, "buildGoogleMapsSerpQueryInsert").mockReturnValue(["insert_serp", ["serp-values"]]);
	jest.spyOn(service as any, "buildSerializedWebsiteScrapeInsert").mockReturnValue([
		"insert_website",
		["website-values"]
	]);
	jest.spyOn(service as any, "buildReviewsInsert").mockReturnValue(["insert_reviews", ["review-values"]]);
	jest.spyOn(service as any, "buildInferredBusinessClassificationInsert").mockReturnValue([
		"insert_classification",
		["classification-values"]
	]);
	jest.spyOn(service as any, "buildBusinessReviewSynthesisInsert").mockReturnValue([
		"insert_synthesis",
		["synthesis-values"]
	]);

	return service;
};

describe("searchSerpAPI regression coverage", () => {
	/*
	 * Baseline world for every test:
	 * - the feature flag defaults to false unless a test overrides it
	 * - SQL, S3, Kafka, and task-manager helpers all succeed
	 * - tests opt into a branch by changing only the axios payload or a small number of spies
	 */
	beforeEach(() => {
		jest.clearAllMocks();

		mockGetFlagValue.mockResolvedValue(false);
		mockSqlTransaction.mockResolvedValue([]);
		mockSqlQuery.mockResolvedValue({ rows: [] });
		mockUploadRawIntegrationDataToS3.mockResolvedValue(undefined);
		mockProducerSend.mockResolvedValue(undefined);
		mockTaskManagerGetEnrichedTask.mockResolvedValue(buildEnrichedTask());
		mockTaskManagerSaveRawResponseToDB.mockResolvedValue({} as any);
	});

	/*
	 * Branch under test:
	 * - Serp returns local_results but no direct place_results match
	 * - the service should preserve the fallback payload and save the raw response for later use
	 * - this branch must not trigger the heavier S3 or Kafka side effects reserved for a true match
	 *
	 * Regression value:
	 * the search-business-details flow depends on this path to surface "closest local results"
	 * without pretending a business match exists or skipping the raw-response audit trail.
	 */
	it("returns local results and saves the raw response when no direct match is found", async () => {
		const service = buildService();
		const localResult = buildLocalResult();

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				local_results: [localResult]
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress
		});

		expect(response).toMatchObject({
			businessMatch: null,
			local_results: [localResult],
			message: localResultsFoundMessage
		});
		expect(service.getOrCreateTaskForCode).toHaveBeenCalledWith({
			taskCode: "fetch_business_entity_website_details"
		});
		expect(mockTaskManagerGetEnrichedTask).toHaveBeenCalledWith(taskID);
		expect(mockTaskManagerSaveRawResponseToDB).toHaveBeenCalledWith(
			{
				businessMatch: null,
				local_results: [localResult],
				rawSerpResponse: {
					local_results: [localResult]
				}
			},
			businessID,
			expect.objectContaining({ id: taskID }),
			mockConstants.INTEGRATION_ID.SERP_SCRAPE,
			"fetch_business_entity_website_details"
		);
		expect(mockUploadRawIntegrationDataToS3).not.toHaveBeenCalled();
		expect(mockProducerSend).not.toHaveBeenCalled();
	});

	/*
	 * Branch under test:
	 * - bulk search is enabled
	 * - PAT_64 feature-flag lookup resolves true
	 * - the first local result is promoted into businessMatch/topLocalResult
	 *
	 * Regression value:
	 * this keeps the feature-flagged bulk fallback behavior observable. If the flag stops
	 * being consulted or the promotion logic drifts, bulk onboarding searches can degrade
	 * without breaking simpler place-match tests.
	 */
	it("promotes the first local result for bulk searches when PAT_64 is enabled", async () => {
		const service = buildService();
		const localResult = buildLocalResult();

		mockGetFlagValue.mockResolvedValueOnce(true);
		mockAxiosGet.mockResolvedValueOnce({
			data: {
				local_results: [localResult]
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: "Bulk Search Business",
			businessAddress: `${localResult.title}, ${localResult.address}`,
			taskID: taskID as any,
			is_bulk: true,
			includeIndustryAndWebsiteData: false
		});

		expect(mockGetFlagValue).toHaveBeenCalledWith(mockConstants.FEATURE_FLAGS.PAT_64_SERP_LOGIC_UPDATE);
		expect(response.businessMatch).toEqual(localResult);
		expect(response.topLocalResult).toEqual(localResult);
	});

	/*
 * Branch under test:
 * - bulk search is enabled
 * - PAT_64 is enabled, so the stricter promotion guard runs
 * - the first fuzzy local result is missing a usable type_id
 *
 * Datadog provenance:
 * observed bulk onboarding searches can surface fuzzy local rows with incomplete identifiers,
 * so the type_id gate needs its own negative regression case.
 */
it("keeps the local-results fallback when PAT_64 is enabled but the first local result has no type_id", async () => {
	const service = buildService();
	const localResult = buildLocalResult({
		type_id: undefined,
		type_ids: []
	});

	mockGetFlagValue.mockResolvedValueOnce(true);
	mockAxiosGet.mockResolvedValueOnce({
		data: {
			local_results: [localResult]
		}
	});

	const response = await service.searchSerpAPI({
		businessID: businessID as any,
		businessName: "Bulk Search Business",
		businessAddress: `${localResult.title}, ${localResult.address}`,
		is_bulk: true
	});

	expect(mockGetFlagValue).toHaveBeenCalledWith(mockConstants.FEATURE_FLAGS.PAT_64_SERP_LOGIC_UPDATE);
	expect(response).toMatchObject({
		businessMatch: null,
		local_results: [localResult],
		message: localResultsFoundMessage
	});
	expect(service.getOrCreateTaskForCode).toHaveBeenCalledWith({
		taskCode: "fetch_business_entity_website_details"
	});
	expect(mockTaskManagerSaveRawResponseToDB).toHaveBeenCalledWith(
		{
			businessMatch: null,
			local_results: [localResult],
			rawSerpResponse: {
				local_results: [localResult]
			}
		},
		businessID,
		expect.objectContaining({ id: taskID }),
		mockConstants.INTEGRATION_ID.SERP_SCRAPE,
		"fetch_business_entity_website_details"
	);
	expect(mockSqlTransaction).not.toHaveBeenCalled();
	expect(mockSqlQuery).not.toHaveBeenCalled();
	expect(mockUploadRawIntegrationDataToS3).not.toHaveBeenCalled();
	expect(mockProducerSend).not.toHaveBeenCalled();
});

/*
 * Branch under test:
 * - bulk search is enabled
 * - PAT_64 is enabled, so the stricter promotion guard runs
 * - the first fuzzy local result has a type_id, but its "title, address" string does not
 *   match the caller's businessAddress
 *
 * Datadog provenance:
 * observed fuzzy sibling rows can differ from the canonical caller address/title pair, so the
 * title-and-address sanity check needs its own regression lock.
 */
it("keeps the local-results fallback when PAT_64 is enabled but the first local result fails the title/address sanity check", async () => {
	const service = buildService();
	const localResult = buildLocalResult({
		title: "Park Wood Apartments - Northwood Property Management",
		address: "432 Henry St, Exampletown, WI 54165",
		type_id: "property_management_company",
		type_ids: ["property_management_company"]
	});

	mockGetFlagValue.mockResolvedValueOnce(true);
	mockAxiosGet.mockResolvedValueOnce({
		data: {
			local_results: [localResult]
		}
	});

	const response = await service.searchSerpAPI({
		businessID: businessID as any,
		businessName: "Bulk Search Business",
		businessAddress: localResult.address,
		is_bulk: true
	});

	expect(mockGetFlagValue).toHaveBeenCalledWith(mockConstants.FEATURE_FLAGS.PAT_64_SERP_LOGIC_UPDATE);
	expect(response).toMatchObject({
		businessMatch: null,
		local_results: [localResult],
		message: localResultsFoundMessage
	});
	expect(service.getOrCreateTaskForCode).toHaveBeenCalledWith({
		taskCode: "fetch_business_entity_website_details"
	});
	expect(mockTaskManagerSaveRawResponseToDB).toHaveBeenCalledWith(
		{
			businessMatch: null,
			local_results: [localResult],
			rawSerpResponse: {
				local_results: [localResult]
			}
		},
		businessID,
		expect.objectContaining({ id: taskID }),
		mockConstants.INTEGRATION_ID.SERP_SCRAPE,
		"fetch_business_entity_website_details"
	);
	expect(mockSqlTransaction).not.toHaveBeenCalled();
	expect(mockSqlQuery).not.toHaveBeenCalled();
	expect(mockUploadRawIntegrationDataToS3).not.toHaveBeenCalled();
	expect(mockProducerSend).not.toHaveBeenCalled();
});

/*
	 * Branch under test:
	 * - bulk search is enabled
	 * - PAT_64 lookup resolves false
	 * - the current implementation still promotes the first local result
	 *
	 * Regression value:
	 * the enabled and disabled flag paths are both locked down so a future change does not
	 * accidentally make promotion depend on only one flag state.
	 */
	it("promotes the first local result for bulk searches when PAT_64 is disabled", async () => {
		const service = buildService();
		const localResult = buildLocalResult();

		mockGetFlagValue.mockResolvedValueOnce(false);
		mockAxiosGet.mockResolvedValueOnce({
			data: {
				local_results: [localResult]
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: "Bulk Search Business",
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any,
			is_bulk: true,
			includeIndustryAndWebsiteData: false
		});

		expect(response.businessMatch).toEqual(localResult);
		expect(response.topLocalResult).toEqual(localResult);
	});

	/*
	 * Branch under test:
	 * - a real place_results match exists
	 * - reviews are available
	 * - persistGoogleReviews is explicitly false
	 *
	 * Regression value:
	 * callers need a way to suppress review-row persistence without losing the rest of the Serp
	 * scrape. The test proves the review insert builder is skipped while the remaining SQL work
	 * stays in the exact order currently expected.
	 */
	it("skips review inserts when persistGoogleReviews is false", async () => {
		const service = buildService();
		const placeResult = buildPlaceResult();
		const review = buildReview();

		jest.spyOn(service, "scrapeGoogleReviews").mockResolvedValue([review]);
		jest.spyOn(service, "synthesizeGoogleReviews").mockResolvedValue(reviewSynthesis as any);

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				place_results: placeResult,
				local_results: []
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any,
			persistGoogleReviews: false,
			includeIndustryAndWebsiteData: false
		});

		expect(response.message).toBe(serviceSuccessMessage);
		expect((service as any).buildReviewsInsert).not.toHaveBeenCalled();
		expect(mockSqlTransaction.mock.calls).toEqual([
			[["insert_serp"], [["serp-values"]]],
			[["insert_synthesis"], [["synthesis-values"]]]
		]);
	});

	/*
	 * Branch under test:
	 * - a direct place_results match exists
	 * - website serialization, legitimacy classification, reviews, synthesis, raw upload,
	 *   task completion, and Kafka publishing all run
	 *
	 * Regression value:
	 * this is the heaviest branch in the search-business-details service path. The ordered SQL
	 * batches and downstream expectations are intentionally strict so dropped persistence, missing
	 * task metadata, or broken NAICS publishing fail loudly.
	 */
	it("persists downstream side effects for a place_results match", async () => {
		const service = buildService();
		const placeResult = buildPlaceResult();
		const review = buildReview();

		jest.spyOn(service, "serializeWebsite").mockResolvedValue(serializedWebsiteData as any);
		jest.spyOn(service, "classifyLegitimacy").mockResolvedValue(businessLegitimacyClassification as any);
		jest.spyOn(service, "scrapeGoogleReviews").mockResolvedValue([review]);
		jest.spyOn(service, "synthesizeGoogleReviews").mockResolvedValue(reviewSynthesis as any);

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				place_results: placeResult,
				local_results: []
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any
		});

		expect(response).toMatchObject({
			message: serviceSuccessMessage,
			businessMatch: placeResult,
			businessWebsite: placeResult.website,
			googleReviewsLink: placeResult.reviews_link,
			reviewSynthesis
		});
		expect(mockSqlTransaction.mock.calls).toEqual([
			[["insert_serp"], [["serp-values"]]],
			[["insert_website"], [["website-values"]]],
			[["insert_reviews"], [["review-values"]]],
			[["insert_classification"], [["classification-values"]]],
			[["insert_synthesis"], [["synthesis-values"]]]
		]);
		expect(mockSqlQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				values: [taskID, placeResult.rating, placeResult.rating, placeResult.reviews, 1, placeResult.website]
			})
		);
		expect(mockUploadRawIntegrationDataToS3).toHaveBeenCalledWith(
			expect.objectContaining({
				businessMatch: placeResult,
				rawSerpResponse: {
					place_results: placeResult,
					local_results: []
				},
				serializedWebsiteData,
				reviewSynthesis
			}),
			businessID,
			"business_serp_scrape",
			mockConstants.DIRECTORIES.BUSINESS_SERP_SCRAPE,
			"SERP"
		);
		expect(service.updateTaskStatus).toHaveBeenCalledWith(taskID, mockConstants.TASK_STATUS.SUCCESS);
		expect((service as any).sendTaskCompleteMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				id: taskID,
				metadata: expect.objectContaining({
					website: placeResult.website
				})
			})
		);
		expect(mockTaskManagerSaveRawResponseToDB).toHaveBeenCalledWith(
			expect.objectContaining({
				businessMatch: placeResult,
				rawSerpResponse: {
					place_results: placeResult,
					local_results: []
				}
			}),
			businessID,
			expect.objectContaining({ id: taskID }),
			mockConstants.INTEGRATION_ID.SERP_SCRAPE,
			"fetch_business_entity_website_details"
		);
		expect(mockProducerSend).toHaveBeenCalledWith({
			topic: mockConstants.kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessID,
					value: {
						event: mockConstants.kafkaEvents.UPDATE_NAICS_CODE,
						business_id: businessID,
						naics_code: businessLegitimacyClassification.naics_code,
						naics_title: "",
						platform: "serp_scrape",
						industry_code: serializedWebsiteData.industry_mapped
					}
				}
			]
		});
		expect(service.predictNaicsCode).not.toHaveBeenCalled();
		expect(service.determineIndustryConfidence).not.toHaveBeenCalled();
	});

	/*
	 * Branch under test:
	 * - a direct place_results match exists
	 * - website serialization succeeds, but legitimacy classification does not yield NAICS
	 * - the fallback prediction lane supplies a six-digit NAICS with HIGH confidence
	 *
	 * Regression value:
	 * the performance refactor intends to make NAICS prediction an independent downstream lane.
	 * This test locks the merge behavior that must survive that refactor: when classification
	 * cannot provide a usable NAICS, the service still publishes the predicted code to Kafka,
	 * while keeping the response payload grounded in the existing searchSerpAPIResponse shape.
	 */
	it("publishes predicted NAICS when classification does not provide one and confidence is HIGH", async () => {
		const service = buildService();
		const placeResult = buildPlaceResult();
		const predictedNaicsCode = "541611";
		const searchString = `${defaultBusinessName}, ${defaultBusinessAddress}`;

		jest.spyOn(service, "serializeWebsite").mockResolvedValue(serializedWebsiteData as any);
		jest.spyOn(service, "classifyLegitimacy").mockResolvedValue(null as any);
		jest.spyOn(service, "predictNaicsCode").mockResolvedValue(predictedNaicsCode);
		jest.spyOn(service, "determineIndustryConfidence").mockResolvedValue("HIGH");

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				place_results: placeResult,
				local_results: []
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any
		});

		expect(response).toMatchObject({
			message: serviceSuccessMessage,
			businessMatch: placeResult,
			serializedWebsiteData,
			businessLegitimacyClassification: null
		});
		expect(service.classifyLegitimacy).toHaveBeenCalledWith(serializedWebsiteData);
		expect(service.predictNaicsCode).toHaveBeenCalledWith(defaultBusinessName, "", placeResult.website);
		expect(service.determineIndustryConfidence).toHaveBeenCalledWith(searchString, predictedNaicsCode);
		expect(mockProducerSend).toHaveBeenCalledWith({
			topic: mockConstants.kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessID,
					value: {
						event: mockConstants.kafkaEvents.UPDATE_NAICS_CODE,
						business_id: businessID,
						naics_code: predictedNaicsCode,
						naics_title: "",
						platform: "serp_scrape",
						industry_code: serializedWebsiteData.industry_mapped
					}
				}
			]
		});
		expect(getSqlTransactionLabels()).toEqual(expect.arrayContaining(["insert_serp", "insert_website"]));
		expect(getSqlTransactionLabels()).toHaveLength(2);
	});

	/*
	 * Branch under test:
	 * - the same fallback prediction lane runs
	 * - predictNaicsCode returns a syntactically valid code
	 * - determineIndustryConfidence resolves to a non-HIGH value
	 *
	 * Regression value:
	 * the refactor must not turn every predicted code into a published update. This case pins the
	 * confidence gate so future parallelization still suppresses low-confidence NAICS updates.
	 */
	it("does not publish predicted NAICS when confidence is not HIGH", async () => {
		const service = buildService();
		const placeResult = buildPlaceResult();
		const predictedNaicsCode = "541611";
		const searchString = `${defaultBusinessName}, ${defaultBusinessAddress}`;

		jest.spyOn(service, "serializeWebsite").mockResolvedValue(serializedWebsiteData as any);
		jest.spyOn(service, "classifyLegitimacy").mockResolvedValue(null as any);
		jest.spyOn(service, "predictNaicsCode").mockResolvedValue(predictedNaicsCode);
		jest.spyOn(service, "determineIndustryConfidence").mockResolvedValue("LOW");

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				place_results: placeResult,
				local_results: []
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any
		});

		expect(response).toMatchObject({
			message: serviceSuccessMessage,
			businessMatch: placeResult,
			serializedWebsiteData,
			businessLegitimacyClassification: null
		});
		expect(service.classifyLegitimacy).toHaveBeenCalledWith(serializedWebsiteData);
		expect(service.predictNaicsCode).toHaveBeenCalledWith(defaultBusinessName, "", placeResult.website);
		expect(service.determineIndustryConfidence).toHaveBeenCalledWith(searchString, predictedNaicsCode);
		expect(mockProducerSend).not.toHaveBeenCalled();
		expect(getSqlTransactionLabels()).toEqual(expect.arrayContaining(["insert_serp", "insert_website"]));
		expect(getSqlTransactionLabels()).toHaveLength(2);
	});

	/*
 * Branch under test:
 * - a direct place_results match exists and still exposes a reviews_link
 * - review scraping succeeds
 * - the matched place result omits aggregate rating/review counts, so the synthesis guard fails
 *
 * Datadog provenance:
 * an observed search-business-details payload included a top-level place result with reviews_link,
 * website, unclaimed_listing, and type, but no top-level rating or reviews.
 */
it("skips review synthesis when reviews are scraped but the matched place result omits aggregate rating and review counts", async () => {
	const service = buildService();
	const placeResult = buildDatadogStylePlaceResult();
	const review = buildReview();

	jest.spyOn(service, "scrapeGoogleReviews").mockResolvedValue([review]);

	mockAxiosGet.mockResolvedValueOnce({
		data: {
			place_results: placeResult,
			local_results: []
		}
	});

	const response = await service.searchSerpAPI({
		businessID: businessID as any,
		businessName: placeResult.title,
		businessAddress: placeResult.address,
		taskID: taskID as any,
		includeIndustryAndWebsiteData: false
	});

	expect(response).toMatchObject({
		message: serviceSuccessMessage,
		businessMatch: placeResult,
		googleReviewsLink: placeResult.reviews_link,
		totalGoogleReviews: null,
		overallGoogleRating: null,
		topGoogleReviews: [review],
		reviewSynthesis: null
	});
	expect(service.serializeWebsite).not.toHaveBeenCalled();
	expect(service.scrapeGoogleReviews).toHaveBeenCalledWith(placeResult.reviews_link);
	expect(service.synthesizeGoogleReviews).not.toHaveBeenCalled();
	expect((service as any).buildBusinessReviewSynthesisInsert).not.toHaveBeenCalled();
	expect(getSqlTransactionLabels()).toEqual(expect.arrayContaining(["insert_serp", "insert_reviews"]));
	expect(getSqlTransactionLabels()).toHaveLength(2);
	expect(mockSqlQuery).toHaveBeenCalledWith(
		expect.objectContaining({
			values: [taskID, null, null, null, 1, placeResult.website]
		})
	);
});

/*
	 * Branch under test:
	 * - review scraping succeeds, so the synthesis lane is entered
	 * - synthesizeGoogleReviews rejects inside the method's try/catch
	 * - the rest of the pipeline still completes and persists the review scrape itself
	 *
	 * Regression value:
	 * the refactor plans to make scrape -> synthesize its own asynchronous lane. This test proves
	 * a synthesis failure remains non-fatal and does not suppress the rest of the successful Serp
	 * work that the search-business-details flow depends on.
	 */
	it("continues the pipeline when google review synthesis throws", async () => {
		const service = buildService();
		const placeResult = buildPlaceResult();
		const review = buildReview();

		jest.spyOn(service, "scrapeGoogleReviews").mockResolvedValue([review]);
		jest.spyOn(service, "synthesizeGoogleReviews").mockRejectedValueOnce(new Error("synthesis failed"));

		mockAxiosGet.mockResolvedValueOnce({
			data: {
				place_results: placeResult,
				local_results: []
			}
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: defaultBusinessName,
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any,
			includeIndustryAndWebsiteData: false
		});

		expect(response).toMatchObject({
			message: serviceSuccessMessage,
			businessMatch: placeResult,
			topGoogleReviews: [review],
			reviewSynthesis: null
		});
		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.any(Error),
			expect.stringContaining("Error synthesizing Google reviews")
		);
		expect((service as any).buildBusinessReviewSynthesisInsert).not.toHaveBeenCalled();
		expect(getSqlTransactionLabels()).toEqual(expect.arrayContaining(["insert_serp", "insert_reviews"]));
		expect(getSqlTransactionLabels()).toHaveLength(2);
		expect(mockUploadRawIntegrationDataToS3).toHaveBeenCalledWith(
			expect.objectContaining({
				businessMatch: placeResult,
				topGoogleReviews: [review],
				reviewSynthesis: null
			}),
			businessID,
			"business_serp_scrape",
			mockConstants.DIRECTORIES.BUSINESS_SERP_SCRAPE,
			"SERP"
		);
		expect(mockProducerSend).not.toHaveBeenCalled();
	});

	/*
	 * Branch under test:
	 * - axios reports a non-timeout error
	 * - the service should wrap it in DS_I0005 rather than return a degraded payload
	 *
	 * Regression value:
	 * callers distinguish generic Serp failures from timeout degradation. If those branches
	 * collapse into one another, route-level error mapping becomes inconsistent.
	 */
	it("wraps generic axios failures in DS_I0005", async () => {
		const service = buildService();

		mockAxiosGet.mockRejectedValueOnce({
			message: "serp failed",
			code: "ERR_NETWORK",
			isAxiosError: true
		});

		await expect(
			service.searchSerpAPI({
				businessID: businessID as any,
				businessName: "Broken Search",
				businessAddress: defaultBusinessAddress,
				taskID: taskID as any
			})
		).rejects.toMatchObject({
			errorCode: "DS_I0005"
		});
	});

	/*
	 * Branch under test:
	 * - axios reports ECONNABORTED, the timeout path
	 * - the service returns a degraded but stable payload shape instead of throwing
	 * - no SQL, S3, or Kafka side effects should run on that degraded path
	 *
	 * Regression value:
	 * timeouts are intentionally more user-safe than generic Serp failures. This test keeps
	 * that distinction explicit and protects the empty fallback payload shape that callers expect.
	 */
	it("returns a degraded payload when axios times out", async () => {
		const service = buildService();

		mockAxiosGet.mockRejectedValueOnce({
			message: "timed out",
			code: "ECONNABORTED",
			isAxiosError: true
		});

		const response = await service.searchSerpAPI({
			businessID: businessID as any,
			businessName: "Slow Search",
			businessAddress: defaultBusinessAddress,
			taskID: taskID as any
		});

		expect(response).toEqual({
			message: timeoutDegradedMessage,
			businessMatch: null,
			parsedBusinessMatchAddressDetails: null,
			local_results: [],
			parsedLocalResultAddressDetails: [],
			topLocalResult: null,
			businessWebsite: null,
			googleReviewsLink: null,
			totalGoogleReviews: null,
			overallGoogleRating: null,
			topGoogleReviews: [],
			reviewSynthesis: null
		});
		expect(mockSqlTransaction).not.toHaveBeenCalled();
		expect(mockUploadRawIntegrationDataToS3).not.toHaveBeenCalled();
		expect(mockProducerSend).not.toHaveBeenCalled();
	});
});

export {};

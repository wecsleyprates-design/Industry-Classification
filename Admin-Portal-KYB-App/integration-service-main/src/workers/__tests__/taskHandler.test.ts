import { EVENTS, QUEUES } from "#constants";
import { WORKER_TYPES } from "#constants/environments.constant";

jest.mock("openai");

jest.mock("#helpers/redis", () => ({
	redis: {
		hgetall: jest.fn(),
		hset: jest.fn(),
		expire: jest.fn(),
		hincrby: jest.fn(),
		delete: jest.fn(),
		get: jest.fn(),
		setex: jest.fn(),
		incr: jest.fn()
	},
	createClusterClient: jest.fn(),
	redisConnect: jest.fn(),
	redisConfig: { ecClusterMode: false, conn: {} }
}));

jest.mock("#helpers/kafka", () => ({
	producer: { send: jest.fn(), init: jest.fn() },
	consumer: { init: jest.fn(), run: jest.fn() }
}));

jest.mock("#workers/stateUpdateQueue", () => ({ stateQueue: {} }));
jest.mock("#messaging/index", () => ({ kafkaToQueue: jest.fn() }));

type QueueRegistration = {
	queueName: string;
	eventName: string;
};

const mockRegistrations: QueueRegistration[] = [];

jest.mock("#helpers/bull-queue", () => {
	const BullQueueMock = jest.fn().mockImplementation((queueName: string) => ({
		addJob: jest.fn(),
		queue: {
			name: queueName,
			process: jest.fn((eventName: string) => {
				mockRegistrations.push({ queueName, eventName });
			}),
			on: jest.fn(),
			setMaxListeners: jest.fn(),
			getJobCounts: jest.fn().mockResolvedValue({})
		}
	}));
	return { __esModule: true, default: BullQueueMock };
});

const { envConfig } = require("#configs/env.config");

describe("initTaskWorker - Worker Type Isolation", () => {
	beforeEach(() => {
		mockRegistrations.length = 0;
	});

	const loadAndInit = (workerType?: string) => {
		envConfig.WORKER_TYPE = workerType;

		jest.isolateModules(() => {
			const { initTaskWorker } = require("../taskHandler");
			initTaskWorker();
		});
	};

	const getRegisteredEvents = (queueName?: string): string[] =>
		mockRegistrations
			.filter(registration => !queueName || registration.queueName === queueName)
			.map(registration => registration.eventName);

	const getQueuesForEvent = (eventName: string): string[] =>
		mockRegistrations
			.filter(registration => registration.eventName === eventName)
			.map(registration => registration.queueName);

	describe(`WORKER_TYPE=${WORKER_TYPES.CRITICAL}`, () => {
		it("should register handlers ONLY on dedicated queues, NOT on taskQueue", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.ENTITY_MATCHING);
			expect(events).toContain(EVENTS.FIRMOGRAPHICS_EVENT);
			expect(events).toContain(EVENTS.OPEN_CORPORATES_MATCH);
			expect(events).toContain(EVENTS.ZOOMINFO_MATCH);
			expect(events).toContain(EVENTS.NPI_BUSINESS_MATCH);
			expect(events).toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
			expect(events).toContain(EVENTS.BUSINESS_INVITE_ACCEPTED);

			expect(getQueuesForEvent(EVENTS.ENTITY_MATCHING)).toEqual([QUEUES.ENTITY_MATCHING]);
			expect(getQueuesForEvent(EVENTS.FIRMOGRAPHICS_EVENT)).toEqual([QUEUES.FIRMOGRAPHICS]);
			expect(getQueuesForEvent(EVENTS.OPEN_CORPORATES_MATCH)).toEqual([QUEUES.OPEN_CORPORATES]);
			expect(getQueuesForEvent(EVENTS.ZOOMINFO_MATCH)).toEqual([QUEUES.ZOOMINFO]);
			expect(getQueuesForEvent(EVENTS.NPI_BUSINESS_MATCH)).toEqual([QUEUES.NPI]);
			expect(getQueuesForEvent(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS)).toEqual([QUEUES.CASE_SUBMITTED]);
			expect(getQueuesForEvent(EVENTS.BUSINESS_INVITE_ACCEPTED)).toEqual([QUEUES.BUSINESS_ONBOARDING]);
			expect(getRegisteredEvents(QUEUES.TASK)).toHaveLength(0);
		});

		it("should NOT register CASE_SUBMITTED_EXECUTE_TASKS on the shared task queue", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const taskQueueEvents = getRegisteredEvents(QUEUES.TASK);

			expect(taskQueueEvents).not.toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
		});

		it("should NOT register any general-only handlers", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const taskQueueEvents = getRegisteredEvents(QUEUES.TASK);

			const generalOnlyEvents = [
				EVENTS.PLAID_ASSET_REPORT,
				EVENTS.REFRESH_SCORE,
				EVENTS.INTEGRATION_DATA_UPLOADED,
				EVENTS.OCR_PARSE_DOCUMENT,
				EVENTS.OCR_VALIDATE_DOCUMENT_TYPE,
				EVENTS.FETCH_ASSET_REPORT,
				EVENTS.LINK_WEBHOOK,
				EVENTS.PURGE_BUSINESS,
				EVENTS.INTEGRATION_DATA_READY,
				EVENTS.KYX_MATCH,
				EVENTS.MATCH_PRO_BULK,
				EVENTS.CASE_UPDATED_AUDIT
			];

			for (const event of generalOnlyEvents) {
				expect(taskQueueEvents).not.toContain(event);
			}
		});
	});

	describe(`WORKER_TYPE=${WORKER_TYPES.GENERAL}`, () => {
		it("should register CASE_SUBMITTED_EXECUTE_TASKS on the shared task queue", () => {
			loadAndInit(WORKER_TYPES.GENERAL);

			expect(getQueuesForEvent(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS)).toEqual([QUEUES.TASK]);
		});

		it("should register only the remaining pre-migration drain handlers on taskQueue", () => {
			loadAndInit(WORKER_TYPES.GENERAL);
			const taskQueueEvents = getRegisteredEvents(QUEUES.TASK);

			expect(taskQueueEvents).toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
			expect(taskQueueEvents).toContain(EVENTS.BUSINESS_INVITE_ACCEPTED);
			expect(taskQueueEvents).not.toContain(EVENTS.ENTITY_MATCHING);
			expect(taskQueueEvents).not.toContain(EVENTS.FIRMOGRAPHICS_EVENT);
			expect(taskQueueEvents).not.toContain(EVENTS.OPEN_CORPORATES_MATCH);
			expect(taskQueueEvents).not.toContain(EVENTS.ZOOMINFO_MATCH);
			expect(taskQueueEvents).not.toContain(EVENTS.NPI_BUSINESS_MATCH);
		});

		it("should register all general event handlers", () => {
			loadAndInit(WORKER_TYPES.GENERAL);
			const taskQueueEvents = getRegisteredEvents(QUEUES.TASK);

			const expectedEvents = [
				EVENTS.PLAID_ASSET_REPORT,
				EVENTS.REFRESH_SCORE,
				EVENTS.INTEGRATION_DATA_UPLOADED,
				EVENTS.OCR_PARSE_DOCUMENT,
				EVENTS.OCR_VALIDATE_DOCUMENT_TYPE,
				EVENTS.FETCH_ASSET_REPORT,
				EVENTS.LINK_WEBHOOK,
				EVENTS.PURGE_BUSINESS,
				EVENTS.INTEGRATION_DATA_READY,
				EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS,
				EVENTS.FETCH_GOOGLE_PROFILE,
				EVENTS.KYX_MATCH,
				EVENTS.MATCH_PRO_BULK,
				EVENTS.CASE_UPDATED_AUDIT,
				EVENTS.BUSINESS_INVITE_ACCEPTED,
				EVENTS.FETCH_ADVERSE_MEDIA_REPORT,
				EVENTS.OWNER_UPDATED
			];

			for (const event of expectedEvents) {
				expect(taskQueueEvents).toContain(event);
			}
		});
	});

	describe("WORKER_TYPE=undefined (legacy mode)", () => {
		it("should register handlers on both dedicated queues AND taskQueue", () => {
			loadAndInit(undefined);

			expect(getQueuesForEvent(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS)).toEqual(
				expect.arrayContaining([QUEUES.CASE_SUBMITTED, QUEUES.TASK])
			);
			expect(getQueuesForEvent(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS)).toHaveLength(2);
			expect(getQueuesForEvent(EVENTS.BUSINESS_INVITE_ACCEPTED)).toEqual(
				expect.arrayContaining([QUEUES.BUSINESS_ONBOARDING, QUEUES.TASK])
			);
			expect(getQueuesForEvent(EVENTS.BUSINESS_INVITE_ACCEPTED)).toHaveLength(2);
			expect(getQueuesForEvent(EVENTS.ENTITY_MATCHING)).toEqual([QUEUES.ENTITY_MATCHING]);
		});

		it("should register all general handlers in legacy mode", () => {
			loadAndInit(undefined);
			const taskQueueEvents = getRegisteredEvents(QUEUES.TASK);

			expect(taskQueueEvents).toContain(EVENTS.PLAID_ASSET_REPORT);
			expect(taskQueueEvents).toContain(EVENTS.REFRESH_SCORE);
			expect(taskQueueEvents).toContain(EVENTS.INTEGRATION_DATA_UPLOADED);
			expect(taskQueueEvents).toContain(EVENTS.KYX_MATCH);
			expect(taskQueueEvents).toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
			expect(taskQueueEvents).toContain(EVENTS.BUSINESS_INVITE_ACCEPTED);
		});
	});
});

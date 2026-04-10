import { workflowManager } from "#core";
import { workflowQueue } from "#workers/workflowWorker";
import { EVENTS } from "#constants";
import { type WorkflowJobData } from "#core/workflow/types";
import { type WorkflowNotificationData } from "#core/types";

// Mock uuid module to fix ESM import issues
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

jest.mock("#database", () => ({}));
jest.mock("#helpers/redis", () => ({}));
jest.mock("#helpers/bullQueue", () => ({}));
jest.mock("#configs", () => ({
	envConfig: {
		DB_HOST: "localhost",
		DB_PORT: 5432,
		DB_NAME: "test",
		DB_USER: "test",
		DB_PASSWORD: "test"
	},
	workflowConfig: {
		processingQueue: {
			delay: 120000
		},
		versioning: {
			versionGeneratingFields: ["trigger_id", "rules.priority", "rules.conditions", "rules.actions", "default_action"],
			logAllChanges: true
		}
	}
}));

jest.mock("#workers/workflowWorker", () => ({
	workflowQueue: {
		queue: {
			add: jest.fn()
		}
	}
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		child: jest.fn(() => ({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn()
		}))
	},
	pinoHttpLogger: jest.fn()
}));

describe("WorkflowsService", () => {
	let _workflowsService: typeof workflowManager;
	let mockJob: { id: string; data: Record<string, unknown> };

	beforeEach(() => {
		_workflowsService = workflowManager;
		mockJob = {
			id: "job-123",
			data: {}
		};

		jest.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T10:00:00.000Z").getTime());

		jest.clearAllMocks();
		(workflowQueue.queue.add as jest.Mock).mockResolvedValue(mockJob);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("notifyWorkflow", () => {
		const validRequest: WorkflowNotificationData = {
			case_id: "123e4567-e89b-12d3-a456-426614174000",
			customer_id: "987fcdeb-51a2-43d1-b789-123456789abc"
		};

		it("should successfully queue workflow job with correct data", async () => {
			const result = await workflowManager.notifyWorkflow(validRequest);

			expect(workflowQueue.queue.add).toHaveBeenCalledWith(EVENTS.PROCESS_WORKFLOW, {
				case_id: validRequest.case_id,
				customer_id: validRequest.customer_id,
				enqueued_at: expect.any(String) as string
			});

			expect(result).toEqual({
				message: "Workflow notification received and queued for processing",
				job_id: (mockJob as { id: string }).id,
				estimated_processing_time: expect.any(String) as string
			});
		});

		it("should generate valid enqueued_at timestamp", async () => {
			const beforeTime = new Date().getTime();

			await workflowManager.notifyWorkflow(validRequest);

			const afterTime = new Date().getTime();
			const callArgs = (workflowQueue.queue.add as jest.Mock).mock.calls[0] as unknown[];
			const jobData = callArgs[1] as WorkflowJobData;
			const enqueuedAt = new Date(jobData.enqueued_at).getTime();

			expect(enqueuedAt).toBeGreaterThanOrEqual(beforeTime);
			expect(enqueuedAt).toBeLessThanOrEqual(afterTime);
		});

		it("should calculate correct estimated processing time", async () => {
			const mockDate = new Date("2024-01-01T10:00:00.000Z");
			jest.useFakeTimers();
			jest.setSystemTime(mockDate);

			const result = await workflowManager.notifyWorkflow(validRequest);

			const expectedTime = mockDate.toISOString();
			expect(result.estimated_processing_time).toBe(expectedTime);

			jest.useRealTimers();
		});

		it("should handle queue.add failure gracefully", async () => {
			const queueError = new Error("Redis connection failed");
			(workflowQueue.queue.add as jest.Mock).mockRejectedValue(queueError);

			await expect(workflowManager.notifyWorkflow(validRequest)).rejects.toThrow("Redis connection failed");
		});

		it("should use correct event constant", async () => {
			await workflowManager.notifyWorkflow(validRequest);

			expect(workflowQueue.queue.add).toHaveBeenCalledWith(EVENTS.PROCESS_WORKFLOW, expect.any(Object));
		});

		it("should handle different case and customer IDs", async () => {
			const differentRequest: WorkflowNotificationData = {
				case_id: "different-case-id",
				customer_id: "different-customer-id"
			};

			await workflowManager.notifyWorkflow(differentRequest);

			const callArgs = (workflowQueue.queue.add as jest.Mock).mock.calls[0] as unknown[];
			const jobData = callArgs[1] as WorkflowJobData;
			expect(jobData.case_id).toBe("different-case-id");
			expect(jobData.customer_id).toBe("different-customer-id");
		});

		it("should handle different case and customer IDs", async () => {
			const differentRequest: WorkflowNotificationData = {
				case_id: "different-case-id",
				customer_id: "different-customer-id"
			};

			await workflowManager.notifyWorkflow(differentRequest);

			const callArgs = (workflowQueue.queue.add as jest.Mock).mock.calls[0] as unknown[];
			const jobData = callArgs[1] as WorkflowJobData;
			expect(jobData.case_id).toBe("different-case-id");
			expect(jobData.customer_id).toBe("different-customer-id");
		});

		it("should return job_id from queue response", async () => {
			const customJobId = "custom-job-789";
			(workflowQueue.queue.add as jest.Mock).mockResolvedValue({ id: customJobId });

			const result = await workflowManager.notifyWorkflow(validRequest);

			expect(result.job_id).toBe(customJobId);
		});
	});
});

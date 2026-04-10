import { OrchestratorService } from "../orchestratorService";
import type { RedisClient } from "#helpers/redis";
import type { WorkflowManager } from "#core/workflow";
import type { CaseService } from "#services/case";
import {
	ORCHESTRATOR_CLAIMED_KEY_PREFIX,
	ORCHESTRATOR_STATE_KEY_PREFIX,
	ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX,
	ORCHESTRATOR_STATE_TTL_SECONDS,
	EVENT_TYPE_FACTS_READY,
	EVENT_TYPE_CASE_STATUS_UPDATED
} from "../constants";
import { TRIGGER_TYPES, ORCHESTRATOR_MSG } from "#constants";
import { logger } from "#helpers/logger";
import { createMockCaseData } from "../../../__tests__/helpers/mockCaseData";

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

function buildClaimKey(caseId: string): string {
	return ORCHESTRATOR_CLAIMED_KEY_PREFIX + "{" + caseId + "}";
}

function buildStateKey(caseId: string): string {
	return ORCHESTRATOR_STATE_KEY_PREFIX + "{" + caseId + "}";
}

function buildFactsSourceKey(caseId: string): string {
	return buildStateKey(caseId) + ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX;
}

function createMockMultiChain(smembersResult: string[]) {
	const chain = {
		sadd: jest.fn().mockReturnThis(),
		expire: jest.fn().mockReturnThis(),
		set: jest.fn().mockReturnThis(),
		smembers: jest.fn().mockReturnThis(),
		exec: jest.fn().mockResolvedValue([
			[null, 1],
			[null, true],
			[null, smembersResult]
		])
	};
	return chain;
}

describe("OrchestratorService.markEventReceived", () => {
	const caseId = "550e8400-e29b-41d4-a716-446655440000";

	let mockRedis: jest.Mocked<RedisClient>;
	let mockChain: ReturnType<typeof createMockMultiChain>;
	let service: OrchestratorService;

	beforeEach(() => {
		jest.clearAllMocks();
		mockChain = createMockMultiChain([EVENT_TYPE_FACTS_READY]);
		mockRedis = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
			sadd: jest.fn(),
			expire: jest.fn(),
			smembers: jest.fn(),
			setNX: jest.fn(),
			multi: jest.fn().mockReturnValue(mockChain)
		} as unknown as jest.Mocked<RedisClient>;
		service = new OrchestratorService(mockRedis, {} as CaseService, {} as WorkflowManager);
	});

	it("uses MULTI/EXEC: queues sadd, expire, then smembers for state key with hash tag", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, [EVENT_TYPE_CASE_STATUS_UPDATED]]
		]);

		const result = await service.markEventReceived(caseId, EVENT_TYPE_CASE_STATUS_UPDATED);

		expect(mockRedis.multi).toHaveBeenCalledTimes(1);
		const stateKey = buildStateKey(caseId);
		expect(mockChain.sadd).toHaveBeenCalledWith(stateKey, EVENT_TYPE_CASE_STATUS_UPDATED);
		expect(mockChain.expire).toHaveBeenCalledWith(stateKey, String(ORCHESTRATOR_STATE_TTL_SECONDS));
		expect(mockChain.smembers).toHaveBeenCalledWith(stateKey);
		expect(mockChain.set).not.toHaveBeenCalled();
		expect(result).toEqual([EVENT_TYPE_CASE_STATUS_UPDATED]);
	});

	it("returns the set of received events from the last result of exec()", async () => {
		const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED];
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, receivedEvents]
		]);

		const result = await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY, "all_integrations_complete");

		expect(result).toEqual(receivedEvents);
	});

	it("when eventType is facts_ready and sourceValue is provided, queues set and expire for facts_source key", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, "OK"],
			[null, true],
			[null, [EVENT_TYPE_FACTS_READY]]
		]);

		await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY, "timeout_monitor");

		const factsSourceKey = buildFactsSourceKey(caseId);
		expect(mockChain.set).toHaveBeenCalledWith(factsSourceKey, "timeout_monitor");
		expect(mockChain.expire).toHaveBeenCalledWith(factsSourceKey, String(ORCHESTRATOR_STATE_TTL_SECONDS));
	});

	it("when eventType is facts_ready but sourceValue is empty string, does not queue set for facts_source", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, [EVENT_TYPE_FACTS_READY]]
		]);

		await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY, "");

		expect(mockChain.set).not.toHaveBeenCalled();
	});

	it("when eventType is facts_ready but sourceValue is null/undefined, does not queue set for facts_source", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, [EVENT_TYPE_FACTS_READY]]
		]);

		await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY);

		expect(mockChain.set).not.toHaveBeenCalled();
	});

	it("when eventType is case_status_updated, does not queue set for facts_source", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, [EVENT_TYPE_CASE_STATUS_UPDATED]]
		]);

		await service.markEventReceived(caseId, EVENT_TYPE_CASE_STATUS_UPDATED);

		expect(mockChain.set).not.toHaveBeenCalled();
	});

	it("returns empty array when exec returns empty results", async () => {
		mockChain.exec.mockResolvedValue([]);

		const result = await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY);

		expect(result).toEqual([]);
	});

	it("returns empty array when last result of exec is null or missing", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true]
		]);

		const result = await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY);

		expect(result).toEqual([]);
	});

	it("returns empty array when last result value is not an array", async () => {
		mockChain.exec.mockResolvedValue([
			[null, 1],
			[null, true],
			[null, "invalid"]
		]);

		const result = await service.markEventReceived(caseId, EVENT_TYPE_FACTS_READY);

		expect(result).toEqual([]);
	});
});

describe("OrchestratorService.tryDispatchIfReady", () => {
	const caseId = "550e8400-e29b-41d4-a716-446655440000";
	const customerId = "660e8400-e29b-41d4-a716-446655440001";

	let mockRedis: jest.Mocked<RedisClient>;
	let mockCaseService: jest.Mocked<CaseService>;
	let mockWorkflowManager: jest.Mocked<WorkflowManager>;
	let service: OrchestratorService;

	beforeEach(() => {
		jest.clearAllMocks();
		mockRedis = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
			sadd: jest.fn(),
			expire: jest.fn(),
			smembers: jest.fn(),
			setNX: jest.fn(),
			multi: jest.fn()
		} as unknown as jest.Mocked<RedisClient>;
		mockCaseService = {
			getCaseById: jest.fn()
		} as unknown as jest.Mocked<CaseService>;
		mockWorkflowManager = {
			notifyWorkflow: jest.fn()
		} as unknown as jest.Mocked<WorkflowManager>;
		service = new OrchestratorService(mockRedis, mockCaseService, mockWorkflowManager);
	});

	describe("happy path", () => {
		it("calls notifyWorkflow with correct payload when both events are present, claim acquired, and case is custom_workflow", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			const storedFactsSource = "all_integrations_complete";

			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue(storedFactsSource);
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledTimes(1);
			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith({
				case_id: caseId,
				customer_id: customerId,
				annotations: {
					source_events: { facts: storedFactsSource },
					trigger_type: TRIGGER_TYPES.INITIAL_SUBMIT
				}
			});
			expect(mockRedis.get).toHaveBeenCalledWith(buildFactsSourceKey(caseId));
			expect(mockRedis.delete).toHaveBeenCalledWith(buildClaimKey(caseId));
		});

		it("uses trigger_type INITIAL_SUBMIT in the notification payload", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue("timeout_monitor");
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			const call = (mockWorkflowManager.notifyWorkflow as jest.Mock).mock.calls[0][0];
			expect(call.annotations.trigger_type).toBe(TRIGGER_TYPES.INITIAL_SUBMIT);
		});
	});

	describe("when not all required events are present", () => {
		it("does not call tryClaimDispatch, getCaseById, or notifyWorkflow when only one event is in receivedEvents", async () => {
			await service.tryDispatchIfReady(caseId, [EVENT_TYPE_FACTS_READY] as const);

			expect(mockRedis.setNX).not.toHaveBeenCalled();
			expect(mockCaseService.getCaseById).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
		});

		it("does not call notifyWorkflow when receivedEvents is empty", async () => {
			await service.tryDispatchIfReady(caseId, [] as const);

			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
		});

		it("logs debug with caseId and receivedEvents when not all events present", async () => {
			await service.tryDispatchIfReady(caseId, [EVENT_TYPE_FACTS_READY] as const);

			expect(logger.debug).toHaveBeenCalledWith(ORCHESTRATOR_MSG.NOT_ALL_REQUIRED_EVENTS_RECEIVED, {
				caseId,
				receivedEvents: [EVENT_TYPE_FACTS_READY]
			});
		});
	});

	describe("when claim is not acquired", () => {
		it("does not call getCaseById or notifyWorkflow when tryClaimDispatch returns false", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(false);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockCaseService.getCaseById).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
		});

		it("logs debug when dispatch already claimed by another consumer", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(false);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(logger.debug).toHaveBeenCalledWith(ORCHESTRATOR_MSG.DISPATCH_ALREADY_CLAIMED, {
				caseId
			});
		});
	});

	describe("when case is not custom_workflow", () => {
		it("calls clearState and does not call notifyWorkflow when active_decisioning_type is not custom_workflow", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: customerId, active_decisioning_type: "other_type" })
			);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockRedis.delete).toHaveBeenCalled();
		});

		it("logs debug with active_decisioning_type when case is not custom_workflow", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: customerId, active_decisioning_type: "rules_based" })
			);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(logger.debug).toHaveBeenCalledWith(ORCHESTRATOR_MSG.CASE_NOT_CUSTOM_WORKFLOW_CLEARING_STATE, {
				caseId,
				active_decisioning_type: "rules_based"
			});
		});
	});

	describe("error propagation", () => {
		it("propagates error and does not delete claim key when getCaseById throws", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			const err = new Error("Case service unavailable");
			mockCaseService.getCaseById.mockRejectedValue(err);

			await expect(service.tryDispatchIfReady(caseId, receivedEvents)).rejects.toThrow("Case service unavailable");

			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockRedis.delete).not.toHaveBeenCalledWith(buildClaimKey(caseId));
		});

		it("propagates error and does not delete claim key when notifyWorkflow throws", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue("all_integrations_complete");
			mockWorkflowManager.notifyWorkflow.mockRejectedValue(new Error("Queue full"));

			await expect(service.tryDispatchIfReady(caseId, receivedEvents)).rejects.toThrow("Queue full");

			expect(mockRedis.delete).not.toHaveBeenCalledWith(buildClaimKey(caseId));
		});

		it("logs error with caseId when tryDispatchIfReady fails", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockRejectedValue(new Error("Network error"));

			await expect(service.tryDispatchIfReady(caseId, receivedEvents)).rejects.toThrow("Network error");

			expect(logger.error).toHaveBeenCalledWith(ORCHESTRATOR_MSG.TRY_DISPATCH_FAILED, {
				error: expect.any(Error),
				caseId
			});
		});
	});

	describe("source_events.facts (edge cases)", () => {
		it("uses 'orchestrator' when redis.get returns null for facts_source key", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue(null);
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith(
				expect.objectContaining({
					annotations: expect.objectContaining({
						source_events: { facts: "orchestrator" }
					})
				})
			);
		});

		it("uses 'orchestrator' when redis.get returns empty string for facts_source key", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue("");
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith(
				expect.objectContaining({
					annotations: expect.objectContaining({
						source_events: { facts: "orchestrator" }
					})
				})
			);
		});

		it("uses stored value from Redis for source_events.facts when present", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			const storedFactsSource = "timeout_monitor";
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue(storedFactsSource);
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith(
				expect.objectContaining({
					annotations: expect.objectContaining({
						source_events: { facts: storedFactsSource }
					})
				})
			);
		});
	});

	describe("claim key lifecycle", () => {
		it("deletes claim key only after successful notifyWorkflow (happy path)", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue("all_integrations_complete");
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			const claimKey = buildClaimKey(caseId);
			expect(mockRedis.delete).toHaveBeenCalledWith(claimKey);
			const deleteCalls = (mockRedis.delete as jest.Mock).mock.calls;
			const claimKeyDeleteCall = deleteCalls.find((call: unknown[]) => call[0] === claimKey);
			expect(claimKeyDeleteCall).toBeDefined();
		});

		it("logs info with caseId and receivedEvents when notifyWorkflow is enqueued", async () => {
			const receivedEvents = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;
			mockRedis.setNX.mockResolvedValue(true);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockRedis.get.mockResolvedValue("all_integrations_complete");
			mockWorkflowManager.notifyWorkflow.mockResolvedValue(undefined as never);
			mockRedis.delete.mockResolvedValue(true);

			await service.tryDispatchIfReady(caseId, receivedEvents);

			expect(logger.info).toHaveBeenCalledWith(ORCHESTRATOR_MSG.NOTIFY_WORKFLOW_ENQUEUED, {
				caseId,
				receivedEvents
			});
		});
	});
});

import { businessEventsHandler } from "../business";
import { logger } from "#helpers/logger";
import { KAFKA_MESSAGE_KEYS, ORCHESTRATOR_MSG } from "#constants";
import { validateMessage } from "#middlewares";
import { orchestratorService, monitoringEvaluationManager } from "#core";
import { caseService } from "#services/case";
import { EVENT_TYPE_CASE_STATUS_UPDATED, type OrchestratorEventType } from "#core/orchestrator";
import { CaseStatusUpdatedEvent } from "../../types";
import { publishSharedRulesEvaluationResult } from "#messaging/kafka/publishers/evaluation";
import { createMockCaseData } from "../../../../__tests__/helpers/mockCaseData";

jest.mock("#helpers/logger");
jest.mock("#middlewares");
jest.mock("#messaging/kafka/publishers/evaluation", () => ({
	publishSharedRulesEvaluationResult: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("#core", () => {
	const { EVENT_TYPE_CASE_STATUS_UPDATED: caseStatusUpdated } =
		jest.requireActual<typeof import("#core/orchestrator")>("#core/orchestrator");
	return {
		orchestratorService: {
			markEventReceived: jest
				.fn()
				.mockImplementation((_caseId: string, eventType: string) => Promise.resolve([eventType])),
			tryDispatchIfReady: jest.fn().mockResolvedValue(undefined),
			clearState: jest.fn().mockResolvedValue(undefined)
		},
		monitoringEvaluationManager: {
			evaluateRules: jest.fn().mockResolvedValue({
				results: [
					{
						rule_id: "r1",
						rule_name: "Rule",
						matched: true,
						conditions: {},
						true_conditions: [],
						false_conditions: []
					}
				],
				evaluation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
			})
		},
		EVENT_TYPE_CASE_STATUS_UPDATED: caseStatusUpdated
	};
});
jest.mock("#services/case");

describe("businessEventsHandler", () => {
	const mockLogger = logger as jest.Mocked<typeof logger>;
	const mockValidateMessage = validateMessage as jest.MockedFunction<typeof validateMessage>;
	const mockOrchestratorService = orchestratorService as jest.Mocked<typeof orchestratorService>;
	const mockMonitoringEvaluationManager = monitoringEvaluationManager as jest.Mocked<
		typeof monitoringEvaluationManager
	>;
	const mockPublishSharedRulesEvaluationResult = publishSharedRulesEvaluationResult as jest.MockedFunction<
		typeof publishSharedRulesEvaluationResult
	>;
	const mockCaseService = caseService as jest.Mocked<typeof caseService>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockOrchestratorService.markEventReceived.mockImplementation((_caseId: string, eventType: string) =>
			Promise.resolve([eventType] as OrchestratorEventType[])
		);
		mockOrchestratorService.tryDispatchIfReady.mockResolvedValue(undefined);
		mockOrchestratorService.clearState.mockResolvedValue(undefined);
	});

	describe("CASE_STATUS_UPDATED_EVENT", () => {
		it("should mark case_status_updated and try dispatch for custom_workflow case", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const caseStatus = "IN_REVIEW";
			const messageValue = JSON.stringify({
				case_id: caseId,
				business_id: businessId,
				case_status: caseStatus
			});

			const mockEvent: CaseStatusUpdatedEvent = {
				case_id: caseId,
				business_id: businessId,
				case_status: caseStatus
			};

			mockOrchestratorService.tryDispatchIfReady.mockResolvedValue(undefined);
			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc" })
			);

			await businessEventsHandler(messageKey, messageValue);

			expect(mockValidateMessage).toHaveBeenCalledWith(expect.any(Object), JSON.parse(messageValue));
			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.markEventReceived).toHaveBeenCalledWith(caseId, EVENT_TYPE_CASE_STATUS_UPDATED);
			expect(mockOrchestratorService.tryDispatchIfReady).toHaveBeenCalledWith(caseId, [EVENT_TYPE_CASE_STATUS_UPDATED]);
			expect(mockLogger.info).toHaveBeenCalledWith(
				`Processing case_status_updated_event: case_id=${caseId}, business_id=${businessId}, case_status=${caseStatus}`
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				`${ORCHESTRATOR_MSG.MARKED_CASE_STATUS_UPDATED_AND_TRIED_DISPATCH} ${caseId}`
			);
		});

		it("should clear state and skip when active_decisioning_type is not custom_workflow", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const messageValue = JSON.stringify({
				case_id: caseId,
				business_id: businessId,
				case_status: "SUBMITTED"
			});

			mockValidateMessage.mockReturnValue({
				case_id: caseId,
				business_id: businessId,
				case_status: "SUBMITTED"
			} as CaseStatusUpdatedEvent);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: "customer-123", active_decisioning_type: "other_type" })
			);

			await businessEventsHandler(messageKey, messageValue);

			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.clearState).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.markEventReceived).not.toHaveBeenCalled();
			expect(mockOrchestratorService.tryDispatchIfReady).not.toHaveBeenCalled();
		});
	});

	describe("BUSINESS_STATE_UPDATE_EVENT", () => {
		const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
		const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
		const basePayload = {
			event: KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT,
			source: "bulk_update_business_map",
			businessId,
			customerId,
			currentState: { status: "open" },
			previousState: { status: "new" }
		};

		it("logs error and skips when ruleIds is missing", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT;
			const messageValue = JSON.stringify(basePayload);

			await businessEventsHandler(messageKey, messageValue);

			expect(mockMonitoringEvaluationManager.evaluateRules).not.toHaveBeenCalled();
			expect(mockPublishSharedRulesEvaluationResult).not.toHaveBeenCalled();
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					issues: expect.any(Object),
					rawPayload: JSON.parse(messageValue)
				}),
				"Invalid business_state_update_event payload"
			);
		});

		it("logs error and skips when ruleIds is empty", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT;
			const messageValue = JSON.stringify({ ...basePayload, ruleIds: [] });

			await businessEventsHandler(messageKey, messageValue);

			expect(mockMonitoringEvaluationManager.evaluateRules).not.toHaveBeenCalled();
			expect(mockPublishSharedRulesEvaluationResult).not.toHaveBeenCalled();
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					issues: expect.any(Object),
					rawPayload: JSON.parse(messageValue)
				}),
				"Invalid business_state_update_event payload"
			);
		});

		it("evaluates and publishes to workflows.v1 when ruleIds is present", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT;
			const ruleIds = ["rule-uuid-1", "rule-uuid-2"];
			const messageValue = JSON.stringify({
				...basePayload,
				ruleIds,
				evaluationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
			});

			await businessEventsHandler(messageKey, messageValue);

			expect(mockMonitoringEvaluationManager.evaluateRules).toHaveBeenCalledWith(
				expect.objectContaining({
					ruleIds,
					businessId,
					customerId,
					evaluationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					currentState: basePayload.currentState,
					previousState: basePayload.previousState
				})
			);
			expect(mockPublishSharedRulesEvaluationResult).toHaveBeenCalledWith({
				businessId,
				customerId,
				result: expect.objectContaining({
					evaluation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					results: expect.any(Array)
				})
			});
		});

		it("logs error and does not publish when evaluation throws", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT;
			const ruleIds = ["rule-uuid-1"];
			const messageValue = JSON.stringify({ ...basePayload, ruleIds });
			mockMonitoringEvaluationManager.evaluateRules.mockRejectedValueOnce(new Error("boom"));

			await businessEventsHandler(messageKey, messageValue);

			expect(mockPublishSharedRulesEvaluationResult).not.toHaveBeenCalled();
			expect(mockLogger.error).toHaveBeenCalledWith(
				{ error: expect.any(Error), payload: JSON.parse(messageValue) },
				"business_state_update_event: evaluation failed"
			);
		});

		it("logs error when payload fails EvaluateRulesRequestSchema", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT;
			const messageValue = JSON.stringify({ event: KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT });

			await businessEventsHandler(messageKey, messageValue);

			expect(mockMonitoringEvaluationManager.evaluateRules).not.toHaveBeenCalled();
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					issues: expect.any(Object),
					rawPayload: JSON.parse(messageValue)
				}),
				"Invalid business_state_update_event payload"
			);
		});
	});
});

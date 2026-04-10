import { notificationsEventsHandler } from "../notifications";
import { logger } from "#helpers/logger";
import { KAFKA_MESSAGE_KEYS, ORCHESTRATOR_MSG, ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW } from "#constants";
import { validateMessage } from "#middlewares";
import { workflowManager, orchestratorService } from "#core";
import { caseService } from "#services/case";
import { EVENT_TYPE_FACTS_READY, type OrchestratorEventType } from "#core/orchestrator";
import { ProcessCompletionFactsEvent, ApplicationEditFactsReadyEvent } from "../../types";
import { createMockCaseData } from "../../../../__tests__/helpers/mockCaseData";

jest.mock("#helpers/logger");
jest.mock("#middlewares");
jest.mock("#core", () => {
	const { EVENT_TYPE_FACTS_READY: factsReady } =
		jest.requireActual<typeof import("#core/orchestrator")>("#core/orchestrator");
	return {
		workflowManager: { notifyWorkflow: jest.fn() },
		orchestratorService: {
			markEventReceived: jest
				.fn()
				.mockImplementation((_caseId: string, eventType: string) => Promise.resolve([eventType])),
			tryDispatchIfReady: jest.fn().mockResolvedValue(undefined),
			clearState: jest.fn().mockResolvedValue(undefined)
		},
		EVENT_TYPE_FACTS_READY: factsReady
	};
});
jest.mock("#services/case");

describe("notificationsEventsHandler", () => {
	const mockLogger = logger as jest.Mocked<typeof logger>;
	const mockValidateMessage = validateMessage as jest.MockedFunction<typeof validateMessage>;
	const mockWorkflowManager = workflowManager as jest.Mocked<typeof workflowManager>;
	const mockOrchestratorService = orchestratorService as jest.Mocked<typeof orchestratorService>;
	const mockCaseService = caseService as jest.Mocked<typeof caseService>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockOrchestratorService.markEventReceived.mockImplementation((_caseId: string, eventType: string) =>
			Promise.resolve([eventType] as OrchestratorEventType[])
		);
		mockOrchestratorService.tryDispatchIfReady.mockResolvedValue(undefined);
		mockOrchestratorService.clearState.mockResolvedValue(undefined);
	});

	describe("INTEGRATION_CATEGORY_COMPLETE_EVENT", () => {
		it("should process integration_category_complete_event successfully with annotations", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const scoreTriggerId = "dabc1d16-ce03-4d25-a8c9-97d5240d33c8";
			const action = "timeout_monitor";
			const messageValue = JSON.stringify({
				business_id: businessId,
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: scoreTriggerId,
				action,
				category_id: "all",
				category_name: "all",
				completion_state: {
					is_all_complete: true,
					tasks_completed: 1,
					tasks_required: 12
				}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: businessId,
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: scoreTriggerId,
				action,
				category_id: "all",
				category_name: "all",
				completion_state: {
					is_all_complete: true,
					tasks_completed: 1,
					tasks_required: 12
				}
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockValidateMessage).toHaveBeenCalledWith(expect.any(Object), JSON.parse(messageValue));
			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.markEventReceived).toHaveBeenCalledWith(caseId, EVENT_TYPE_FACTS_READY, action);
			expect(mockOrchestratorService.tryDispatchIfReady).toHaveBeenCalledWith(caseId, [EVENT_TYPE_FACTS_READY]);
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				`Processing integration_category_complete_event: case_id=${caseId}, business_id=${businessId}, action=${action}`
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				`${ORCHESTRATOR_MSG.MARKED_FACTS_READY_AND_TRIED_DISPATCH} ${caseId}`
			);
		});

		it("should skip event when case_id is missing", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: null as unknown as string,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockCaseService.getCaseById).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining("Skipping integration_category_complete_event: no case_id found")
			);
		});

		it("should skip event when category_id is not 'all'", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: 2,
				category_name: "category-2",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: 2,
				category_name: "category-2",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockCaseService.getCaseById).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('category_id=2, action=timeout_monitor, expected category_id="all"')
			);
		});

		it("should skip event when action is not 'all_integrations_complete' or 'timeout_monitor'", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "unknown_action",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "unknown_action",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockCaseService.getCaseById).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('category_id=all, action=unknown_action, expected category_id="all"')
			);
		});

		it("should process event with action 'all_integrations_complete'", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const scoreTriggerId = "dabc1d16-ce03-4d25-a8c9-97d5240d33c8";
			const action = "all_integrations_complete";
			const messageValue = JSON.stringify({
				business_id: businessId,
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: scoreTriggerId,
				action,
				category_id: "all",
				category_name: "all",
				completion_state: {
					is_all_complete: true,
					tasks_completed: 12,
					tasks_required: 12
				}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: businessId,
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: scoreTriggerId,
				action,
				category_id: "all",
				category_name: "all",
				completion_state: {
					is_all_complete: true,
					tasks_completed: 12,
					tasks_required: 12
				}
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockValidateMessage).toHaveBeenCalledWith(expect.any(Object), JSON.parse(messageValue));
			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.markEventReceived).toHaveBeenCalledWith(caseId, EVENT_TYPE_FACTS_READY, action);
			expect(mockOrchestratorService.tryDispatchIfReady).toHaveBeenCalledWith(caseId, [EVENT_TYPE_FACTS_READY]);
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				`Processing integration_category_complete_event: case_id=${caseId}, business_id=${businessId}, action=${action}`
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				`${ORCHESTRATOR_MSG.MARKED_FACTS_READY_AND_TRIED_DISPATCH} ${caseId}`
			);
		});

		it("should skip event when active_decisioning_type is not custom_workflow", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: "customer-123", active_decisioning_type: "other_type" })
			);

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.clearState).toHaveBeenCalledWith(caseId);
			expect(mockOrchestratorService.markEventReceived).not.toHaveBeenCalled();
			expect(mockOrchestratorService.tryDispatchIfReady).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining(
					`active_decisioning_type="other_type", expected "${ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW}"`
				)
			);
		});

		it("should handle invalid JSON in message value", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const messageValue = "invalid-json";

			// Act & Assert
			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow();
		});

		it("should handle case service errors", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockRejectedValue(new Error("Case not found"));

			// Act & Assert
			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow("Case not found");
		});

		it("should propagate errors from orchestratorService.tryDispatchIfReady", async () => {
			// Arrange
			const messageKey = KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			});

			const mockEvent: ProcessCompletionFactsEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customer_id: customerId,
				case_id: caseId,
				score_trigger_id: "dabc1d16-ce03-4d25-a8c9-97d5240d33c8",
				action: "timeout_monitor",
				category_id: "all",
				category_name: "all",
				completion_state: {}
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockOrchestratorService.tryDispatchIfReady.mockRejectedValue(new Error("Orchestrator dispatch failed"));

			// Act & Assert
			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow(
				"Orchestrator dispatch failed"
			);
		});
	});

	describe("APPLICATION_EDIT_FACTS_READY_EVENT", () => {
		it("should process application_edit_facts_ready_event successfully with previous_status", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const previousStatus = "IN_REVIEW";
			const messageValue = JSON.stringify({
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId,
				previous_status: previousStatus
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId,
				previous_status: previousStatus
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockWorkflowManager.notifyWorkflow.mockResolvedValue({
				message: "Workflow notification received and queued for processing",
				job_id: "job-123",
				estimated_processing_time: "5s"
			});

			await notificationsEventsHandler(messageKey, messageValue);

			expect(mockValidateMessage).toHaveBeenCalledWith(expect.any(Object), JSON.parse(messageValue));
			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith({
				case_id: caseId,
				customer_id: customerId,
				annotations: {
					source_events: {
						facts: "facts_recalculated"
					},
					trigger_type: "resubmit"
				},
				previous_status: previousStatus
			});
			expect(mockLogger.info).toHaveBeenCalledWith(
				`Processing application_edit_facts_ready_event: case_id=${caseId}, business_id=${businessId}, previous_status=${previousStatus}`
			);
			expect(mockLogger.info).toHaveBeenCalledWith(`Successfully queued workflow for re-submitted case: ${caseId}`);
		});

		it("should process application_edit_facts_ready_event successfully without previous_status", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const messageValue = JSON.stringify({
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockWorkflowManager.notifyWorkflow.mockResolvedValue({
				message: "Workflow notification received and queued for processing",
				job_id: "job-123",
				estimated_processing_time: "5s"
			});

			await notificationsEventsHandler(messageKey, messageValue);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith({
				case_id: caseId,
				customer_id: customerId,
				annotations: {
					source_events: {
						facts: "facts_recalculated"
					},
					trigger_type: "resubmit"
				},
				previous_status: undefined
			});
		});

		it("should skip event when active_decisioning_type is not custom_workflow", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const messageValue = JSON.stringify({
				business_id: businessId,
				case_id: caseId,
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				previous_status: "IN_REVIEW"
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: businessId,
				case_id: caseId,
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				previous_status: "IN_REVIEW"
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(
				createMockCaseData({ id: caseId, customer_id: "customer-123", active_decisioning_type: "other_type" })
			);

			await notificationsEventsHandler(messageKey, messageValue);

			expect(mockCaseService.getCaseById).toHaveBeenCalledWith(caseId);
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining(
					`active_decisioning_type="other_type", expected "${ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW}"`
				)
			);
		});

		it("should handle case service errors", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				case_id: caseId,
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc"
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				case_id: caseId,
				customer_id: "987fcdeb-51a2-43d7-8f9e-123456789abc"
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockRejectedValue(new Error("Case not found"));

			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow("Case not found");
		});

		it("should handle workflow manager errors", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const messageValue = JSON.stringify({
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				case_id: caseId,
				customer_id: customerId
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				case_id: caseId,
				customer_id: customerId
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockWorkflowManager.notifyWorkflow.mockRejectedValue(new Error("Workflow processing failed"));

			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow("Workflow processing failed");
		});

		it("should handle invalid JSON in message value", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const messageValue = "invalid-json";

			await expect(notificationsEventsHandler(messageKey, messageValue)).rejects.toThrow();
		});

		it("should handle null previous_status as undefined", async () => {
			const messageKey = KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT;
			const caseId = "123e4567-e89b-12d3-a456-426614174000";
			const customerId = "987fcdeb-51a2-43d7-8f9e-123456789abc";
			const businessId = "ba1e8f99-46a3-4bed-9792-4abcc2a9051d";
			const messageValue = JSON.stringify({
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId,
				previous_status: null
			});

			const mockEvent: ApplicationEditFactsReadyEvent = {
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId,
				previous_status: null
			};

			mockValidateMessage.mockReturnValue(mockEvent);
			mockCaseService.getCaseById.mockResolvedValue(createMockCaseData({ id: caseId, customer_id: customerId }));
			mockWorkflowManager.notifyWorkflow.mockResolvedValue({
				message: "Workflow notification received and queued for processing",
				job_id: "job-123",
				estimated_processing_time: "5s"
			});

			await notificationsEventsHandler(messageKey, messageValue);

			expect(mockWorkflowManager.notifyWorkflow).toHaveBeenCalledWith({
				case_id: caseId,
				customer_id: customerId,
				annotations: {
					source_events: {
						facts: "facts_recalculated"
					},
					trigger_type: "resubmit"
				},
				previous_status: undefined
			});
		});
	});

	describe("unknown message keys", () => {
		it("should skip unknown message keys", async () => {
			// Arrange
			const messageKey = "UNKNOWN_EVENT";
			const messageValue = JSON.stringify({ some: "data" });

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockValidateMessage).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(`Skipping message with key: ${messageKey}`);
		});

		it("should handle empty message key", async () => {
			// Arrange
			const messageKey = "";
			const messageValue = JSON.stringify({ some: "data" });

			// Act
			await notificationsEventsHandler(messageKey, messageValue);

			// Assert
			expect(mockValidateMessage).not.toHaveBeenCalled();
			expect(mockWorkflowManager.notifyWorkflow).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(`Skipping message with key: ${messageKey}`);
		});
	});
});

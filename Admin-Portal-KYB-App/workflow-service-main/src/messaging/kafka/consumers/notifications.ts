import { logger } from "#helpers/logger";
import {
	KAFKA_MESSAGE_KEYS,
	TRIGGER_TYPES,
	ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW,
	ORCHESTRATOR_MSG,
	CASE_CONSUMER_ERROR_MSG,
	ORCHESTRATOR_SKIP_MSG
} from "#constants";
import { processCompletionFactsEventSchema, applicationEditFactsReadyEventSchema } from "../schemas";
import type { ProcessCompletionFactsEvent, ApplicationEditFactsReadyEvent } from "../types";
import { validateMessage } from "#middlewares";
import { workflowManager, orchestratorService, EVENT_TYPE_FACTS_READY } from "#core";
import { caseService } from "#services/case";
import type { WorkflowAnnotations } from "#core/types";

const VALID_ACTIONS = ["all_integrations_complete", "timeout_monitor"] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

const isValidAction = (action: string): action is ValidAction => {
	return VALID_ACTIONS.includes(action as ValidAction);
};

export const notificationsEventsHandler = async (messageKey: string, messageValue: string): Promise<void> => {
	switch (messageKey) {
		case KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT: {
			const rawEvent: unknown = JSON.parse(messageValue);
			const event = validateMessage<ProcessCompletionFactsEvent>(processCompletionFactsEventSchema, rawEvent);

			if (!event.case_id) {
				logger.debug(
					`Skipping integration_category_complete_event: no case_id found for business_id=${event.business_id}`
				);
				return;
			}

			const caseId: string = event.case_id;

			if (event.category_id !== "all" || !isValidAction(event.action)) {
				logger.debug(
					`Skipping integration_category_complete_event: category_id=${event.category_id}, action=${event.action}, expected category_id="all" and action in [${VALID_ACTIONS.map(a => `"${a}"`).join(", ")}] for case_id=${caseId}`
				);
				return;
			}

			logger.info(
				`Processing integration_category_complete_event: case_id=${caseId}, business_id=${event.business_id}, action=${event.action}`
			);

			try {
				const caseData = await caseService.getCaseById(caseId);

				if (caseData.active_decisioning_type !== ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW) {
					logger.debug(
						`${ORCHESTRATOR_SKIP_MSG.INTEGRATION_CATEGORY_COMPLETE} ${caseId} has active_decisioning_type="${caseData.active_decisioning_type ?? "undefined"}", expected "${ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW}"`
					);
					await orchestratorService.clearState(caseId);
					return;
				}

				logger.info(
					`Fetched case data: case_id=${caseId}, customer_id=${caseData.customer_id}, active_decisioning_type=${caseData.active_decisioning_type}`
				);

				const receivedEvents = await orchestratorService.markEventReceived(
					caseId,
					EVENT_TYPE_FACTS_READY,
					event.action
				);
				await orchestratorService.tryDispatchIfReady(caseId, receivedEvents);
				logger.info(`${ORCHESTRATOR_MSG.MARKED_FACTS_READY_AND_TRIED_DISPATCH} ${caseId}`);
			} catch (error) {
				logger.error({ error }, `${CASE_CONSUMER_ERROR_MSG.FAILED_INTEGRATION_CATEGORY_COMPLETE} ${caseId}`);
				throw error;
			}
			break;
		}
		case KAFKA_MESSAGE_KEYS.APPLICATION_EDIT_FACTS_READY_EVENT: {
			const rawEvent: unknown = JSON.parse(messageValue);
			const event = validateMessage<ApplicationEditFactsReadyEvent>(applicationEditFactsReadyEventSchema, rawEvent);

			const caseId: string = event.case_id;
			const previousStatus = event.previous_status ?? undefined;

			logger.info(
				`Processing application_edit_facts_ready_event: case_id=${caseId}, business_id=${event.business_id}, previous_status=${previousStatus}`
			);

			try {
				const caseData = await caseService.getCaseById(caseId);

				if (caseData.active_decisioning_type !== ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW) {
					logger.debug(
						`${ORCHESTRATOR_SKIP_MSG.APPLICATION_EDIT_FACTS_READY} ${caseId} has active_decisioning_type="${caseData.active_decisioning_type ?? "undefined"}", expected "${ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW}"`
					);
					return;
				}

				const customerId = caseData.customer_id;
				logger.info(
					`Fetched case data for re-submit: case_id=${caseId}, customer_id=${customerId}, active_decisioning_type=${caseData.active_decisioning_type}`
				);

				const annotations: WorkflowAnnotations = {
					source_events: {
						facts: "facts_recalculated"
					},
					trigger_type: TRIGGER_TYPES.RESUBMIT
				};

				await workflowManager.notifyWorkflow({
					case_id: caseId,
					customer_id: customerId,
					annotations,
					previous_status: previousStatus
				});

				logger.info(`Successfully queued workflow for re-submitted case: ${caseId}`);
			} catch (error) {
				logger.error({ error }, `${CASE_CONSUMER_ERROR_MSG.FAILED_APPLICATION_EDIT_FACTS_READY} ${caseId}`);
				throw error;
			}
			break;
		}
		default:
			logger.debug(`Skipping message with key: ${messageKey}`);
	}
};

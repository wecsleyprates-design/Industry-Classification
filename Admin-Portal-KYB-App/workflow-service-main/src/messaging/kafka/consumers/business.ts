import { logger } from "#helpers/logger";
import {
	KAFKA_MESSAGE_KEYS,
	ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW,
	ORCHESTRATOR_MSG,
	CASE_CONSUMER_ERROR_MSG,
	ORCHESTRATOR_SKIP_MSG
} from "#constants";
import { caseStatusUpdatedEventSchema } from "../schemas";
import type { CaseStatusUpdatedEvent } from "../types";
import { validateMessage } from "#middlewares";
import { orchestratorService, EVENT_TYPE_CASE_STATUS_UPDATED, monitoringEvaluationManager } from "#core";
import { caseService } from "#services/case";
import { Workflows } from "@joinworth/types";
import type { EvaluateRulesInput } from "#types/workflow-dtos";
import { publishSharedRulesEvaluationResult } from "#messaging/kafka/publishers/evaluation";

export const businessEventsHandler = async (messageKey: string, messageValue: string): Promise<void> => {
	switch (messageKey) {
		case KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT: {
			const rawEvent: unknown = JSON.parse(messageValue);
			const event = validateMessage<CaseStatusUpdatedEvent>(caseStatusUpdatedEventSchema, rawEvent);
			const caseId: string = event.case_id;

			logger.info(
				`Processing case_status_updated_event: case_id=${caseId}, business_id=${event.business_id}, case_status=${event.case_status}`
			);

			try {
				const caseData = await caseService.getCaseById(caseId);

				if (caseData.active_decisioning_type !== ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW) {
					logger.debug(
						`${ORCHESTRATOR_SKIP_MSG.CASE_STATUS_UPDATED} ${caseId} has active_decisioning_type="${caseData.active_decisioning_type ?? "undefined"}", expected "${ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW}"`
					);
					await orchestratorService.clearState(caseId);
					return;
				}

				const receivedEvents = await orchestratorService.markEventReceived(caseId, EVENT_TYPE_CASE_STATUS_UPDATED);
				await orchestratorService.tryDispatchIfReady(caseId, receivedEvents);
				logger.info(`${ORCHESTRATOR_MSG.MARKED_CASE_STATUS_UPDATED_AND_TRIED_DISPATCH} ${caseId}`);
			} catch (error) {
				logger.error({ error }, `${CASE_CONSUMER_ERROR_MSG.FAILED_CASE_STATUS_UPDATED} ${caseId}`);
				throw error;
			}
			break;
		}
		case KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT: {
			const rawEvent: unknown = JSON.parse(messageValue);
			const parsed = Workflows.Shared.Evaluations.EvaluateRulesRequestSchema.safeParse(rawEvent);
			if (!parsed.success) {
				logger.error(
					{ issues: parsed.error.flatten(), rawPayload: rawEvent },
					"Invalid business_state_update_event payload"
				);
				return;
			}

			const input: EvaluateRulesInput = parsed.data;

			try {
				const result = await monitoringEvaluationManager.evaluateRules(input);
				await publishSharedRulesEvaluationResult({
					businessId: input.businessId,
					customerId: input.customerId,
					result
				});
			} catch (err) {
				logger.error({ error: err, payload: rawEvent }, "business_state_update_event: evaluation failed");
			}
			break;
		}
		default:
			logger.debug(`Skipping message with key: ${messageKey}`);
	}
};

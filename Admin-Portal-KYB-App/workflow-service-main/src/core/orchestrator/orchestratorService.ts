import { logger } from "#helpers/logger";
import type { RedisClient } from "#helpers/redis";
import type { WorkflowNotificationData } from "#core/types";
import { TRIGGER_TYPES, ORCHESTRATOR_MSG, ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW } from "#constants";
import { WorkflowManager } from "#core/workflow";
import { CaseService } from "#services/case";
import {
	ORCHESTRATOR_STATE_KEY_PREFIX,
	ORCHESTRATOR_CLAIMED_KEY_PREFIX,
	ORCHESTRATOR_STATE_TTL_SECONDS,
	ORCHESTRATOR_CLAIM_TTL_SECONDS,
	ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX,
	REQUIRED_ORCHESTRATOR_EVENTS,
	EVENT_TYPE_FACTS_READY
} from "./constants";
import type { OrchestratorEventType } from "./constants";

export class OrchestratorService {
	constructor(
		private redis: RedisClient,
		private caseService: CaseService,
		private workflowManager: WorkflowManager
	) {}

	/**
	 * Returns a hash tag for the case ID so all orchestrator keys for a case land in the same Redis Cluster slot (required for MULTI/EXEC).
	 * @param caseId - Case ID
	 * @returns Hash tag
	 */
	private getOrchestratorKeyTag(caseId: string): string {
		return "{" + caseId + "}";
	}

	/**
	 * Records that an event type was received for the given case. Adds to the state set and refreshes TTL.
	 * When eventType is facts_ready and sourceValue is provided, stores it for use in source_events.facts on dispatch.
	 * @param caseId - Case ID
	 * @param eventType - Event type (e.g. facts_ready, case_status_updated)
	 * @param sourceValue - Optional value to use for source_events.facts when eventType is facts_ready (e.g. event.action)
	 * @returns Current list of event types in the set
	 */
	async markEventReceived(
		caseId: string,
		eventType: OrchestratorEventType,
		sourceValue?: string
	): Promise<OrchestratorEventType[]> {
		const tag = this.getOrchestratorKeyTag(caseId);
		const stateKey = ORCHESTRATOR_STATE_KEY_PREFIX + tag;
		const ttl = String(ORCHESTRATOR_STATE_TTL_SECONDS);
		const chain = this.redis.multi();
		chain.sadd(stateKey, eventType);
		chain.expire(stateKey, ttl);
		if (eventType === EVENT_TYPE_FACTS_READY && sourceValue != null && sourceValue !== "") {
			const factsSourceKey = stateKey + ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX;
			chain.set(factsSourceKey, sourceValue);
			chain.expire(factsSourceKey, ttl);
		}
		chain.smembers(stateKey);
		const results = await chain.exec();
		const lastResult = results?.length ? results[results.length - 1] : null;
		const receivedEvents = lastResult?.[1] ?? [];
		return Array.isArray(receivedEvents) ? (receivedEvents as OrchestratorEventType[]) : [];
	}

	/**
	 * Tries to acquire the dispatch claim for the case. Only one caller can succeed per case until TTL or explicit clear.
	 * @param caseId - Case ID
	 * @returns true if claim was acquired, false if another caller already holds it
	 */
	async tryClaimDispatch(caseId: string): Promise<boolean> {
		const claimKey = ORCHESTRATOR_CLAIMED_KEY_PREFIX + this.getOrchestratorKeyTag(caseId);
		const value = Date.now().toString();
		return this.redis.setNX(claimKey, value, ORCHESTRATOR_CLAIM_TTL_SECONDS);
	}

	/**
	 * Removes orchestrator state and claim for the case. Call after trigger match or when case is not custom_workflow.
	 * @param caseId - Case ID
	 */
	async clearState(caseId: string): Promise<void> {
		const tag = this.getOrchestratorKeyTag(caseId);
		const stateKey = ORCHESTRATOR_STATE_KEY_PREFIX + tag;
		const claimKey = ORCHESTRATOR_CLAIMED_KEY_PREFIX + tag;
		const factsSourceKey = stateKey + ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX;
		await this.redis.delete(stateKey);
		await this.redis.delete(claimKey);
		await this.redis.delete(factsSourceKey);
	}

	/**
	 * If all required events are present in receivedEvents, tries to claim and call notifyWorkflow. Clears claim after enqueue on success.
	 * Clears state when active_decisioning_type is not custom_workflow. Does not clear state on notifyWorkflow failure.
	 * @param caseId - Case ID
	 * @param receivedEvents - Set of event types
	 */
	async tryDispatchIfReady(caseId: string, receivedEvents: readonly OrchestratorEventType[]): Promise<void> {
		const allPresent = REQUIRED_ORCHESTRATOR_EVENTS.every(required => receivedEvents.includes(required));
		if (!allPresent) {
			logger.debug(ORCHESTRATOR_MSG.NOT_ALL_REQUIRED_EVENTS_RECEIVED, { caseId, receivedEvents });
			return;
		}

		const claimed = await this.tryClaimDispatch(caseId);
		if (!claimed) {
			logger.debug(ORCHESTRATOR_MSG.DISPATCH_ALREADY_CLAIMED, { caseId });
			return;
		}

		const tag = this.getOrchestratorKeyTag(caseId);
		const claimKey = ORCHESTRATOR_CLAIMED_KEY_PREFIX + tag;
		try {
			const caseData = await this.caseService.getCaseById(caseId);
			if (caseData.active_decisioning_type !== ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW) {
				logger.debug(ORCHESTRATOR_MSG.CASE_NOT_CUSTOM_WORKFLOW_CLEARING_STATE, {
					caseId,
					active_decisioning_type: caseData.active_decisioning_type
				});
				await this.clearState(caseId);
				return;
			}

			const customerId = caseData.customer_id;
			const factsSourceKey = ORCHESTRATOR_STATE_KEY_PREFIX + tag + ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX;
			const storedFactsSource = await this.redis.get(factsSourceKey);
			const factsSource =
				typeof storedFactsSource === "string" && storedFactsSource !== "" ? storedFactsSource : "orchestrator";

			const notificationData: WorkflowNotificationData = {
				case_id: caseId,
				customer_id: customerId,
				annotations: {
					source_events: { facts: factsSource },
					trigger_type: TRIGGER_TYPES.INITIAL_SUBMIT
				}
			};
			await this.workflowManager.notifyWorkflow(notificationData);
			logger.info(ORCHESTRATOR_MSG.NOTIFY_WORKFLOW_ENQUEUED, { caseId, receivedEvents });
			await this.redis.delete(claimKey);
		} catch (error) {
			logger.error(ORCHESTRATOR_MSG.TRY_DISPATCH_FAILED, { error, caseId });
			throw error;
		}
	}
}

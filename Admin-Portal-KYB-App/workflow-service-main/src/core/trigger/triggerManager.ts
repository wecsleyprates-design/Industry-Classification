import { logger } from "#helpers/logger";
import { TriggerRepository } from "./triggerRepository";
import type { GetTriggersResponse } from "./types";

/**
 * Manager responsible for trigger-related business logic orchestration
 * Follows the same pattern as WorkflowManager for consistency
 */
export class TriggerManager {
	private triggerRepository: TriggerRepository;

	constructor(triggerRepository?: TriggerRepository) {
		this.triggerRepository = triggerRepository ?? new TriggerRepository();
	}

	/**
	 * Retrieves all available workflow triggers.
	 * @returns Array of triggers with total count
	 */
	async getTriggers(): Promise<GetTriggersResponse> {
		logger.info("TriggerManager: Retrieving all workflow triggers");

		try {
			const triggers = await this.triggerRepository.getTriggers();

			const response: GetTriggersResponse = {
				triggers: triggers.map(trigger => ({
					id: trigger.id,
					name: trigger.name,
					conditions: trigger.conditions,
					created_at: trigger.created_at.toISOString(),
					updated_at: trigger.updated_at.toISOString()
				})),
				total: triggers.length
			};

			logger.info(`TriggerManager: Retrieved ${response.total} triggers successfully`);

			return response;
		} catch (error) {
			logger.error({ error }, "TriggerManager: Failed to retrieve triggers");
			throw error;
		}
	}
}

import { logger } from "#helpers/logger";
import { ErrorHandler } from "#utils/errorHandler";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { db } from "#database/knex";
import type { Knex } from "knex";
import type { WorkflowTrigger } from "#core/trigger/types";

export class TriggerRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Retrieves all available workflow triggers from the database
	 * @returns Promise<WorkflowTrigger[]> - Array of internal trigger records
	 */
	async getTriggers(): Promise<WorkflowTrigger[]> {
		try {
			logger.debug("Retrieving all workflow triggers from database");

			// Type-aware database call using @types package
			const triggers = await this.db<WorkflowTrigger>("data_workflow_triggers")
				.select("id", "name", "conditions", "created_by", "created_at", "updated_by", "updated_at")
				.orderBy("name", "asc");

			logger.debug(`Retrieved ${triggers.length} triggers from database`);

			return triggers;
		} catch (error) {
			logger.error({ error }, "Failed to retrieve triggers from database");
			throw ErrorHandler.handleDatabaseError(error, "trigger retrieval");
		}
	}

	/**
	 * Retrieves a trigger by its ID
	 * @param triggerId - The ID of the trigger to retrieve
	 * @returns Promise<WorkflowTrigger | null> - The trigger or null if not found
	 */
	async getTriggerById(triggerId: string): Promise<WorkflowTrigger | null> {
		try {
			const trigger = await this.db<WorkflowTrigger>("data_workflow_triggers").where("id", triggerId).first();
			return trigger ?? null;
		} catch (error) {
			logger.error({ error }, "Failed to retrieve trigger from database");
			throw ErrorHandler.handleDatabaseError(error, "trigger retrieval");
		}
	}

	/**
	 * Gets a trigger ID by its name
	 * @param triggerName - The name of the trigger to find
	 * @returns Promise<string> - The trigger ID
	 */
	async getTriggerIdByName(triggerName: string): Promise<string> {
		try {
			// Get the specified trigger from seeded triggers
			const existingTrigger = (await this.db("data_workflow_triggers")
				.select("id")
				.where("name", triggerName)
				.first()) as { id: string } | undefined;

			if (existingTrigger) {
				logger.debug(`Found trigger '${triggerName}': ${existingTrigger.id}`);
				return existingTrigger.id;
			}

			// If no trigger exists with the specified name, this is a configuration error
			logger.error(`No trigger found with name '${triggerName}'. Triggers must be seeded before creating workflows.`);
			throw new ApiError(
				`Trigger '${triggerName}' not available. Please ensure triggers are properly seeded.`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		} catch (error) {
			logger.error({ error }, `Failed to get trigger '${triggerName}'`);
			throw new ApiError(
				`Failed to get trigger '${triggerName}'`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

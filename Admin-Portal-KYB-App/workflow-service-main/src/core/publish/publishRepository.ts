import { logger } from "#helpers/logger";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_STATUS, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { db } from "#database/knex";
import type { Knex } from "knex";

/**
 * Repository responsible for publish workflow database operations
 * Handles all database operations related to publishing workflow versions
 */
export class PublishRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Retires all current published versions for a workflow by transitioning them to ARCHIVED
	 * This follows the state machine: PUBLISHED -> ARCHIVED when a new version is published
	 * @param workflowId - The workflow ID
	 * @param userId - The user ID performing the action
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<string[]> - Array of archived version IDs
	 */
	async retireCurrentPublishedVersions(workflowId: string, userId: string, trx?: Knex.Transaction): Promise<string[]> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Archiving current published versions for workflow: ${workflowId}`);

			const versionsToArchive = await query("data_workflow_versions")
				.select("id")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.PUBLISHED)
				.where("is_current", true);

			const versionIds = versionsToArchive.map((v: { id: string }) => v.id);

			if (versionIds.length > 0) {
				await query("data_workflow_versions").whereIn("id", versionIds).update({
					status: WORKFLOW_STATUS.ARCHIVED,
					is_current: false,
					updated_by: userId,
					updated_at: this.db.fn.now()
				});

				logger.debug(`Archived ${versionIds.length} published versions for workflow: ${workflowId}`);
			}

			return versionIds;
		} catch (error) {
			logger.error({ error }, `Failed to archive published versions for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to archive published versions",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Publishes a workflow version (updates status and metadata)
	 * @param versionId - The version ID to publish
	 * @param userId - The user ID
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<{ published_at: string }>
	 */
	async publishWorkflowVersion(
		versionId: string,
		userId: string,
		trx?: Knex.Transaction
	): Promise<{ published_at: string }> {
		try {
			const query = trx ?? this.db;
			const publishedAt = new Date();

			await query("data_workflow_versions").where("id", versionId).update({
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				published_at: publishedAt,
				updated_by: userId,
				updated_at: this.db.fn.now()
			});

			const publishedAtIso = publishedAt.toISOString();
			logger.debug(`Published workflow version ${versionId} at ${publishedAtIso}`);
			return { published_at: publishedAtIso };
		} catch (error) {
			logger.error({ error }, `Error publishing workflow version ${versionId}`);
			throw new ApiError(
				"Failed to publish workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Activates a workflow when it's published
	 * Ensures the workflow is eligible for evaluation according to TDD requirements
	 * @param workflowId - The workflow ID to activate
	 * @param userId - The user ID
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<void>
	 */
	async activateWorkflow(workflowId: string, userId: string, trx?: Knex.Transaction): Promise<void> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Activating workflow: ${workflowId}`);

			await query("data_workflows").where("id", workflowId).update({
				active: true,
				updated_by: userId,
				updated_at: this.db.fn.now()
			});

			logger.debug(`Activated workflow: ${workflowId}`);
		} catch (error) {
			logger.error({ error }, `Failed to activate workflow ${workflowId}`);
			throw new ApiError("Failed to activate workflow", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}
}

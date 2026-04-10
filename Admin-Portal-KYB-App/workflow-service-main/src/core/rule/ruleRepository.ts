import { v4 as uuidv4 } from "uuid";
import { db } from "#database/knex";
import { logger } from "#helpers/logger";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { Knex } from "knex";
import type { WorkflowRuleRequest } from "#types/workflow-dtos";

/**
 * Repository responsible for workflow rule operations
 * Handles all database operations related to workflow rules
 */
export class RuleRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Deletes all rules for a workflow version
	 * @param workflowVersionId - The workflow version ID
	 * @returns Promise<number> - Number of deleted rules
	 */
	async deleteRulesForVersion(workflowVersionId: string): Promise<number> {
		logger.debug(`Deleting rules for workflow version: version_id=${workflowVersionId}`);

		try {
			const deletedCount = await this.db("data_workflow_rules").where("workflow_version_id", workflowVersionId).del();

			logger.info(`Successfully deleted ${deletedCount} rules for workflow version ${workflowVersionId}`);
			return deletedCount;
		} catch (error) {
			logger.error({ error }, `Failed to delete rules for workflow version ${workflowVersionId}`);
			throw new ApiError(
				"Failed to delete rules for workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Inserts a single rule for a workflow version
	 * @param workflowVersionId - The workflow version ID
	 * @param rule - The rule to insert
	 * @param userId - The user ID
	 * @param trx - Optional database transaction
	 * @returns Promise<string> - The inserted rule ID
	 */
	async insertRule(
		workflowVersionId: string,
		rule: WorkflowRuleRequest,
		userId: string,
		trx?: Knex.Transaction
	): Promise<string> {
		const ruleId = uuidv4();
		const query = trx ?? this.db;

		try {
			await query("data_workflow_rules").insert({
				id: ruleId,
				workflow_version_id: workflowVersionId,
				name: rule.name.trim() || `Rule ${rule.priority}`,
				priority: rule.priority,
				conditions: JSON.stringify(rule.conditions),
				actions: JSON.stringify(rule.actions),
				created_by: userId,
				created_at: query.fn.now(),
				updated_by: userId,
				updated_at: query.fn.now()
			});

			logger.debug(`Successfully inserted rule ${ruleId} for workflow version ${workflowVersionId}`);
			return ruleId;
		} catch (error) {
			logger.error({ error }, `Failed to insert rule for workflow version ${workflowVersionId}`);
			throw new ApiError(
				"Failed to insert rule for workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Deletes rules for a workflow version (returns count for compatibility)
	 * @param versionId - The version ID
	 * @param trx - Optional database transaction
	 * @returns Promise<number> - Number of rules deleted
	 */
	async deleteRulesForVersionWithCount(versionId: string, trx?: Knex.Transaction): Promise<number> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Deleting rules for workflow version: ${versionId}`);

			const deletedCount = await query("data_workflow_rules").where("workflow_version_id", versionId).del();

			logger.debug(`Deleted ${deletedCount} rules for workflow version: ${versionId}`);
			return deletedCount;
		} catch (error) {
			logger.error({ error }, `Failed to delete rules for workflow version ${versionId}`);
			throw new ApiError(
				"Failed to delete rules for workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

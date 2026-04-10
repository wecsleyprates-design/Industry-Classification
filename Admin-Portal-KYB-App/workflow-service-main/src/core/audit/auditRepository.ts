import { logger } from "#helpers/logger";
import { db } from "#database/knex";
import { ErrorHandler } from "#utils/errorHandler";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, FIELD_PATHS } from "#constants";
import type { WorkflowExecutionResult } from "#core/evaluators/types";
import type { Knex } from "knex";
import { exportConfig } from "#configs";
import type {
	ExecutionLogRecord,
	WorkflowChangeLogRecord,
	ExecutionWithWorkflowInfo,
	WorkflowInfo,
	WorkflowInfoByVersionRecord,
	WorkflowInfoByWorkflowIdRecord,
	WorkflowVersionIdPair
} from "./types";

/**
 * Repository responsible for all audit operations including workflow executions and change logs
 * Centralizes audit functionality to avoid duplication across repositories
 */
export class AuditRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Inserts a workflow change log entry
	 * @param changeLog - The change log data
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<void>
	 */
	async insertWorkflowChangeLog(
		changeLog: {
			workflow_id: string;
			version_id?: string;
			change_type: string;
			change_description: string;
			updated_by: string;
			field_path?: string;
			old_value?: string;
			new_value?: string;
			note?: string;
			customer_id?: string;
		},
		trx?: Knex.Transaction
	): Promise<void> {
		try {
			const query = trx ?? this.db;
			const logContext = trx ? "in transaction" : "";

			logger.debug(`Inserting workflow change log ${logContext} for workflow: ${changeLog.workflow_id}`);

			await query("data_workflow_change_log").insert({
				workflow_id: changeLog.workflow_id,
				workflow_version_id: changeLog.version_id ?? null,
				change_type: changeLog.change_type,
				field_path: changeLog.field_path ?? FIELD_PATHS.WORKFLOW,
				old_value: changeLog.old_value ?? null,
				new_value: changeLog.new_value ?? null,
				note: changeLog.note ?? changeLog.change_description,
				changed_by: changeLog.updated_by,
				customer_id: changeLog.customer_id ?? null
			});

			logger.debug(`Workflow change log inserted ${logContext} for workflow: ${changeLog.workflow_id}`);
		} catch (error) {
			const logContext = trx ? "in transaction" : "";
			logger.error(
				{ error },
				`Failed to insert workflow change log ${logContext} for workflow ${changeLog.workflow_id}`
			);

			if (trx) {
				throw new ApiError(
					"Failed to insert workflow change log",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				);
			} else {
				throw ErrorHandler.handleDatabaseError(error, "workflow change log insertion");
			}
		}
	}

	/**
	 * Records a workflow execution in the database with detailed evaluation log
	 * @param executionRecord - The workflow execution record to insert
	 * @returns Promise<void>
	 */
	async recordWorkflowExecution(executionRecord: WorkflowExecutionResult): Promise<void> {
		try {
			logger.debug(`Recording workflow execution for case ${executionRecord.case_id}`);

			await this.db("data_workflow_executions").insert({
				case_id: executionRecord.case_id,
				workflow_version_id: executionRecord.workflow_version_id,
				matched_rule_id: executionRecord.matched_rule_id ?? null,
				executed_at: new Date().toISOString(),
				input_attr: JSON.stringify(executionRecord.input_attr),
				evaluation_log: JSON.stringify(executionRecord.evaluation_log),
				latency_ms: executionRecord.latency_ms,
				action_applied: JSON.stringify(executionRecord.applied_action),
				workflow_id: executionRecord.workflow_id,
				customer_id: executionRecord.customer_id ?? null,
				annotations: executionRecord.annotations ? JSON.stringify(executionRecord.annotations) : null
			});

			logger.debug(`Workflow execution recorded for case ${executionRecord.case_id}`);
		} catch (error) {
			logger.error({ error }, `Error recording workflow execution for case ${executionRecord.case_id}`);
			throw error;
		}
	}

	/**
	 * Checks if a case has already been processed (idempotency check)
	 * @param caseId - The case ID to check
	 * @returns Promise<boolean> indicating if the case has been processed
	 */
	async isCaseProcessed(caseId: string): Promise<boolean> {
		try {
			logger.debug(`Checking if case ${caseId} has been processed`);

			const result = (await this.db("data_workflow_executions")
				.select("id")
				.where("case_id", caseId)
				.limit(1)
				.first()) as { id: string } | undefined;

			const isProcessed = !!result;
			logger.debug(`Case ${caseId} processed status: ${isProcessed}`);
			return isProcessed;
		} catch (error) {
			logger.error({ error }, `Error checking if case ${caseId} has been processed`);
			// Return false on error to allow processing
			return false;
		}
	}

	async exportExecutionLog(params: {
		customerId: string;
		workflowId?: string;
		startDate?: string;
		endDate?: string;
	}): Promise<ExecutionLogRecord[]> {
		try {
			let query = this.db<ExecutionLogRecord>("data_workflow_executions")
				.select(
					"case_id",
					"workflow_version_id",
					"matched_rule_id",
					"executed_at",
					"input_attr",
					"evaluation_log",
					"action_applied",
					"customer_id",
					"workflow_id",
					"latency_ms",
					"created_at"
				)
				.where("customer_id", params.customerId);

			if (params.workflowId) {
				query = query.where("workflow_id", params.workflowId);
			}

			if (params.startDate && params.endDate) {
				query = query.whereBetween("executed_at", [params.startDate, params.endDate]);
			} else {
				query = query.orderBy("executed_at", "desc");
			}

			query = query.limit(exportConfig.maxRecords);

			return await query;
		} catch (error) {
			logger.error({ error }, `Error exporting execution logs for customer ${params.customerId}`);
			throw ErrorHandler.handleDatabaseError(error, "execution logs export");
		}
	}

	async exportWorkflowChangesLog(params: {
		customerId: string;
		workflowId?: string;
		startDate?: string;
		endDate?: string;
	}): Promise<WorkflowChangeLogRecord[]> {
		try {
			let query = this.db<WorkflowChangeLogRecord>("data_workflow_change_log")
				.select(
					"workflow_version_id",
					"workflow_id",
					"customer_id",
					"field_path",
					"old_value",
					"new_value",
					"change_type",
					"note",
					"changed_by",
					"created_at"
				)
				.where("customer_id", params.customerId);

			if (params.workflowId) {
				query = query.where("workflow_id", params.workflowId);
			}

			if (params.startDate && params.endDate) {
				query = query.whereBetween("created_at", [params.startDate, params.endDate]);
			} else {
				query = query.orderBy("created_at", "desc");
			}

			query = query.limit(exportConfig.maxRecords);

			return await query;
		} catch (error) {
			logger.error({ error }, `Error exporting workflow changes logs for customer ${params.customerId}`);
			throw ErrorHandler.handleDatabaseError(error, "workflow changes logs export");
		}
	}

	/**
	 * Gets workflow information (name and version) for multiple workflows by their version IDs
	 * @param workflowVersionIds - Array of objects with workflow_id and workflow_version_id
	 * @returns Promise<Map<string, WorkflowInfo>> - Map keyed by workflow_id
	 */
	async getWorkflowsInfoByVersionIds(workflowVersionIds: WorkflowVersionIdPair[]): Promise<Map<string, WorkflowInfo>> {
		try {
			if (workflowVersionIds.length === 0) {
				return new Map();
			}

			const versionIds = workflowVersionIds.map(({ workflow_version_id }) => workflow_version_id);

			const results = await this.db("data_workflow_versions as v")
				.join("data_workflows as w", "v.workflow_id", "w.id")
				.select(
					"v.id as workflow_version_id",
					"w.id as workflow_id",
					"w.name as workflow_name",
					this.db.raw("TO_CHAR(v.version_number, 'FM999.0') as version_number")
				)
				.whereIn("v.id", versionIds);

			return new Map(
				(results as WorkflowInfoByVersionRecord[]).map(result => [
					result.workflow_id,
					{
						name: result.workflow_name,
						version: result.version_number
					}
				])
			);
		} catch (error) {
			logger.error("Error getting workflows info by version IDs:", error);
			throw ErrorHandler.handleDatabaseError(error, "workflows info retrieval");
		}
	}

	/**
	 * Gets workflow information (name only) for multiple workflows by their workflow IDs
	 * Returns empty string for version since we don't know which version was evaluated
	 * @param workflowIds - Array of workflow IDs
	 * @returns Promise<Map<string, WorkflowInfo>> - Map keyed by workflow_id
	 */
	async getWorkflowsInfoByWorkflowIds(workflowIds: string[]): Promise<Map<string, WorkflowInfo>> {
		try {
			if (workflowIds.length === 0) {
				return new Map();
			}

			const results = await this.db("data_workflows as w")
				.select("w.id as workflow_id", "w.name as workflow_name")
				.whereIn("w.id", workflowIds);

			return new Map(
				(results as WorkflowInfoByWorkflowIdRecord[]).map(result => [
					result.workflow_id,
					{
						name: result.workflow_name,
						version: ""
					}
				])
			);
		} catch (error) {
			logger.error("Error getting workflows info by workflow IDs:", error);
			throw ErrorHandler.handleDatabaseError(error, "workflows info retrieval by workflow_id");
		}
	}

	/**
	 * Gets the latest workflow execution for a given case_id with workflow and version information
	 * @param caseId - The case ID to get execution for
	 * @returns Promise<ExecutionWithWorkflowInfo[]> - Array with execution record (empty if not found)
	 */
	async getLatestExecutionByCaseId(caseId: string): Promise<ExecutionWithWorkflowInfo[]> {
		try {
			logger.debug(`Getting latest workflow execution for case ${caseId}`);

			const results = await this.db<ExecutionWithWorkflowInfo>("data_workflow_executions as e")
				.join("data_workflows as w", "e.workflow_id", "w.id")
				.join("data_workflow_versions as v", "e.workflow_version_id", "v.id")
				.select(
					"e.case_id",
					"e.workflow_version_id",
					"e.matched_rule_id",
					"e.executed_at",
					"e.input_attr",
					"e.evaluation_log",
					"e.action_applied",
					"e.customer_id",
					"e.workflow_id",
					"e.latency_ms",
					"e.created_at",
					"w.name as workflow_name",
					this.db.raw("TO_CHAR(v.version_number, 'FM999.0') as version_number")
				)
				.where("e.case_id", caseId)
				.orderBy("e.executed_at", "desc")
				.limit(1);

			if (results.length === 0) {
				logger.debug(`No workflow execution found for case ${caseId}`);
				return [];
			}

			return results as ExecutionWithWorkflowInfo[];
		} catch (error) {
			logger.error({ error }, `Error getting latest workflow execution for case ${caseId}`);
			throw ErrorHandler.handleDatabaseError(error, "latest workflow execution retrieval");
		}
	}
}

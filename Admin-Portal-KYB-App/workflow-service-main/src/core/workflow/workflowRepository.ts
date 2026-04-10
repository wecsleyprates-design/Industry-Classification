/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { logger } from "#helpers/logger";
import type { Workflow, WorkflowWithTrigger } from "#core/workflow/types";
import type { JsonLogicTrigger } from "#core/trigger/types";
import type { WorkflowAction } from "#core/actions/types";
import { db } from "#database/knex";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import {
	WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES,
	WORKFLOW_STATUS,
	WORKFLOW_LIST_STATUS,
	type WorkflowListStatus
} from "#constants";
import { ErrorHandler } from "#utils/errorHandler";
import { applyPagination, applyWhereInFilter, applySearchFilter } from "#utils/queryHelpers";
import type { Knex } from "knex";
import type {
	GetWorkflowsListRepositoryParams,
	GetWorkflowsListResult,
	WorkflowListResult,
	RawWorkflowRow,
	WorkflowRuleConditions
} from "./types";

export class WorkflowRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}
	/**
	 * Loads multiple active workflows for a customer, ordered by priority (lower number = higher priority)
	 * @param customerId - The customer ID to load workflows for
	 * @returns Array of active workflows with trigger conditions ordered by priority
	 */
	async loadActiveWorkflowsByPriority(customerId: string): Promise<WorkflowWithTrigger[]> {
		try {
			logger.debug(`Loading active workflows for customer ${customerId} ordered by priority`);

			if (customerId == null) {
				throw new Error("customerId is required");
			}

			const query = db("data_workflows as w")
				.join("data_workflow_versions as v", function (this: Knex.JoinClause) {
					this.on("w.id", "=", "v.workflow_id")
						.andOnVal("v.is_current", "=", true)
						.andOnVal("v.status", "=", WORKFLOW_STATUS.PUBLISHED);
				})
				.join("data_workflow_triggers as t", "v.trigger_id", "t.id")
				.where("w.customer_id", customerId)
				.where("w.active", true)
				.orderBy("w.priority", "asc")
				.select(
					"w.id",
					"w.customer_id",
					"w.name",
					"w.description",
					"w.active",
					"w.priority",
					"w.created_by",
					"w.created_at",
					"w.updated_by",
					"w.updated_at",
					"t.conditions as trigger"
				);

			const workflows = await query;

			logger.debug(`Found ${workflows.length} active workflows for customer ${customerId}`);
			return workflows as WorkflowWithTrigger[];
		} catch (error) {
			logger.error({ error }, `Error loading workflows for customer ${customerId}`);
			throw error;
		}
	}

	/**
	 * Builds a query for workflows filtered by customer and active status
	 * @param dbQuery - The Knex instance (transaction-aware or regular)
	 * @param customerId - The customer ID
	 * @param includeInactive - Whether to include inactive workflows
	 * @returns The configured query builder (not executed)
	 */
	private getWorkflowsOrderedByPriorityQuery(
		dbQuery: Knex | Knex.Transaction,
		customerId: string,
		includeInactive: boolean
	): Knex.QueryBuilder {
		let workflowsQuery = dbQuery("data_workflows").where("customer_id", customerId);

		if (!includeInactive) {
			workflowsQuery = workflowsQuery.where("active", true);
		}

		return workflowsQuery;
	}

	/**
	 * Gets workflows ordered by priority
	 * @param customerId - The customer ID
	 * @param includeInactive - Whether to include inactive workflows (default: false)
	 * @param trx - Optional database transaction
	 * @returns Array of workflows ordered by priority
	 */
	async getWorkflowsOrderedByPriority(
		customerId: string,
		includeInactive: boolean = false,
		trx?: Knex.Transaction
	): Promise<Array<{ id: string; priority: number; name: string }>> {
		try {
			const query = trx ?? this.db;
			const logContext = includeInactive ? "all" : "active";
			logger.debug(`Loading ${logContext} workflows ordered by priority for customer ${customerId}`);

			const workflowsQuery = this.getWorkflowsOrderedByPriorityQuery(query, customerId, includeInactive);
			const workflows = await workflowsQuery.orderBy("priority", "asc").select("id", "priority", "name");

			logger.debug(`Found ${workflows.length} workflows for customer ${customerId}`);
			return workflows as Array<{ id: string; priority: number; name: string }>;
		} catch (error) {
			logger.error({ error }, `Error loading workflows for customer ${customerId}`);
			throw new ApiError("Failed to load workflows", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Gets workflows within a specific priority range, ordered by priority
	 * This is more efficient than getting all workflows when only a range is needed
	 * @param customerId - The customer ID
	 * @param minPriority - Minimum priority (inclusive)
	 * @param maxPriority - Maximum priority (inclusive)
	 * @param includeInactive - Whether to include inactive workflows (default: false)
	 * @param trx - Optional database transaction
	 * @returns Array of workflows in the priority range, ordered by priority
	 */
	async getWorkflowsInPriorityRange(
		customerId: string,
		minPriority: number,
		maxPriority: number,
		includeInactive: boolean = false,
		trx?: Knex.Transaction
	): Promise<Array<{ id: string; priority: number; name: string }>> {
		try {
			const query = trx ?? this.db;
			const logContext = includeInactive ? "all" : "active";
			logger.debug(
				`Loading ${logContext} workflows in priority range [${minPriority}, ${maxPriority}] for customer ${customerId}`
			);

			const workflowsQuery = this.getWorkflowsOrderedByPriorityQuery(query, customerId, includeInactive)
				.whereBetween("priority", [minPriority, maxPriority])
				.orderBy("priority", "asc")
				.select("id", "priority", "name");

			const workflows = await workflowsQuery;

			logger.debug(
				`Found ${workflows.length} workflows in priority range [${minPriority}, ${maxPriority}] for customer ${customerId}`
			);
			return workflows as Array<{ id: string; priority: number; name: string }>;
		} catch (error) {
			logger.error({ error }, `Error loading workflows in priority range for customer ${customerId}`);
			throw new ApiError("Failed to load workflows", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Gets the maximum priority for a customer
	 * @param customerId - The customer ID
	 * @param trx - Optional database transaction
	 * @returns Promise<number> - The maximum priority (0 if no workflows exist)
	 */
	async getMaxPriority(customerId: string, trx?: Knex.Transaction): Promise<number> {
		try {
			const query = trx ?? this.db;
			const result = await query("data_workflows")
				.where("customer_id", customerId)
				.max("priority as max_priority")
				.first();

			const maxPriority = result?.max_priority ?? 0;
			return maxPriority as number;
		} catch (error) {
			logger.error({ error }, `Error getting max priority for customer ${customerId}`);
			throw new ApiError("Failed to get max priority", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Updates priorities of multiple workflows in batch using a single SQL statement
	 * Uses VALUES clause with JOIN for better performance and scalability with many workflows
	 * This is more efficient than individual UPDATEs and scales better than large CASE WHEN statements
	 * @param updates - Array of { workflowId, priority } objects
	 * @param userId - The user making the update
	 * @param trx - Optional database transaction
	 */
	async updateWorkflowPrioritiesBatch(
		updates: Array<{ workflowId: string; priority: number }>,
		userId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		try {
			if (updates.length === 0) {
				return;
			}

			const query = trx ?? this.db;
			const timestamp = new Date().toISOString();

			logger.debug(`Updating priorities for ${updates.length} workflows using batch update`);

			const valuesPlaceholders: string[] = [];
			const bindings: unknown[] = [];

			updates.forEach(u => {
				valuesPlaceholders.push(`(?::uuid, ?::integer)`);
				bindings.push(u.workflowId, u.priority);
			});

			const valuesClause = valuesPlaceholders.join(", ");

			await query.raw(
				`
				UPDATE data_workflows w
				SET 
					priority = v.priority::integer,
					updated_by = ?::uuid,
					updated_at = ?::timestamp
				FROM (VALUES ${valuesClause}) AS v(id, priority)
				WHERE w.id = v.id
			`,
				[userId, timestamp, ...bindings]
			);

			logger.debug(`Successfully updated priorities for ${updates.length} workflows`);
		} catch (error) {
			logger.error({ error }, `Error updating workflow priorities in batch`);
			throw new ApiError(
				"Failed to update workflow priorities",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets a workflow by ID
	 * @param workflowId - The workflow ID
	 * @param trx - Optional database transaction
	 * @returns The workflow or null if not found
	 */
	async getWorkflowById(workflowId: string, trx?: Knex.Transaction): Promise<Workflow | null> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Loading workflow ${workflowId}`);

			const workflow = (await query("data_workflows").where("id", workflowId).first()) as Workflow | undefined;

			if (!workflow) {
				logger.warn(`Workflow ${workflowId} not found`);
				return null;
			}

			logger.debug(`Found workflow ${workflowId}`);
			return workflow;
		} catch (error) {
			logger.error({ error }, `Error loading workflow ${workflowId}`);
			throw new ApiError("Failed to load workflow", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Executes a database transaction
	 * @param callback - The transaction callback
	 * @returns Promise<T> - The result of the transaction
	 */
	async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
		return this.db.transaction(callback);
	}

	/**
	 * Inserts a new workflow into the database
	 * @param workflowData - The workflow data to insert
	 * @param trx - Optional transaction object for transactional operations
	 */
	async insertWorkflow(
		workflowData: {
			id: string;
			customer_id: string;
			name: string;
			description?: string;
			active: boolean;
			priority: number;
			created_by: string;
		},
		trx?: Knex.Transaction
	): Promise<void> {
		const query = trx ?? this.db;

		const timestamp = new Date().toISOString();

		await query("data_workflows").insert({
			id: workflowData.id,
			customer_id: workflowData.customer_id,
			name: workflowData.name,
			description: workflowData.description ?? null,
			active: workflowData.active,
			priority: workflowData.priority,
			created_by: workflowData.created_by,
			created_at: timestamp,
			updated_by: workflowData.created_by,
			updated_at: timestamp
		});
	}

	/**
	 * Updates a workflow (for editing workflow metadata)
	 * @param workflowId - The workflow ID to update
	 * @param updateData - The data to update
	 * @param userId - The user making the update
	 */
	async updateWorkflow(
		workflowId: string,
		updateData: {
			name?: string;
			description?: string;
		},
		userId: string
	): Promise<void> {
		try {
			const updatePayload: Record<string, unknown> = {
				updated_by: userId,
				updated_at: new Date().toISOString()
			};

			// Only add fields that are defined
			if (updateData.name !== undefined) updatePayload.name = updateData.name;
			if (updateData.description !== undefined) updatePayload.description = updateData.description;

			await db("data_workflows").where("id", workflowId).update(updatePayload);

			logger.info(`Updated workflow: ${workflowId} by user: ${userId}`);
		} catch (error) {
			logger.error({ error }, `Failed to update workflow ${workflowId}`);
			throw new ApiError("Failed to update workflow", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Deletes a workflow (returns count for compatibility)
	 * @param workflowId - The workflow ID
	 * @param trx - Optional database transaction
	 * @returns Promise<number> - Number of workflows deleted
	 */
	async deleteWorkflowWithCount(workflowId: string, trx?: Knex.Transaction): Promise<number> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Deleting workflow: ${workflowId}`);

			const deletedCount = await query("data_workflows").where("id", workflowId).del();

			logger.debug(`Deleted workflow: ${workflowId}`);
			return deletedCount;
		} catch (error) {
			logger.error({ error }, `Failed to delete workflow ${workflowId}`);
			throw ErrorHandler.handleDatabaseError(error, "workflow deletion");
		}
	}

	/**
	 * Gets workflows list with pagination, filtering, searching, and sorting
	 * Uses JOINs for better performance instead of subqueries
	 * @param params - Repository parameters with normalized pagination (business logic handled by manager)
	 * @returns Object containing workflows list and pagination metadata
	 */
	async getWorkflowsList(params: GetWorkflowsListRepositoryParams): Promise<GetWorkflowsListResult> {
		try {
			logger.debug(`Getting workflows list for customer ${params.customerId}`, { params });

			// Pagination is already normalized by the manager (business logic layer)
			const pagination = params.pagination;

			// Build base query with JOINs
			let query = this.buildBaseQuery(params.customerId);

			// Apply filters
			query = this.applyStatusFilter(query, params.filter?.status);
			query = applyWhereInFilter(query, "w.created_by", params.filter?.created_by);
			query = applySearchFilter(query, "w.name", params.search?.name);
			query = applySearchFilter(query, "w.description", params.search?.description);

			// Get total count before pagination
			const countQuery = query.clone().clearSelect().clearOrder().count("w.id as count");
			const countResult = (await countQuery.first()) as { count: string | number } | undefined;
			const totalItems = Number(countResult?.count ?? 0);

			// Always sort by priority ASC
			query = query.orderBy("w.priority", "asc");

			// Apply pagination
			query = applyPagination(query, pagination);

			// Execute query (case counts are already included via JOIN)
			const rawWorkflows = (await query) as RawWorkflowRow[];

			// Enrich workflows with calculated status, version, and case count
			const workflowsWithCases: WorkflowListResult[] = rawWorkflows.map(row => {
				const enriched = this.enrichWorkflow(row);
				return {
					...enriched,
					cases: Number(row.case_count) || 0
				};
			});

			logger.debug(`Found ${workflowsWithCases.length} workflows for customer ${params.customerId}`);

			return {
				workflows: workflowsWithCases,
				totalItems
			};
		} catch (error) {
			logger.error({ error }, `Error getting workflows list for customer ${params.customerId}`);
			throw new ApiError("Failed to get workflows list", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Builds base query with JOINs for published and draft versions
	 * Uses JOINs instead of subqueries for better performance
	 * Uses LEFT JOIN with subquery for case counts to avoid row multiplication and separate query
	 * Note: GROUP BY is NOT needed anymore since case counts are pre-aggregated in subquery
	 * @param customerId - Customer ID to filter workflows
	 * @returns Knex query builder with JOINs (without GROUP BY)
	 */
	private buildBaseQuery(customerId: string): Knex.QueryBuilder {
		const db = this.db;
		return this.db("data_workflows as w")
			.where("w.customer_id", customerId)
			.leftJoin("data_workflow_versions as v_pub", function () {
				this.on("w.id", "=", "v_pub.workflow_id")
					.andOn("v_pub.status", "=", db.raw("?", [WORKFLOW_STATUS.PUBLISHED]))
					.andOn("v_pub.is_current", "=", db.raw("?", [true]));
			})
			.leftJoin("data_workflow_versions as v_draft", function () {
				this.on("w.id", "=", "v_draft.workflow_id").andOn("v_draft.status", "=", db.raw("?", [WORKFLOW_STATUS.DRAFT]));
			})
			.leftJoin(
				db.raw(`
					(
						SELECT
							workflow_id,
							COUNT(*)::int as case_count
						FROM data_workflow_executions
						GROUP BY workflow_id
					) case_counts
				`),
				"w.id",
				"=",
				"case_counts.workflow_id"
			)
			.select(
				"w.id",
				"w.name",
				"w.description",
				"w.priority",
				"w.active",
				"w.created_by",
				"w.created_at",
				"w.updated_at",
				this.db.raw("COALESCE(TO_CHAR(v_pub.version_number, 'FM999.0'), NULL) as published_version"),
				this.db.raw("TO_CHAR(v_draft.version_number, 'FM999.0') as draft_version"),
				this.db.raw("COALESCE(case_counts.case_count, 0) as case_count")
			);
	}

	/**
	 * Applies status filter based on active column from workflows table
	 * @param query - Knex query builder
	 * @param statusFilter - Status filter value(s)
	 * @returns Modified query builder
	 */
	private applyStatusFilter(query: Knex.QueryBuilder, statusFilter?: string | string[]): Knex.QueryBuilder {
		if (!statusFilter) {
			return query;
		}

		const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
		const activeStatuses: boolean[] = [];

		statuses.forEach(status => {
			if (status === WORKFLOW_LIST_STATUS.ACTIVE) {
				activeStatuses.push(true);
			} else if (status === WORKFLOW_LIST_STATUS.INACTIVE) {
				activeStatuses.push(false);
			}
		});

		if (activeStatuses.length > 0) {
			return query.whereIn("w.active", activeStatuses);
		}

		return query;
	}

	/**
	 * Enriches raw workflow row with calculated status
	 * Returns version fields separately for frontend to format as needed
	 * @param row - Raw workflow row from database
	 * @returns Enriched workflow with status and separate version fields (without cases)
	 */
	private enrichWorkflow(row: RawWorkflowRow): Omit<WorkflowListResult, "cases"> {
		const status = this.calculateStatus(row.active);

		return {
			id: row.id,
			name: row.name,
			description: row.description,
			priority: Number(row.priority),
			published_version: row.published_version,
			draft_version: row.draft_version,
			status,
			created_by: row.created_by,
			created_at: row.created_at,
			updated_at: row.updated_at
		};
	}

	/**
	 * Returns workflow status based on active flag from database
	 * The `active` column in `data_workflows` already represents the workflow status
	 * @param active - Workflow active flag from database
	 * @returns Workflow status ("active" or "inactive")
	 */
	private calculateStatus(active: boolean): WorkflowListStatus {
		return active ? WORKFLOW_LIST_STATUS.ACTIVE : WORKFLOW_LIST_STATUS.INACTIVE;
	}

	/**
	 * Gets a workflow with its full details including version, trigger, and rules
	 * @param workflowId - The workflow ID
	 * @returns Promise<{ workflow: Workflow; version: ...; trigger: ...; rules: ... } | null>
	 */
	async getWorkflowWithDetails(workflowId: string): Promise<{
		workflow: Workflow;
		version: {
			id: string;
			version_number: number;
			status: string;
			trigger_id: string;
			default_action: WorkflowAction | WorkflowAction[] | null;
		};
		trigger: {
			id: string;
			name: string;
			conditions: JsonLogicTrigger;
		};
		rules: Array<{
			id: string;
			name: string;
			priority: number;
			conditions: WorkflowRuleConditions;
			actions: WorkflowAction | WorkflowAction[];
		}>;
	} | null> {
		try {
			logger.debug(`Loading workflow with details for ${workflowId}`);

			const db = this.db;

			const result = await this.db("data_workflows as w")
				.where("w.id", workflowId)
				// Join with versions - prioritize DRAFT, fallback to PUBLISHED
				.leftJoin("data_workflow_versions as v_draft", function () {
					this.on("w.id", "=", "v_draft.workflow_id").andOn(
						"v_draft.status",
						"=",
						db.raw("?", [WORKFLOW_STATUS.DRAFT])
					);
				})
				.leftJoin("data_workflow_versions as v_pub", function () {
					this.on("w.id", "=", "v_pub.workflow_id")
						.andOn("v_pub.status", "=", db.raw("?", [WORKFLOW_STATUS.PUBLISHED]))
						.andOn("v_pub.is_current", "=", db.raw("?", [true]));
				})
				// Join with trigger using COALESCE to get trigger_id from either version
				.leftJoin("data_workflow_triggers as t", function () {
					this.on("t.id", "=", db.raw("COALESCE(v_draft.trigger_id, v_pub.trigger_id)"));
				})
				.select(
					// Workflow fields
					"w.id as workflow_id",
					"w.customer_id",
					"w.name as workflow_name",
					"w.description",
					"w.priority",
					"w.active",
					"w.created_by",
					"w.created_at",
					"w.updated_by",
					"w.updated_at",
					// Version fields (prioritize DRAFT)
					db.raw("COALESCE(v_draft.id, v_pub.id) as version_id"),
					db.raw("COALESCE(v_draft.version_number, v_pub.version_number) as version_number"),
					db.raw("COALESCE(v_draft.status, v_pub.status) as version_status"),
					db.raw("COALESCE(v_draft.trigger_id, v_pub.trigger_id) as trigger_id"),
					db.raw("COALESCE(v_draft.default_action, v_pub.default_action) as default_action"),
					// Trigger fields
					"t.id as trigger_id_full",
					"t.name as trigger_name",
					"t.conditions as trigger_conditions"
				)
				.first();

			if (!result?.workflow_id) {
				logger.warn(`Workflow ${workflowId} not found`);
				return null;
			}

			if (!result.version_id) {
				logger.warn(`No version found for workflow ${workflowId}`);
				return null;
			}

			if (!result.trigger_id_full) {
				logger.warn(`Trigger not found for workflow ${workflowId}`);
				return null;
			}

			// Get rules in a separate query (rules are an array, so this is more efficient than complex JOINs)
			const rulesResult = await this.db("data_workflow_rules")
				.where("workflow_version_id", result.version_id)
				.orderBy("priority", "asc")
				.select("id", "name", "priority", "conditions", "actions");

			const workflow: Workflow = {
				id: result.workflow_id as string,
				customer_id: result.customer_id as string,
				name: result.workflow_name as string,
				description: result.description as string | undefined,
				priority: result.priority as number | undefined,
				active: result.active as boolean,
				created_by: result.created_by as string,
				created_at: result.created_at as Date,
				updated_by: result.updated_by as string,
				updated_at: result.updated_at as Date
			};

			logger.debug(
				`Loaded workflow ${workflowId} with version ${result.version_id}, trigger ${result.trigger_id_full}, and ${rulesResult.length} rules`
			);

			return {
				workflow,
				version: {
					id: result.version_id as string,
					version_number: result.version_number as number,
					status: result.version_status as string,
					trigger_id: result.trigger_id as string,
					default_action: result.default_action as WorkflowAction | WorkflowAction[] | null
				},
				trigger: {
					id: result.trigger_id_full as string,
					name: result.trigger_name as string,
					conditions: result.trigger_conditions as JsonLogicTrigger
				},
				rules: rulesResult.map(r => ({
					id: r.id as string,
					name: r.name as string,
					priority: r.priority as number,
					conditions: r.conditions as WorkflowRuleConditions,
					actions: r.actions as WorkflowAction | WorkflowAction[]
				}))
			};
		} catch (error) {
			logger.error({ error }, `Error loading workflow with details for ${workflowId}`);
			throw new ApiError(
				"Failed to load workflow details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Updates the active status of a workflow
	 * @param workflowId - The workflow ID to update
	 * @param active - The new active status (true/false)
	 * @param userId - The user making the update
	 * @param trx - Optional database transaction
	 */
	async updateWorkflowStatus(
		workflowId: string,
		active: boolean,
		userId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Updating workflow ${workflowId} active status to ${active}`);

			await query("data_workflows").where("id", workflowId).update({
				active,
				updated_by: userId,
				updated_at: new Date().toISOString()
			});

			logger.debug(`Successfully updated workflow ${workflowId} active status to ${active}`);
		} catch (error) {
			logger.error({ error }, `Failed to update workflow ${workflowId} active status`);
			throw new ApiError(
				"Failed to update workflow status",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

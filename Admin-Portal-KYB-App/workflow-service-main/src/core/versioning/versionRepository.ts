import { logger } from "#helpers/logger";
import type { WorkflowVersion } from "#core/versioning/types";
import type { WorkflowRule } from "#core/rule/types";
import type { WorkflowAction } from "#core/actions/types";
import { WORKFLOW_STATUS } from "#constants";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { db } from "#database/knex";
import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

/**
 * Repository responsible for workflow version operations
 * Handles all database operations related to workflow versions and their rules
 */
export class VersionRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Loads the current workflow version and its rules for a specific workflow
	 * Prioritizes DRAFT versions over PUBLISHED versions for updates
	 * @param workflowId - The workflow ID to load version and rules for
	 * @returns Object containing the workflow version and its rules
	 */
	async getWorkflowVersionAndRules(
		workflowId: string
	): Promise<{ version: WorkflowVersion; rules: WorkflowRule[]; trigger_conditions?: Record<string, unknown> | null }> {
		try {
			logger.debug(`Loading workflow version and rules for workflow ${workflowId}`);

			// First, try to load DRAFT version (for updates)
			const draftVersion = await this.getVersionAndRulesByStatus(workflowId, WORKFLOW_STATUS.DRAFT);
			if (draftVersion) {
				logger.debug(`Found DRAFT version ${draftVersion.version.id} for workflow ${workflowId}`);
				return draftVersion;
			}

			// If no DRAFT exists, load PUBLISHED version
			const publishedVersion = await this.getVersionAndRulesByStatus(workflowId, WORKFLOW_STATUS.PUBLISHED);
			if (publishedVersion) {
				logger.debug(`Found PUBLISHED version ${publishedVersion.version.id} for workflow ${workflowId}`);
				return publishedVersion;
			}

			throw new Error(`No version found for workflow ${workflowId}`);
		} catch (error) {
			logger.error({ error }, `Error loading workflow version and rules for workflow ${workflowId}`);
			throw error;
		}
	}

	/**
	 * Gets a query builder for workflow version by status
	 * Returns a reusable query builder that can be further customized before execution
	 * @param workflowId - The workflow ID to get version for
	 * @param status - The version status (DRAFT or PUBLISHED)
	 * @param trx - Optional database transaction
	 * @param requireCurrent - Whether to filter by is_current=true (only for PUBLISHED)
	 * @returns Knex query builder for the version query
	 */
	getVersionByStatus(
		workflowId: string,
		status: string,
		trx?: Knex.Transaction,
		requireCurrent: boolean = false
	): Knex.QueryBuilder {
		const query = trx ?? this.db;
		let versionQuery = query("data_workflow_versions as v")
			.where("v.workflow_id", workflowId)
			.where("v.status", status);

		if (requireCurrent) {
			versionQuery = versionQuery.where("v.is_current", true);
		}

		return versionQuery;
	}

	/**
	 * Gets the ID of the current published version for a workflow
	 * @param workflowId - The workflow ID
	 * @param trx - Optional database transaction
	 * @returns Promise<string | null> - The version ID or null if not found
	 */
	async getCurrentPublishedVersionId(workflowId: string, trx?: Knex.Transaction): Promise<string | null> {
		try {
			const version = (await this.getVersionByStatus(workflowId, WORKFLOW_STATUS.PUBLISHED, trx, true)
				.select("id")
				.first()) as { id: string } | undefined;

			return version?.id ?? null;
		} catch (error) {
			logger.error({ error }, `Error getting current published version ID for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to get current published version ID",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets version and its rules for a specific workflow by status
	 * @param workflowId - The workflow ID to get version for
	 * @param status - The version status (DRAFT or PUBLISHED)
	 * @param trx - Optional database transaction
	 * @returns Object containing the version and its rules, or null if not found
	 */
	private async getVersionAndRulesByStatus(
		workflowId: string,
		status: string,
		trx?: Knex.Transaction
	): Promise<{
		version: WorkflowVersion;
		rules: WorkflowRule[];
		trigger_conditions?: Record<string, unknown> | null;
	} | null> {
		try {
			const query = trx ?? this.db;
			const versionQuery = this.getVersionByStatus(workflowId, status, trx)
				.leftJoin("data_workflow_triggers as t", "v.trigger_id", "t.id")
				.select(
					"v.id",
					"v.workflow_id",
					"v.trigger_id",
					"v.version_number",
					"v.status",
					"v.snapshot",
					"v.published_at",
					"v.default_action",
					"v.is_current",
					"v.created_by",
					"v.created_at",
					"v.updated_by",
					"v.updated_at",
					query.ref("t.conditions").as("trigger_conditions")
				);

			const version = (await versionQuery.first()) as WorkflowVersion | undefined;

			if (!version) {
				return null;
			}

			const rulesQuery = query("data_workflow_rules as r")
				.join("data_workflow_versions as v", "r.workflow_version_id", "v.id")
				.where("v.workflow_id", workflowId)
				.where("v.status", status)
				.orderBy("r.priority", "asc")
				.select("r.id", "r.workflow_version_id", "r.name", "r.priority", "r.conditions", "r.actions");

			const rules = (await rulesQuery) as WorkflowRule[];

			const triggerConditions =
				(version as unknown as { trigger_conditions?: Record<string, unknown> }).trigger_conditions ?? null;
			return { version, rules, trigger_conditions: triggerConditions };
		} catch (error) {
			logger.error({ error }, `Error getting ${status} version and rules for workflow ${workflowId}`);
			return null;
		}
	}

	/**
	 * Creates a new workflow version
	 * @param versionData - The version data to create
	 * @returns The created workflow version
	 */
	async createWorkflowVersion(versionData: WorkflowVersion): Promise<WorkflowVersion> {
		try {
			versionData.id = uuidv4();

			const [newVersion] = await this.db<WorkflowVersion>("data_workflow_versions").insert(versionData).returning("*");

			logger.info(`Created workflow version for workflow ${versionData.workflow_id}`, {
				versionNumber: versionData.version_number,
				status: versionData.status
			});

			return newVersion;
		} catch (error) {
			logger.error({ error }, `Error creating workflow version for workflow ${versionData.workflow_id}`);
			throw new ApiError(
				"Failed to create workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets all versions for a specific workflow
	 * @param workflowId - The workflow ID
	 * @returns Array of workflow versions ordered by version number
	 */
	async getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
		try {
			logger.debug(`Loading all versions for workflow ${workflowId}`);

			const versions = await this.db("data_workflow_versions")
				.where("workflow_id", workflowId)
				.orderBy("version_number", "desc")
				.select("*");

			logger.debug(`Found ${versions.length} versions for workflow ${workflowId}`);
			return versions as WorkflowVersion[];
		} catch (error) {
			logger.error({ error }, `Error loading versions for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to load workflow versions",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets the current draft version of a workflow
	 * @param workflowId - The workflow ID
	 * @returns Promise<WorkflowVersion | null>
	 */
	async getDraftVersion(workflowId: string): Promise<WorkflowVersion | null> {
		const version = (await this.db("data_workflow_versions")
			.where("workflow_id", workflowId)
			.where("status", WORKFLOW_STATUS.DRAFT)
			.where("is_current", true)
			.first()) as WorkflowVersion | undefined;

		return version ?? null;
	}

	/**
	 * Gets the current draft version of a workflow
	 * @param workflowId - The workflow ID
	 * @returns Promise<WorkflowVersion | null>
	 */
	async getCurrentDraftVersion(workflowId: string): Promise<WorkflowVersion | null> {
		try {
			logger.debug(`Getting current draft version for workflow: ${workflowId}`);

			const version = await this.db("data_workflow_versions")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.DRAFT)
				.orderBy("version_number", "desc")
				.first();

			if (!version) {
				logger.debug(`No draft version found for workflow: ${workflowId}`);
				return null;
			}

			logger.debug(`Found draft version ${version.id} for workflow: ${workflowId}`);
			return version as WorkflowVersion;
		} catch (error) {
			logger.error({ error }, `Failed to get current draft version for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to get current draft version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Retires a workflow version (sets is_current to false)
	 * @param versionId - The version ID to retire
	 * @param userId - The user retiring the version
	 * @returns Promise<void>
	 */
	async retireWorkflowVersion(versionId: string, userId: string): Promise<void> {
		try {
			await this.db("data_workflow_versions").where("id", versionId).update({
				is_current: false,
				updated_by: userId,
				updated_at: new Date().toISOString()
			});

			logger.info(`Retired workflow version ${versionId} by user ${userId}`);
		} catch (error) {
			logger.error({ error }, `Error retiring workflow version ${versionId}`);
			throw new ApiError(
				"Failed to retire workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Updates a workflow version (for editing drafts)
	 * @param versionId - The version ID to update
	 * @param updateData - The data to update
	 * @param userId - The user making the update
	 */
	async updateWorkflowVersion(
		versionId: string,
		updateData: {
			default_action?: WorkflowAction | WorkflowAction[];
			status?: string;
			trigger_id?: string;
		},
		userId: string
	): Promise<void> {
		try {
			const updatePayload: Record<string, unknown> = {
				updated_by: userId,
				updated_at: this.db.fn.now()
			};

			// Only add fields that are defined
			if (updateData.status !== undefined) updatePayload.status = updateData.status;
			if (updateData.trigger_id !== undefined) updatePayload.trigger_id = updateData.trigger_id;
			if (updateData.default_action !== undefined) updatePayload.default_action = updateData.default_action;

			await this.db("data_workflow_versions").where("id", versionId).update(updatePayload);

			logger.info(`Updated workflow version: ${versionId} by user: ${userId}`);
		} catch (error) {
			logger.error({ error }, `Failed to update workflow version ${versionId}`);
			throw new ApiError(
				"Failed to update workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Updates the snapshot of a workflow version
	 * @param versionId - The workflow version ID
	 * @param snapshot - The new snapshot data
	 * @param userId - The user ID making the change
	 * @param trx - Optional transaction object for transactional operations
	 */
	async updateWorkflowVersionSnapshot(
		versionId: string,
		snapshot: Record<string, unknown>,
		userId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const query = trx ?? this.db;
		await query("data_workflow_versions")
			.where("id", versionId)
			.update({
				snapshot: JSON.stringify(snapshot),
				updated_by: userId,
				updated_at: this.db.fn.now()
			});
	}

	/**
	 * Gets a workflow version by ID
	 * @param versionId - The version ID
	 * @returns Promise<WorkflowVersion | null>
	 */
	async getWorkflowVersionById(versionId: string): Promise<WorkflowVersion | null> {
		try {
			const version = (await this.db("data_workflow_versions").where("id", versionId).first()) as
				| WorkflowVersion
				| undefined;

			return version ?? null;
		} catch (error) {
			logger.error({ error }, `Error loading workflow version ${versionId}`);
			throw new ApiError(
				"Failed to load workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets a workflow version with its rules by version ID
	 * @param versionId - The version ID
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Object containing the version and its rules, or null if not found
	 */
	async getVersionAndRulesById(
		versionId: string,
		trx?: Knex.Transaction
	): Promise<{
		version: WorkflowVersion;
		rules: WorkflowRule[];
		trigger_conditions?: Record<string, unknown> | null;
	} | null> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Loading version and rules for version ID: ${versionId}`);

			const versionQuery = query("data_workflow_versions as v")
				.where("v.id", versionId)
				.leftJoin("data_workflow_triggers as t", "v.trigger_id", "t.id")
				.select(
					"v.id",
					"v.workflow_id",
					"v.trigger_id",
					"v.version_number",
					"v.status",
					"v.snapshot",
					"v.published_at",
					"v.default_action",
					"v.created_by",
					"v.created_at",
					"v.updated_by",
					"v.updated_at",
					this.db.ref("t.conditions").as("trigger_conditions")
				);

			const version = (await versionQuery.first()) as WorkflowVersion | undefined;

			if (!version) {
				logger.debug(`Version not found: ${versionId}`);
				return null;
			}

			const rulesQuery = query("data_workflow_rules as r")
				.where("r.workflow_version_id", versionId)
				.orderBy("r.priority", "asc")
				.select("r.id", "r.workflow_version_id", "r.name", "r.priority", "r.conditions", "r.actions");

			const rules = (await rulesQuery) as WorkflowRule[];

			const triggerConditions =
				(version as unknown as { trigger_conditions?: Record<string, unknown> }).trigger_conditions ?? null;

			logger.debug(`Loaded version ${versionId} with ${rules.length} rules`);
			return { version, rules, trigger_conditions: triggerConditions };
		} catch (error) {
			logger.error({ error }, `Error loading version and rules for version ${versionId}`);
			throw new ApiError(
				"Failed to load version and rules",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Gets the count of rules for a workflow version
	 * @param versionId - The version ID
	 * @returns Promise<number>
	 */
	async getRulesCountForVersion(versionId: string): Promise<number> {
		try {
			const result = (await this.db("data_workflow_rules")
				.where("workflow_version_id", versionId)
				.count("* as count")
				.first()) as any;

			return result ? parseInt(result.count as string) : 0;
		} catch (error) {
			logger.error({ error }, `Error counting rules for version ${versionId}`);
			throw new ApiError("Failed to count rules", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Get published versions for a workflow
	 * @param workflowId - The workflow ID
	 * @returns Promise<WorkflowVersion[]>
	 */
	async getPublishedVersions(workflowId: string): Promise<WorkflowVersion[]> {
		try {
			logger.debug(`Loading published versions for workflow ${workflowId}`);

			const versions = (await this.db("data_workflow_versions")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.PUBLISHED)
				.orderBy("version_number", "asc")) as WorkflowVersion[];

			logger.debug(`Found ${versions.length} published versions for workflow ${workflowId}`);
			return versions;
		} catch (error) {
			logger.error({ error }, `Error loading published versions for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to load published versions",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Checks if a workflow has at least one published version
	 * @param workflowId - The workflow ID
	 * @param trx - Optional database transaction
	 * @returns Promise<boolean> - true if at least one published version exists
	 */
	async hasPublishedVersion(workflowId: string, trx?: Knex.Transaction): Promise<boolean> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Checking if workflow ${workflowId} has published version`);

			const result = await query("data_workflow_versions")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.PUBLISHED)
				.count("* as count")
				.first();

			const count = result?.count ? Number(result.count) : 0;

			return count > 0;
		} catch (error) {
			logger.error({ error }, `Error checking published version for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to check published version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Get draft versions for a workflow
	 * @param workflowId - The workflow ID
	 * @returns Promise<WorkflowVersion[]>
	 */
	async getDraftVersions(workflowId: string): Promise<WorkflowVersion[]> {
		try {
			logger.debug(`Loading draft versions for workflow ${workflowId}`);

			const versions = (await this.db("data_workflow_versions")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.DRAFT)
				.orderBy("version_number", "asc")) as WorkflowVersion[];

			logger.debug(`Found ${versions.length} draft versions for workflow ${workflowId}`);
			return versions;
		} catch (error) {
			logger.error({ error }, `Error loading draft versions for workflow ${workflowId}`);
			throw new ApiError("Failed to load draft versions", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Get archived versions for a workflow
	 * @param workflowId - The workflow ID
	 * @returns Promise<WorkflowVersion[]>
	 */
	async getArchivedVersions(workflowId: string): Promise<WorkflowVersion[]> {
		try {
			logger.debug(`Loading archived versions for workflow ${workflowId}`);

			const versions = (await this.db("data_workflow_versions")
				.where("workflow_id", workflowId)
				.where("status", WORKFLOW_STATUS.ARCHIVED)
				.orderBy("version_number", "asc")) as WorkflowVersion[];

			logger.debug(`Found ${versions.length} archived versions for workflow ${workflowId}`);
			return versions;
		} catch (error) {
			logger.error({ error }, `Error loading archived versions for workflow ${workflowId}`);
			throw new ApiError(
				"Failed to load archived versions",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Delete a workflow version
	 * @param versionId - The version ID to delete
	 * @returns Promise<void>
	 */
	async deleteWorkflowVersion(versionId: string): Promise<void> {
		try {
			logger.debug(`Deleting workflow version: ${versionId}`);

			await this.db("data_workflow_versions").where("id", versionId).del();

			logger.debug(`Successfully deleted workflow version ${versionId}`);
		} catch (error) {
			logger.error({ error }, `Error deleting workflow version ${versionId}`);
			throw new ApiError(
				"Failed to delete workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Deletes a workflow version (returns count for compatibility)
	 * @param versionId - The version ID
	 * @param trx - Optional database transaction
	 * @returns Promise<number> - Number of versions deleted
	 */
	async deleteWorkflowVersionWithCount(versionId: string, trx?: Knex.Transaction): Promise<number> {
		try {
			const query = trx ?? this.db;
			logger.debug(`Deleting workflow version: ${versionId}`);

			const deletedCount = await query("data_workflow_versions").where("id", versionId).del();

			logger.debug(`Deleted workflow version: ${versionId}`);
			return deletedCount;
		} catch (error) {
			logger.error({ error }, `Failed to delete workflow version ${versionId}`);
			throw new ApiError(
				"Failed to delete workflow version",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Inserts a new workflow version into the database
	 * @param versionData - The version data to insert
	 * @param trx - Optional transaction object for transactional operations
	 */
	async insertWorkflowVersion(
		versionData: {
			id: string;
			workflow_id: string;
			trigger_id: string;
			status: string;
			is_current: boolean;
			created_by: string;
			default_action?: WorkflowAction | WorkflowAction[];
		},
		trx?: Knex.Transaction
	): Promise<void> {
		const query = trx ?? this.db;
		const timestamp = new Date().toISOString();

		const insertData: Record<string, unknown> = {
			id: versionData.id,
			workflow_id: versionData.workflow_id,
			trigger_id: versionData.trigger_id,
			status: versionData.status,
			is_current: versionData.is_current,
			created_by: versionData.created_by,
			created_at: timestamp,
			updated_by: versionData.created_by,
			updated_at: timestamp
		};

		if (versionData.default_action !== undefined) {
			insertData.default_action = versionData.default_action;
		}

		await query("data_workflow_versions").insert(insertData);
	}
}

import { logger } from "#helpers/logger";
import { PublishRepository } from "./publishRepository";
import { UserInfo } from "#types/common";
import { PublishWorkflowRequestValidator } from "#core/validators";
import type { PublishWorkflowResponse } from "#types/workflow-dtos";
import { AuditRepository } from "#core/audit";
import { VersionRepository } from "#core/versioning/versionRepository";
import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import { WORKFLOW_CHANGE_TYPES, WORKFLOW_STATUS } from "#constants";
import {
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest,
	VersionChange
} from "#core/versioning/types";
import type { Workflow } from "#core/workflow/types";
import type { WorkflowVersion } from "#core/versioning/types";
import type { WorkflowRule } from "#core/rule/types";
import type { Knex } from "knex";

/**
 * Manager responsible for publish workflow business logic orchestration
 * Follows the same pattern as WorkflowManager for consistency
 */
export class PublishManager {
	private publishRepository: PublishRepository;
	private auditRepository: AuditRepository;
	private versionRepository: VersionRepository;
	private publishValidator: PublishWorkflowRequestValidator;

	constructor(
		publishRepository?: PublishRepository,
		auditRepository?: AuditRepository,
		versionRepository?: VersionRepository,
		publishValidator?: PublishWorkflowRequestValidator
	) {
		this.publishRepository = publishRepository ?? new PublishRepository();
		this.auditRepository = auditRepository ?? new AuditRepository();
		this.versionRepository = versionRepository ?? new VersionRepository();
		this.publishValidator = publishValidator ?? new PublishWorkflowRequestValidator();
	}

	/**
	 * Publishes a workflow version (draft -> published)
	 * Uses validator for all business logic validation, then orchestrates repository operations
	 * @param versionId - The version ID to publish
	 * @param userInfo - User information for audit logging
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<PublishWorkflowResponse>
	 */
	async publishWorkflow(
		versionId: string,
		userInfo: UserInfo,
		trx?: Knex.Transaction
	): Promise<PublishWorkflowResponse> {
		const { user_id: userId } = userInfo;

		logger.info(`PublishManager: Publishing workflow version: version_id=${versionId}, user=${userId}`);

		try {
			const validatedData = await this.publishValidator.validate(versionId, userInfo);
			const { workflowVersion, workflow } = validatedData;
			const customerId = workflow.customer_id;

			const previousPublishedVersion = await this.getPreviousPublishedVersion(workflow.id);

			const archivedVersionIds = await this.publishRepository.retireCurrentPublishedVersions(workflow.id, userId, trx);

			await this.logArchivingActions(archivedVersionIds, workflow.id, userId, customerId, trx);

			await this.handleWorkflowActivation(workflow, versionId, userId, customerId, trx);

			const publishResult = await this.publishRepository.publishWorkflowVersion(versionId, userId, trx);

			const newVersionData = await this.versionRepository.getVersionAndRulesById(versionId, trx);
			if (!newVersionData) {
				throw new Error(`Failed to retrieve newly published version ${versionId}`);
			}

			await this.updateSnapshotForPublishedVersion(newVersionData, publishResult.published_at, userId, trx);

			await this.compareAndLogVersionChanges(
				workflow.id,
				newVersionData,
				previousPublishedVersion,
				userId,
				customerId,
				trx
			);

			await this.logPublishAction(workflow.id, versionId, userId, customerId, trx);

			logger.info(`PublishManager: Workflow version published successfully: ${versionId}`);

			return {
				workflow_id: workflow.id,
				version_id: versionId,
				version_number: workflowVersion.version_number,
				published_at: publishResult.published_at,
				message: "Workflow published successfully"
			};
		} catch (error) {
			logger.error(
				`PublishManager: Failed to publish workflow version: version_id=${versionId}, user=${userId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Publishes a newly created workflow
	 * Skips version comparison since there are no previous versions
	 * @param workflowId - The workflow ID
	 * @param versionId - The version ID to publish
	 * @param workflow - The workflow object
	 * @param userInfo - User information for audit logging
	 * @param trx - Optional transaction object for transactional operations
	 * @returns Promise<{ published_at: string }>
	 */
	async publishNewWorkflow(
		workflowId: string,
		versionId: string,
		workflow: Workflow,
		userInfo: UserInfo,
		trx?: Knex.Transaction
	): Promise<{ published_at: string }> {
		const { user_id: userId } = userInfo;
		const customerId = workflow.customer_id;

		logger.info(`PublishManager: Publishing new workflow: workflow_id=${workflowId}, version_id=${versionId}`);

		await this.handleWorkflowActivation(
			{ id: workflowId, active: workflow.active },
			versionId,
			userId,
			customerId,
			trx
		);

		const publishResult = await this.publishRepository.publishWorkflowVersion(versionId, userId, trx);

		const newVersionData = await this.versionRepository.getVersionAndRulesById(versionId, trx);
		if (!newVersionData) {
			throw new Error(`Failed to retrieve newly published version ${versionId}`);
		}

		await this.updateSnapshotForPublishedVersion(newVersionData, publishResult.published_at, userId, trx);

		await this.logPublishAction(workflowId, versionId, userId, customerId, trx);

		logger.info(`PublishManager: New workflow published successfully: ${workflowId}`);

		return publishResult;
	}

	/**
	 * Gets the published version for comparison before archiving
	 * Only one published version can exist at a time, so we simply get the first (and only) one
	 * @param workflowId - The workflow ID
	 * @returns The previous published version with rules, or null if none exists
	 */
	private async getPreviousPublishedVersion(
		workflowId: string
	): Promise<WorkflowVersionWithRulesAndTriggerConditions | null> {
		const publishedVersions = await this.versionRepository.getPublishedVersions(workflowId);

		if (publishedVersions.length === 0) {
			return null;
		}

		const publishedVersion = publishedVersions[0];
		const previousVersionData = await this.versionRepository.getVersionAndRulesById(publishedVersion.id);

		if (!previousVersionData) {
			return null;
		}

		return {
			...previousVersionData.version,
			rules: previousVersionData.rules,
			trigger_conditions: previousVersionData.trigger_conditions
		};
	}

	/**
	 * Logs archiving actions for each archived version
	 * @param archivedVersionIds - Array of version IDs that were archived
	 * @param workflowId - The workflow ID
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async logArchivingActions(
		archivedVersionIds: string[],
		workflowId: string,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const context = "data_workflow_versions";
		for (const archivedVersionId of archivedVersionIds) {
			await this.auditRepository.insertWorkflowChangeLog(
				{
					workflow_id: workflowId,
					version_id: archivedVersionId,
					change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
					change_description: "Workflow version archived (PUBLISHED → ARCHIVED)",
					updated_by: userId,
					field_path: `${context}.status`,
					old_value: WORKFLOW_STATUS.PUBLISHED,
					new_value: WORKFLOW_STATUS.ARCHIVED,
					customer_id: customerId
				},
				trx
			);
		}
	}

	/**
	 * Handles workflow activation and logs the change if needed
	 * @param workflow - The workflow object containing id and active status
	 * @param versionId - The version ID being published
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async handleWorkflowActivation(
		workflow: { id: string; active: boolean },
		versionId: string,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const wasActiveBefore = workflow.active;
		await this.publishRepository.activateWorkflow(workflow.id, userId, trx);

		if (wasActiveBefore) {
			return;
		}

		const context = "data_workflows";
		await this.auditRepository.insertWorkflowChangeLog(
			{
				workflow_id: workflow.id,
				version_id: versionId,
				change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
				change_description: "Workflow activated (inactive → active)",
				updated_by: userId,
				field_path: `${context}.active`,
				old_value: "false",
				new_value: "true",
				customer_id: customerId
			},
			trx
		);
	}

	/**
	 * Compares new published version with previous version and logs changes if detected
	 * @param workflowId - The workflow ID
	 * @param newVersionData - The new published version data with rules
	 * @param previousPublishedVersion - The previous published version, or null if none exists
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async compareAndLogVersionChanges(
		workflowId: string,
		newVersionData: {
			version: WorkflowVersion;
			rules: WorkflowRule[];
			trigger_conditions?: Record<string, unknown> | null;
		},
		previousPublishedVersion: WorkflowVersionWithRulesAndTriggerConditions | null,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		if (!previousPublishedVersion) {
			return;
		}

		const newPublishedVersion: WorkflowVersionWithRulesAndTriggerConditions = {
			...newVersionData.version,
			rules: newVersionData.rules,
			trigger_conditions: newVersionData.trigger_conditions
		};

		const updateRequest = this.convertVersionToUpdateRequest(newPublishedVersion);

		const changes = VersionChangeDetector.getChangedFields(previousPublishedVersion, updateRequest);

		await this.logRuleChangesIfDetected(
			workflowId,
			newVersionData.version.id,
			changes,
			newPublishedVersion.version_number,
			userId,
			customerId,
			trx
		);

		await this.logDefaultActionChangesIfDetected(
			workflowId,
			newVersionData.version.id,
			changes,
			newPublishedVersion.version_number,
			userId,
			customerId,
			trx
		);
	}

	/**
	 * Converts a published version to update request format for comparison
	 * @param version - The published version with rules
	 * @returns Update request format for VersionChangeDetector
	 */
	private convertVersionToUpdateRequest(version: WorkflowVersionWithRulesAndTriggerConditions): UpdateWorkflowRequest {
		return {
			trigger_id: version.trigger_id,
			rules: version.rules.map(rule => ({
				name: rule.name,
				priority: rule.priority,
				conditions: typeof rule.conditions === "string" ? JSON.parse(rule.conditions) : rule.conditions,
				actions: typeof rule.actions === "string" ? JSON.parse(rule.actions) : rule.actions
			})),
			default_action:
				typeof version.default_action === "string" ? JSON.parse(version.default_action) : version.default_action
		};
	}

	/**
	 * Logs rule changes if any were detected during version comparison
	 * @param workflowId - The workflow ID
	 * @param versionId - The new published version ID
	 * @param changes - Array of detected changes
	 * @param versionNumber - The version number of the new published version
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async logRuleChangesIfDetected(
		workflowId: string,
		versionId: string,
		changes: Array<VersionChange>,
		versionNumber: number,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const context = "data_workflow_rules";
		const ruleChanges = changes.filter(change => change.field_path === "rules.conditions");

		if (ruleChanges.length === 0) {
			return;
		}

		await this.auditRepository.insertWorkflowChangeLog(
			{
				workflow_id: workflowId,
				version_id: versionId,
				change_type: WORKFLOW_CHANGE_TYPES.RULES_UPDATED,
				field_path: `${context}.conditions`,
				old_value: ruleChanges.map(change => change.old_value).join(", "),
				new_value: ruleChanges.map(change => change.new_value).join(", "),
				change_description: `Rules updated when publishing version ${versionNumber}`,
				updated_by: userId,
				customer_id: customerId
			},
			trx
		);
	}

	/**
	 * Logs default action changes if any were detected during version comparison
	 * @param workflowId - The workflow ID
	 * @param versionId - The new published version ID
	 * @param changes - Array of detected changes
	 * @param versionNumber - The version number of the new published version
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async logDefaultActionChangesIfDetected(
		workflowId: string,
		versionId: string,
		changes: Array<VersionChange>,
		versionNumber: number,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const defaultActionChanges = changes.filter(change => change.field_path === "default_action");

		if (defaultActionChanges.length === 0) {
			return;
		}

		const change = defaultActionChanges[0];
		const changeDescription = change.note ?? `Default action updated when publishing version ${versionNumber}`;

		const context = "data_workflow_versions";
		await this.auditRepository.insertWorkflowChangeLog(
			{
				workflow_id: workflowId,
				version_id: versionId,
				change_type: WORKFLOW_CHANGE_TYPES.DEFAULT_ACTION_UPDATED,
				change_description: changeDescription,
				updated_by: userId,
				field_path: `${context}.default_action`,
				old_value: change.old_value ?? undefined,
				new_value: change.new_value ?? undefined,
				customer_id: customerId
			},
			trx
		);
	}

	/**
	 * Logs the publish action (DRAFT → PUBLISHED status change)
	 * @param workflowId - The workflow ID
	 * @param versionId - The version ID that was published
	 * @param userId - The user ID
	 * @param customerId - The customer ID
	 * @param trx - Optional transaction object
	 */
	private async logPublishAction(
		workflowId: string,
		versionId: string,
		userId: string,
		customerId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const context = "data_workflow_versions";
		await this.auditRepository.insertWorkflowChangeLog(
			{
				workflow_id: workflowId,
				version_id: versionId,
				change_type: WORKFLOW_CHANGE_TYPES.STATUS_CHANGED,
				change_description: "Workflow version published (DRAFT → PUBLISHED)",
				updated_by: userId,
				field_path: `${context}.status`,
				old_value: WORKFLOW_STATUS.DRAFT,
				new_value: WORKFLOW_STATUS.PUBLISHED,
				customer_id: customerId
			},
			trx
		);
	}

	/**
	 * Creates and updates the snapshot for a published version
	 * The snapshot reflects the exact state of the workflow at the time of publication
	 * @param versionData - The version data with rules
	 * @param publishedAt - The timestamp when the version was published
	 * @param userId - The user ID who published the version
	 * @param trx - Optional transaction object
	 */
	private async updateSnapshotForPublishedVersion(
		versionData: {
			version: WorkflowVersion;
			rules: WorkflowRule[];
			trigger_conditions?: Record<string, unknown> | null;
		},
		publishedAt: string,
		userId: string,
		trx?: Knex.Transaction
	): Promise<void> {
		const snapshot = this.createSnapshotFromPublishedVersion(versionData, publishedAt, userId);

		await this.versionRepository.updateWorkflowVersionSnapshot(versionData.version.id, snapshot, userId, trx);

		logger.debug(`Snapshot created for published version ${versionData.version.id}`);
	}

	/**
	 * Creates a snapshot object from a published version with its rules
	 * @param versionData - The version data with rules
	 * @param publishedAt - The timestamp when the version was published
	 * @param publishedBy - The user ID who published the version
	 * @returns A snapshot object representing the published state
	 */
	private createSnapshotFromPublishedVersion(
		versionData: {
			version: WorkflowVersion;
			rules: WorkflowRule[];
			trigger_conditions?: Record<string, unknown> | null;
		},
		publishedAt: string,
		publishedBy: string
	): Record<string, unknown> {
		return {
			workflow_id: versionData.version.workflow_id,
			trigger_id: versionData.version.trigger_id,
			rules: versionData.rules.map(rule => ({
				name: rule.name,
				priority: rule.priority,
				conditions: rule.conditions,
				actions: rule.actions
			})),
			default_action: versionData.version.default_action,
			published_at: publishedAt,
			published_by: publishedBy
		};
	}
}

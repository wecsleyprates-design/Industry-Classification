import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import {
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest,
	VersionChange,
	VersionCreationResult,
	ChangeLogEntry
} from "#core/versioning/types";
import type { WorkflowVersion } from "#core/versioning/types";
import type { WorkflowAction } from "#core/actions/types";
import { logger } from "#helpers/logger";
import { WORKFLOW_STATUS, WORKFLOW_CHANGE_TYPES } from "#constants";
import { VersionRepository } from "#core/versioning/versionRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { AuditRepository } from "#core/audit";
import { UserInfo } from "#types/common";
import type { WorkflowRuleRequest } from "#types/workflow-dtos";

/**
 * Manager for workflow version operations
 * Handles creation of new versions when changes are detected
 */
export class VersionManager {
	private versionRepository: VersionRepository;
	private ruleRepository: RuleRepository;
	private auditRepository: AuditRepository;

	constructor(versionRepository: VersionRepository, ruleRepository: RuleRepository, auditRepository?: AuditRepository) {
		this.versionRepository = versionRepository;
		this.ruleRepository = ruleRepository;
		this.auditRepository = auditRepository ?? new AuditRepository();
	}
	/**
	 * Creates a new version with the provided changes
	 * @param currentVersion - The current published workflow version with rules
	 * @param updateRequest - The update request from the user
	 * @param userInfo - User information for audit logging
	 * @param customerId - Customer ID from the workflow (reliable source)
	 * @returns VersionCreationResult with version details and changes
	 */
	async createVersion(
		currentVersion: WorkflowVersionWithRulesAndTriggerConditions,
		updateRequest: UpdateWorkflowRequest,
		userInfo: UserInfo,
		customerId: string
	): Promise<VersionCreationResult> {
		try {
			const changes = VersionChangeDetector.getChangedFields(currentVersion, updateRequest);

			const newVersion = await this.createNewVersion(currentVersion, updateRequest, userInfo.user_id);

			// Track version creation only when creating from a published version
			if (currentVersion.status === WORKFLOW_STATUS.PUBLISHED) {
				const context = "data_workflow_versions";
				await this.auditRepository.insertWorkflowChangeLog({
					field_path: context,
					workflow_id: currentVersion.workflow_id,
					version_id: newVersion.id,
					change_type: WORKFLOW_CHANGE_TYPES.VERSION_CREATED,
					change_description: `New version ${newVersion.version_number} created from published version ${currentVersion.version_number}`,
					updated_by: userInfo.user_id,
					customer_id: customerId
				});
			}

			return {
				workflow_id: currentVersion.workflow_id,
				version_id: newVersion.id,
				version_number: newVersion.version_number,
				changes
			};
		} catch (error) {
			logger.error({ error }, `Error creating new version for workflow ${currentVersion.workflow_id}`);
			throw error;
		}
	}

	/**
	 * Creates a new workflow version based on the update request
	 * @param currentVersion - The current published workflow version with rules
	 * @param updateRequest - The update request from the user
	 * @param userId - The ID of the user making the change
	 * @returns The new workflow version
	 */
	private async createNewVersion(
		currentVersion: WorkflowVersionWithRulesAndTriggerConditions,
		updateRequest: UpdateWorkflowRequest,
		userId: string
	): Promise<WorkflowVersion> {
		const newVersionNumber = currentVersion.version_number + 1;
		const now = new Date();

		const {
			rules: _rules,
			trigger_conditions: _triggerConditions,
			snapshot: _snapshot,
			...versionWithoutRules
		} = currentVersion;

		const newVersion: WorkflowVersion = {
			...versionWithoutRules,
			trigger_id: updateRequest.trigger_id ?? currentVersion.trigger_id,
			version_number: newVersionNumber,
			status: WORKFLOW_STATUS.DRAFT,
			default_action:
				updateRequest.default_action !== undefined
					? (updateRequest.default_action as WorkflowAction | WorkflowAction[])
					: currentVersion.default_action,
			is_current: false,
			published_at: undefined,
			created_by: userId,
			created_at: now,
			updated_by: userId,
			updated_at: now
		};

		const createdVersion = await this.versionRepository.createWorkflowVersion(newVersion);

		if (updateRequest.rules) {
			await this.createNewRules(createdVersion.id, updateRequest.rules, userId);
		}

		logger.info(`Created new version ${newVersionNumber} for workflow ${currentVersion.workflow_id}`, {
			versionNumber: newVersionNumber,
			changesCount: updateRequest.rules?.length ?? 0
		});

		return createdVersion;
	}

	/**
	 * Creates new rules for a workflow version
	 * @param versionId - The workflow version ID
	 * @param rules - The rules from the update request
	 * @param userId - The ID of the user creating the rules
	 */
	private async createNewRules(versionId: string, rules: WorkflowRuleRequest[], userId: string): Promise<void> {
		logger.debug(`Creating ${rules.length} new rules for workflow version ${versionId}`);

		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i];
			// Ensure priority is set correctly
			rule.priority = i + 1;

			await this.ruleRepository.insertRule(versionId, rule, userId);
		}
	}

	/**
	 * Creates change log entries for versioning
	 * @param workflowId - The workflow ID
	 * @param versionId - The new version ID
	 * @param changes - The detected changes
	 * @param userId - The user making the changes
	 * @returns Array of change log entries
	 */
	static createChangeLogEntries(
		workflowId: string,
		versionId: string,
		changes: VersionChange[],
		userId: string
	): ChangeLogEntry[] {
		const now = new Date();

		return changes.map(change => ({
			workflow_id: workflowId,
			workflow_version_id: versionId,
			field_path: change.field_path,
			old_value: change.old_value,
			new_value: change.new_value,
			change_type: change.change_type,
			note: change.note,
			changed_by: userId,
			changed_at: now
		}));
	}

	/**
	 * Validates that the update request contains valid data
	 * @param updateRequest - The update request to validate
	 * @returns true if valid, false otherwise
	 */
	static validateUpdateRequest(updateRequest: UpdateWorkflowRequest): boolean {
		try {
			if (updateRequest.trigger_id && typeof updateRequest.trigger_id !== "string") {
				return false;
			}

			if (updateRequest.rules) {
				if (!Array.isArray(updateRequest.rules)) {
					return false;
				}

				for (const rule of updateRequest.rules) {
					if (
						typeof rule.priority !== "number" ||
						typeof rule.conditions !== "object" ||
						typeof rule.actions !== "object"
					) {
						return false;
					}
				}
			}

			if (updateRequest.default_action) {
				if (Array.isArray(updateRequest.default_action)) {
					for (const action of updateRequest.default_action) {
						if (typeof action !== "object" || !action.type) {
							return false;
						}
					}
				} else if (typeof updateRequest.default_action !== "object" || !updateRequest.default_action.type) {
					return false;
				}
			}

			return true;
		} catch {
			return false;
		}
	}
}

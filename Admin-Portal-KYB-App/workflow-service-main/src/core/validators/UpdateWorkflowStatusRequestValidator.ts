import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import type { Knex } from "knex";

export interface UpdateWorkflowStatusValidatedData {
	workflowId: string;
	workflow: Workflow;
	active: boolean;
	userInfo: UserInfo;
}

/**
 * Validator for update workflow status requests
 * Handles all business logic validations for activating/deactivating a workflow
 * Follows the same pattern as ChangePriorityRequestValidator and DeleteWorkflowRequestValidator
 */
export class UpdateWorkflowStatusRequestValidator extends BaseRequestValidator {
	private versionRepository: VersionRepository;

	constructor(workflowRepository?: WorkflowRepository, versionRepository?: VersionRepository) {
		super();
		if (workflowRepository) {
			this.workflowRepository = workflowRepository;
		}
		this.versionRepository = versionRepository ?? new VersionRepository();
	}

	/**
	 * Validates the update workflow status request and returns validated data
	 * @param workflowId - The workflow ID to update status
	 * @param active - The new active status (true/false)
	 * @param userInfo - User information for access validation
	 * @param trx - Optional database transaction
	 * @returns Promise<UpdateWorkflowStatusValidatedData>
	 */
	async validate(
		workflowId: string,
		active: boolean,
		userInfo: UserInfo,
		trx?: Knex.Transaction
	): Promise<UpdateWorkflowStatusValidatedData> {
		const workflow = await this.validateWorkflowExists(workflowId, trx);

		this.validateWorkflowAccess(workflow, userInfo);

		if (active) {
			await this.validateHasPublishedVersion(workflowId, trx);
		}

		return {
			workflowId,
			workflow,
			active,
			userInfo
		};
	}

	/**
	 * Validates that the workflow has at least one published version
	 * Required before activating a workflow
	 * @param workflowId - The workflow ID
	 * @param trx - Optional database transaction
	 */
	private async validateHasPublishedVersion(workflowId: string, trx?: Knex.Transaction): Promise<void> {
		const hasPublished = await this.versionRepository.hasPublishedVersion(workflowId, trx);

		if (!hasPublished) {
			throw new ApiError(
				"You need to complete the pending configuration before activating the workflow",
				StatusCodes.CONFLICT,
				ERROR_CODES.INVALID
			);
		}
	}
}

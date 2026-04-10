import { BaseRequestValidator } from "./BaseRequestValidator";
import { UpdateWorkflowRequest } from "#core/versioning/types";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

export interface UpdateWorkflowValidatedData {
	workflowId: string;
	workflow: Workflow;
	updateData: UpdateWorkflowRequest;
	userInfo: UserInfo;
}

/**
 * Validator for update workflow requests
 * Handles all business logic validations for updating a workflow
 */
export class UpdateWorkflowRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the update workflow request and returns validated data
	 */
	async validate(
		workflowId: string,
		updateData: UpdateWorkflowRequest,
		userInfo: UserInfo
	): Promise<UpdateWorkflowValidatedData> {
		const workflow = await this.validateWorkflowExists(workflowId);

		this.validateWorkflowAccess(workflow, userInfo);

		await this.validateUpdateRules(updateData);

		return {
			workflowId,
			workflow,
			updateData,
			userInfo
		};
	}

	/**
	 * Validates specific business rules for workflow updates
	 */
	private async validateUpdateRules(updateData: UpdateWorkflowRequest): Promise<void> {
		if (updateData.trigger_id) {
			await this.validateTriggerExists(updateData.trigger_id);
		}
	}

	/**
	 * Validates that a trigger exists
	 */
	private async validateTriggerExists(triggerId: string): Promise<void> {
		const trigger = await this.triggerRepository.getTriggerById(triggerId);

		if (!trigger) {
			throw new ApiError(
				`Trigger with ID ${triggerId} not found`,
				StatusCodes.UNPROCESSABLE_ENTITY,
				ERROR_CODES.INVALID
			);
		}
	}
}

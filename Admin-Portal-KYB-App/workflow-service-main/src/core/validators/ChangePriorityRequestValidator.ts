import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import type { Knex } from "knex";

export interface ChangePriorityValidatedData {
	workflowId: string;
	workflow: Workflow;
	newPriority: number;
	userInfo: UserInfo;
}

/**
 * Validator for change priority requests
 * Handles all business logic validations for changing workflow priority
 */
export class ChangePriorityRequestValidator extends BaseRequestValidator {
	constructor(workflowRepository?: WorkflowRepository) {
		super();
		if (workflowRepository) {
			this.workflowRepository = workflowRepository;
		}
	}

	/**
	 * Validates the change priority request and returns validated data
	 * @param workflowId - The workflow ID to change priority
	 * @param newPriority - The new priority value
	 * @param userInfo - User information for access validation
	 * @param trx - Optional database transaction
	 * @returns Promise<ChangePriorityValidatedData>
	 */
	async validate(
		workflowId: string,
		newPriority: number,
		userInfo: UserInfo,
		trx?: Knex.Transaction
	): Promise<ChangePriorityValidatedData> {
		const workflow = await this.validateWorkflowExists(workflowId, trx);

		this.validateWorkflowAccess(workflow, userInfo);

		await this.validatePriorityRange(workflow.customer_id, newPriority, trx);

		if (workflow.priority === undefined || workflow.priority === null) {
			throw new ApiError("Workflow does not have a valid priority", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (workflow.priority === newPriority) {
			throw new ApiError(`Workflow already has priority ${newPriority}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		return {
			workflowId,
			workflow,
			newPriority,
			userInfo
		};
	}

	/**
	 * Validates that the priority is within valid range (1 to max priority)
	 * @param customerId - The customer ID
	 * @param priority - The priority to validate
	 * @param trx - Optional database transaction
	 */
	private async validatePriorityRange(customerId: string, priority: number, trx?: Knex.Transaction): Promise<void> {
		if (priority < 1) {
			throw new ApiError("Priority must be at least 1", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const maxPriority = await this.workflowRepository.getMaxPriority(customerId, trx);

		if (maxPriority === 0) {
			throw new ApiError("No workflows found for this customer", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		if (priority > maxPriority) {
			throw new ApiError(`Priority must be between 1 and ${maxPriority}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}
}

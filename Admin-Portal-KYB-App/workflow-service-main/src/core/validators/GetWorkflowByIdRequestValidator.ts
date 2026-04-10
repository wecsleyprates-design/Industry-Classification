import { BaseRequestValidator } from "./BaseRequestValidator";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { isValidUUID } from "#utils/validation";
import type { Workflow } from "#core/workflow/types";

/**
 * Validated data structure for get workflow by id request
 */
export interface GetWorkflowByIdValidatedData {
	workflowId: string;
	workflow: Workflow;
	userInfo: UserInfo;
}

/**
 * Validator for get workflow by ID requests
 * Handles all business logic validations for getting a single workflow
 * Follows the same pattern as other validators in the codebase
 */
export class GetWorkflowByIdRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the get workflow by id request and returns validated data
	 * @param workflowId - Workflow ID from path parameters
	 * @param userInfo - User information for access validation
	 * @returns Validated data including the workflow
	 */
	async validate(workflowId: string, userInfo: UserInfo): Promise<GetWorkflowByIdValidatedData> {
		// 1. Validate workflow ID format (UUID)
		this.validateWorkflowIdFormat(workflowId);

		// 2. Validate workflow exists
		const workflow = await this.validateWorkflowExists(workflowId);

		// 3. Validate user access to this workflow's customer
		this.validateWorkflowAccess(workflow, userInfo);

		return {
			workflowId,
			workflow,
			userInfo
		};
	}

	/**
	 * Validates that workflow ID is a valid UUID format
	 * @param workflowId - Workflow ID to validate
	 */
	private validateWorkflowIdFormat(workflowId: string): void {
		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!isValidUUID(workflowId)) {
			throw new ApiError("Workflow ID must be a valid UUID format", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}
}

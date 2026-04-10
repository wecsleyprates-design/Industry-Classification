import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { PreviewEvaluationRequest } from "#types/workflow-dtos";

export interface PreviewEvaluationValidatedData {
	workflowId: string;
	workflow: Workflow;
	request: PreviewEvaluationRequest;
	userInfo: UserInfo;
}

/**
 * Validator for preview evaluation requests
 * Handles all business logic validations for preview evaluation
 * Follows the same pattern as PublishWorkflowRequestValidator and UpdateWorkflowRequestValidator
 */
export class PreviewEvaluationRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the preview evaluation request and returns validated data
	 */
	async validate(
		workflowId: string,
		request: PreviewEvaluationRequest,
		userInfo: UserInfo
	): Promise<PreviewEvaluationValidatedData> {
		// 1. Validate that the workflow exists
		const workflow = await this.validateWorkflowExists(workflowId);

		// 2. Validate user access to the workflow
		this.validateWorkflowAccess(workflow, userInfo);

		// 3. Validate request parameters
		this.validateRequestParameters(request);

		return {
			workflowId,
			workflow,
			request,
			userInfo
		};
	}

	/**
	 * Validates request parameters
	 */
	private validateRequestParameters(request: PreviewEvaluationRequest): void {
		if (!request.case_id && !request.business_id) {
			throw new ApiError(
				"Either case_id or business_id must be provided",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		if (request.sample_size !== undefined) {
			if (request.sample_size < 1 || request.sample_size > 100) {
				throw new ApiError("Sample size must be between 1 and 100", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
		}
	}
}

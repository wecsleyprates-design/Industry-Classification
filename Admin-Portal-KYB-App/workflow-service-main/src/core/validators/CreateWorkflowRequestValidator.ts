import { BaseRequestValidator } from "./BaseRequestValidator";
import type { CreateWorkflowRequest } from "#types/workflow-dtos";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { Utils } from "@joinworth/types";

export interface CreateWorkflowValidatedData {
	request: CreateWorkflowRequest;
	customerId: string;
	userInfo: UserInfo;
}

/**
 * Validator for create workflow requests
 * Handles all business logic validations for creating a workflow
 */
export class CreateWorkflowRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the create workflow request and returns validated data
	 * @param request - The workflow creation request
	 * @param customerId - Customer ID from path parameters
	 * @param userInfo - User information for access validation
	 * @returns Validated data
	 */
	async validate(
		request: CreateWorkflowRequest,
		customerId: string,
		userInfo: UserInfo
	): Promise<CreateWorkflowValidatedData> {
		this.validateCustomerId(customerId);

		this.validateCustomerAccess(
			customerId,
			userInfo,
			"Access denied. You are not authorized to create workflows for this customer."
		);

		await this.validateCreateRules(request);

		return {
			request,
			customerId,
			userInfo
		};
	}

	/**
	 * Validates that customer ID is a valid UUID format
	 * @param customerId - Customer ID to validate
	 */
	private validateCustomerId(customerId: string): void {
		if (!customerId) {
			throw new ApiError("Customer ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!Utils.Utils.isUUID(customerId)) {
			throw new ApiError("Customer ID must be a valid UUID format", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}

	/**
	 * Validates specific business rules for workflow creation
	 */
	private async validateCreateRules(request: CreateWorkflowRequest): Promise<void> {
		if (request.trigger_id) {
			await this.validateTriggerExists(request.trigger_id);
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

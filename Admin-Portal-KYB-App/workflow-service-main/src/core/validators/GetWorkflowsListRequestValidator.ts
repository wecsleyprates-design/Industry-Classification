import { BaseRequestValidator } from "./BaseRequestValidator";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { Utils } from "@joinworth/types";
import type { GetWorkflowsListParams } from "#core/workflow/types";

/**
 * Validated data structure for get workflows list request
 */
export interface GetWorkflowsListValidatedData {
	customerId: string;
	params: GetWorkflowsListParams;
	userInfo: UserInfo;
}

/**
 * Validator for get workflows list requests
 * Handles all business logic validations for getting workflows list
 * Follows the same pattern as PublishWorkflowRequestValidator and UpdateWorkflowRequestValidator
 */
export class GetWorkflowsListRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the get workflows list request and returns validated data
	 * @param customerId - Customer ID from path parameters
	 * @param params - Query parameters for filtering, pagination, search
	 * @param userInfo - User information for access validation
	 * @returns Validated data
	 */
	async validate(
		customerId: string,
		params: GetWorkflowsListParams,
		userInfo: UserInfo
	): Promise<GetWorkflowsListValidatedData> {
		// 1. Validate customer ID format (UUID)
		this.validateCustomerId(customerId);

		// 2. Validate user access to this customer
		this.validateCustomerAccess(
			customerId,
			userInfo,
			"Access denied. You are not authorized to access workflows for this customer."
		);

		return {
			customerId,
			params,
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
}

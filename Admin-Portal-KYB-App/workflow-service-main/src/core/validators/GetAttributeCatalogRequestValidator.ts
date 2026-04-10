import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, ERROR_MESSAGES } from "#constants";
import { Utils } from "@joinworth/types";

/**
 * Validator for get attribute catalog requests
 * Handles customer access validation
 */
export class GetAttributeCatalogRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the get attribute catalog request
	 * @param customerId - Customer ID from path parameters
	 * @param userInfo - User information for access validation
	 */
	async validate(customerId: string, userInfo: UserInfo): Promise<void> {
		this.validateCustomerId(customerId);
		this.validateCustomerAccess(customerId, userInfo, ERROR_MESSAGES.ACCESS_DENIED);
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

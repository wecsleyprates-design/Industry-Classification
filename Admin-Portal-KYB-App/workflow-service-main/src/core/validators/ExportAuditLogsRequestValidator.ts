import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, ERROR_MESSAGES } from "#constants";
import { isValidUUID } from "#utils/validation";

/**
 * Validator for export audit logs requests
 * Handles customer access validation
 */
export class ExportAuditLogsRequestValidator extends BaseRequestValidator {
	/**
	 * Validates the export audit logs request
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
			throw new ApiError(ERROR_MESSAGES.CUSTOMER_ID_REQUIRED, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!isValidUUID(customerId)) {
			throw new ApiError(ERROR_MESSAGES.CUSTOMER_ID_INVALID_UUID, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}
}

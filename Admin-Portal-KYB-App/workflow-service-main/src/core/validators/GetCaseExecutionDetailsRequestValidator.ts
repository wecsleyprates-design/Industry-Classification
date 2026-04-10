import { BaseRequestValidator } from "./BaseRequestValidator";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, ROLES, ERROR_MESSAGES } from "#constants";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { isValidUUID } from "#utils/validation";
import { AuditRepository } from "#core/audit/auditRepository";
import type { ExecutionWithWorkflowInfo } from "#core/audit/types";

export interface GetCaseExecutionDetailsValidatedData {
	caseId: string;
	execution: ExecutionWithWorkflowInfo;
	userInfo: UserInfo;
}

export class GetCaseExecutionDetailsRequestValidator extends BaseRequestValidator {
	private auditRepository: AuditRepository;

	constructor(auditRepository?: AuditRepository) {
		super();
		this.auditRepository = auditRepository ?? new AuditRepository();
	}

	/**
	 * Validates the get case execution details request and returns validated data
	 * @param caseId - Case ID from query parameters
	 * @param userInfo - User information for access validation
	 * @returns Validated data including the execution
	 */
	async validate(caseId: string, userInfo: UserInfo): Promise<GetCaseExecutionDetailsValidatedData> {
		this.validateCaseIdFormat(caseId);

		const execution = await this.validateExecutionExists(caseId);

		this.validateExecutionAccess(execution, userInfo);

		return {
			caseId,
			execution,
			userInfo
		};
	}

	/**
	 * Validates that case ID is a valid UUID format
	 * @param caseId - Case ID to validate
	 */
	private validateCaseIdFormat(caseId: string): void {
		if (!caseId) {
			throw new ApiError(ERROR_MESSAGES.CASE_ID_REQUIRED, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!isValidUUID(caseId)) {
			throw new ApiError(ERROR_MESSAGES.CASE_ID_INVALID_UUID, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}

	/**
	 * Validates that execution exists and returns it
	 * @param caseId - Case ID to validate
	 * @returns Execution record with workflow info
	 */
	private async validateExecutionExists(caseId: string): Promise<ExecutionWithWorkflowInfo> {
		const executions = await this.auditRepository.getLatestExecutionByCaseId(caseId);

		if (executions.length === 0) {
			throw new ApiError(
				`No workflow execution found for case ${caseId}`,
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		return executions[0];
	}

	/**
	 * Validates that the user has access to the execution
	 * @param execution - Execution record to validate access for
	 * @param userInfo - User information
	 */
	private validateExecutionAccess(execution: ExecutionWithWorkflowInfo, userInfo: UserInfo): void {
		const customerId = execution.customer_id;
		if (!customerId) {
			throw new ApiError(
				ERROR_MESSAGES.EXECUTION_MISSING_CUSTOMER_ID,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		if (userInfo.role.code === ROLES.ADMIN) {
			return;
		}

		if (customerId !== userInfo.customer_id) {
			throw new ApiError(ERROR_MESSAGES.EXECUTION_ACCESS_DENIED, StatusCodes.FORBIDDEN, ERROR_CODES.UNAUTHORIZED);
		}
	}
}

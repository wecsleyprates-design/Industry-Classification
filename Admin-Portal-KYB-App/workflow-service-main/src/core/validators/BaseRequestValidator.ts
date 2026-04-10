import { ROLE_ID, ROLES, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { TriggerRepository } from "#core/trigger";
import type { Workflow } from "#core/workflow/types";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import type { Knex } from "knex";

/**
 * Abstract base class for workflow request validators
 * Provides common validation methods that can be reused across different validators
 */
export abstract class BaseRequestValidator {
	protected workflowRepository: WorkflowRepository;
	protected triggerRepository: TriggerRepository;

	constructor() {
		this.workflowRepository = new WorkflowRepository();
		this.triggerRepository = new TriggerRepository();
	}

	/**
	 * Validates that a workflow exists and returns it
	 * @param workflowId - The workflow ID to validate
	 * @param trx - Optional database transaction
	 */
	protected async validateWorkflowExists(workflowId: string, trx?: Knex.Transaction): Promise<Workflow> {
		const workflow = await this.workflowRepository.getWorkflowById(workflowId, trx);
		if (!workflow) {
			throw new ApiError(`Workflow with ID ${workflowId} not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return workflow;
	}

	/**
	 * Validates that a workflow is active
	 */
	protected async validateWorkflowActive(workflowId: string): Promise<Workflow> {
		const workflow = await this.validateWorkflowExists(workflowId);
		if (!workflow.active) {
			throw new ApiError(
				`Workflow with ID ${workflowId} is not active`,
				StatusCodes.CONFLICT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		return workflow;
	}

	/**
	 * Validates that the user has access to a customer's resources
	 * Shared logic for both workflow access and customer access validation
	 * @param customerId - Customer ID to validate access for
	 * @param userInfo - User information
	 * @param errorMessage - Custom error message (optional)
	 */
	protected validateCustomerAccess(customerId: string, userInfo: UserInfo, errorMessage?: string): void {
		// Admin users have access to all customers
		if (userInfo.role.code === ROLES.ADMIN) {
			return;
		}

		// Only customers can access workflows, and only their own workflows
		if (userInfo.role.id !== ROLE_ID.CUSTOMER) {
			throw new ApiError(
				errorMessage ?? "Access denied. You are not authorized to access this resource.",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED
			);
		}

		// Customer users can only access their own resources
		if (userInfo.customer_id !== customerId) {
			throw new ApiError(
				errorMessage ?? "Access denied. You are not authorized to access this resource.",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED
			);
		}
	}

	/**
	 * Validates that the user has access to the workflow
	 * Uses validateCustomerAccess internally to avoid code duplication
	 */
	protected validateWorkflowAccess(workflow: Workflow, userInfo: UserInfo): void {
		this.validateCustomerAccess(
			workflow.customer_id,
			userInfo,
			"Access denied. You are not authorized to access this workflow."
		);
	}

	/**
	 * Abstract method that each specific validator must implement
	 */
	abstract validate(...args: unknown[]): Promise<unknown>;
}

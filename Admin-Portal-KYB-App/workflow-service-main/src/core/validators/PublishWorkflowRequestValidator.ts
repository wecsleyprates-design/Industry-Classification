import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import type { WorkflowVersion } from "#core/versioning/types";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES, WORKFLOW_STATUS } from "#constants";
import { VersionRepository } from "#core/versioning/versionRepository";

export interface PublishWorkflowValidatedData {
	versionId: string;
	workflowVersion: WorkflowVersion;
	workflow: Workflow;
	userInfo: UserInfo;
}

/**
 * Validator for publish workflow requests
 * Handles all business logic validations for publishing a workflow version
 */
export class PublishWorkflowRequestValidator extends BaseRequestValidator {
	private versionRepository: VersionRepository;

	constructor(versionRepository?: VersionRepository) {
		super();
		this.versionRepository = versionRepository ?? new VersionRepository();
	}
	/**
	 * Validates the publish workflow request and returns validated data
	 */
	async validate(versionId: string, userInfo: UserInfo): Promise<PublishWorkflowValidatedData> {
		// 1. Validate that the workflow version exists
		const workflowVersion = await this.validateWorkflowVersionExists(versionId);

		// 2. Validate that the version is in draft status
		this.validateVersionIsDraft(workflowVersion);

		// 3. Get the workflow to validate access
		const workflow = await this.validateWorkflowExists(workflowVersion.workflow_id);

		// 4. Validate user access to the workflow
		this.validateWorkflowAccess(workflow, userInfo);

		// 5. Validate that the version has required components (trigger and rules)
		await this.validateVersionHasRequiredComponents(versionId);

		return {
			versionId,
			workflowVersion,
			workflow,
			userInfo
		};
	}

	/**
	 * Validates that a workflow version exists and returns it
	 */
	private async validateWorkflowVersionExists(versionId: string): Promise<WorkflowVersion> {
		const workflowVersion = await this.versionRepository.getWorkflowVersionById(versionId);
		if (!workflowVersion) {
			throw new ApiError("Workflow version not found", StatusCodes.NOT_FOUND, ERROR_CODES.WORKFLOW_VERSION_NOT_FOUND);
		}
		return workflowVersion;
	}

	/**
	 * Validates that the workflow version is in draft status
	 */
	private validateVersionIsDraft(workflowVersion: WorkflowVersion): void {
		if (workflowVersion.status !== WORKFLOW_STATUS.DRAFT) {
			throw new ApiError(
				"Workflow version is not in draft status",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.WORKFLOW_VALIDATION_ERROR
			);
		}
	}

	/**
	 * Validates that the workflow version has required components (trigger and rules)
	 */
	private async validateVersionHasRequiredComponents(versionId: string): Promise<void> {
		const workflowVersion = await this.versionRepository.getWorkflowVersionById(versionId);
		if (!workflowVersion?.trigger_id) {
			throw new ApiError(
				"Workflow version must have a trigger before publishing",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.WORKFLOW_VALIDATION_ERROR
			);
		}

		const rulesCount = await this.versionRepository.getRulesCountForVersion(versionId);
		if (rulesCount === 0) {
			throw new ApiError(
				"Workflow version must have at least one rule before publishing",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.WORKFLOW_VALIDATION_ERROR
			);
		}
	}
}

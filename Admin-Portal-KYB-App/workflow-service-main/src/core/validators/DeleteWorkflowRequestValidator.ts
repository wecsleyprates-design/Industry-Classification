import { BaseRequestValidator } from "./BaseRequestValidator";
import { ApiError, UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";

export interface DeleteWorkflowValidatedData {
	workflowId: string;
	workflow: Workflow;
	userInfo: UserInfo;
}

/**
 * Validator for delete workflow requests
 * Handles all business logic validations for deleting a workflow
 * Follows the same pattern as PublishWorkflowRequestValidator and UpdateWorkflowRequestValidator
 */
export class DeleteWorkflowRequestValidator extends BaseRequestValidator {
	private versionRepository: VersionRepository;

	constructor(workflowRepository?: WorkflowRepository, versionRepository?: VersionRepository) {
		super();
		if (workflowRepository) {
			this.workflowRepository = workflowRepository;
		}
		this.versionRepository = versionRepository ?? new VersionRepository();
	}

	/**
	 * Validates the delete workflow request and returns validated data
	 * @param workflowId - The workflow ID to delete
	 * @param userInfo - User information for access validation
	 * @returns Promise<DeleteWorkflowValidatedData>
	 */
	async validate(workflowId: string, userInfo: UserInfo): Promise<DeleteWorkflowValidatedData> {
		// 1. Validate that the workflow exists
		const workflow = await this.validateWorkflowExists(workflowId);

		// 2. Validate user access to the workflow
		this.validateWorkflowAccess(workflow, userInfo);

		// 3. Validate that the workflow has no published versions
		await this.validateNoPublishedVersions(workflowId);

		// 4. Validate that the workflow has no archived versions (they contain execution history)
		await this.validateNoArchivedVersions(workflowId);

		// 5. Validate that the workflow has draft versions to delete
		await this.validateHasDraftVersions(workflowId);

		return {
			workflowId,
			workflow,
			userInfo
		};
	}

	/**
	 * Validates that the workflow has no published versions
	 * Only workflows without published versions can be deleted
	 */
	private async validateNoPublishedVersions(workflowId: string): Promise<void> {
		const publishedVersions = await this.versionRepository.getPublishedVersions(workflowId);

		if (publishedVersions.length > 0) {
			throw new ApiError(
				"Cannot delete workflow with published versions. Please archive or unpublish all versions first.",
				StatusCodes.CONFLICT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Validates that the workflow has no archived versions
	 * Archived versions contain execution history and logs should be preserved
	 */
	private async validateNoArchivedVersions(workflowId: string): Promise<void> {
		const archivedVersions = await this.versionRepository.getArchivedVersions(workflowId);

		if (archivedVersions.length > 0) {
			throw new ApiError(
				"Cannot delete workflow with archived versions. Workflows with execution history cannot be deleted.",
				StatusCodes.CONFLICT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Validates that the workflow has draft versions to delete
	 * There must be at least one draft version to perform deletion
	 */
	private async validateHasDraftVersions(workflowId: string): Promise<void> {
		const draftVersions = await this.versionRepository.getDraftVersions(workflowId);

		if (draftVersions.length === 0) {
			throw new ApiError("No draft versions found to delete", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
	}
}

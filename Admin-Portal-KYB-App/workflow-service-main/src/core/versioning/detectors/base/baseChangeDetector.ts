import {
	VersionChange,
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest
} from "#core/versioning/types";

/**
 * Abstract base class for change detection strategies
 * Implements Template Method pattern for consistent change detection flow
 */
export abstract class BaseChangeDetector {
	/**
	 * Detects changes from update request
	 * @param oldData - The current workflow version data with rules
	 * @param request - The update request
	 * @returns Array of detected changes
	 */
	detectChanges(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[] {
		if (!this.hasChanged(oldData, request)) {
			return [];
		}

		return this.createChangeRecords(oldData, request);
	}

	/**
	 * Checks if changes exist from update request
	 * @param oldData - The current workflow version data with rules
	 * @param request - The update request
	 * @returns true if changes detected, false otherwise
	 */
	abstract hasChanged(oldData: WorkflowVersionWithRulesAndTriggerConditions, request: UpdateWorkflowRequest): boolean;

	/**
	 * Creates change records from update request
	 * @param oldData - The current workflow version data with rules
	 * @param request - The update request
	 * @returns Array of change records
	 */
	protected abstract createChangeRecords(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[];

	/**
	 * Gets the field path this detector handles
	 * @returns The field path (e.g., "trigger_id", "rules", "default_action")
	 */
	abstract getFieldPath(): string;
}

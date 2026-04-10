import { BaseChangeDetector } from "#core/versioning/detectors";
import { ChangeDetectorFactory } from "#core/versioning/factories/changeDetectorFactory";
import {
	VersionChange,
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest
} from "#core/versioning/types";

/**
 * Orchestrator for workflow version change detection
 * Uses Strategy + Factory pattern to delegate change detection to specialized detectors
 */
export class VersionChangeDetector {
	private static detectors: BaseChangeDetector[] = ChangeDetectorFactory.createDetectors();

	/**
	 * Determines if a new workflow version is required based on update request
	 * @param oldData - The current published workflow version data with rules
	 * @param request - The update request from the user
	 * @returns true if a new version is required, false otherwise
	 */
	static requiresNewVersion(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): boolean {
		return this.detectors.some(detector => detector.hasChanged(oldData, request));
	}

	/**
	 * Gets a list of changed fields from update request
	 * @param oldData - The current published workflow version data with rules
	 * @param request - The update request from the user
	 * @returns Array of change records for each modified field
	 */
	static getChangedFields(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[] {
		return this.detectors.flatMap(detector => detector.detectChanges(oldData, request));
	}

	/**
	 * Refreshes the detectors based on current configuration
	 * Useful for testing or when configuration changes at runtime
	 */
	static refreshDetectors(): void {
		this.detectors = ChangeDetectorFactory.createDetectors();
	}

	/**
	 * Gets the current detectors for inspection
	 * @returns Array of current detectors
	 */
	static getDetectors(): BaseChangeDetector[] {
		return [...this.detectors];
	}
}

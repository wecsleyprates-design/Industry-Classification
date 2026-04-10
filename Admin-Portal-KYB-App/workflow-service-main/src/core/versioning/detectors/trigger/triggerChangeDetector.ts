import { BaseChangeDetector } from "../base/baseChangeDetector";
import {
	VersionChange,
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest
} from "#core/versioning/types";
import { VERSION_CHANGE_TYPES } from "#constants/version-change.constants";

/**
 * Detector for trigger changes
 * Handles detection of changes to workflow trigger_id
 */
export class TriggerChangeDetector extends BaseChangeDetector {
	getFieldPath(): string {
		return "trigger_id";
	}

	hasChanged(oldData: WorkflowVersionWithRulesAndTriggerConditions, request: UpdateWorkflowRequest): boolean {
		return request.trigger_id !== undefined && oldData.trigger_id !== request.trigger_id;
	}

	protected createChangeRecords(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[] {
		if (!request.trigger_id) {
			return [];
		}

		return [
			{
				field_path: this.getFieldPath(),
				old_value: oldData.trigger_id,
				new_value: request.trigger_id,
				change_type: VERSION_CHANGE_TYPES.TRIGGER_CHANGED
			}
		];
	}
}

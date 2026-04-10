import { BaseChangeDetector } from "../base/baseChangeDetector";
import {
	VersionChange,
	WorkflowVersionWithRulesAndTriggerConditions,
	UpdateWorkflowRequest
} from "#core/versioning/types";
import { isEqual } from "lodash";
import { safeStringify } from "#utils";
import { VERSION_CHANGE_TYPES } from "#constants/version-change.constants";

/**
 * Detector for default action changes
 * Handles detection of changes to workflow default_action
 */
export class DefaultActionChangeDetector extends BaseChangeDetector {
	getFieldPath(): string {
		return "default_action";
	}

	hasChanged(oldData: WorkflowVersionWithRulesAndTriggerConditions, request: UpdateWorkflowRequest): boolean {
		return request.default_action !== undefined && !isEqual(oldData.default_action, request.default_action);
	}

	protected createChangeRecords(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[] {
		if (request.default_action === undefined) {
			return [];
		}

		return [
			{
				field_path: this.getFieldPath(),
				old_value: safeStringify(oldData.default_action),
				new_value: safeStringify(request.default_action),
				change_type: VERSION_CHANGE_TYPES.DEFAULT_ACTION_CHANGED
			}
		];
	}
}

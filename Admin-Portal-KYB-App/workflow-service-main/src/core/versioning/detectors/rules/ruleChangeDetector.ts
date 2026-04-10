import { BaseChangeDetector } from "../base/baseChangeDetector";
import { VersionChange, WorkflowVersionWithRulesAndTriggerConditions, UpdateWorkflowRequest } from "../../types";
import type { WorkflowRuleRequest } from "#types/workflow-dtos";
import { isEqual } from "lodash";
import { safeStringify } from "#utils";
import { VERSION_CHANGE_TYPES } from "#constants/version-change.constants";

/**
 * Detector for rule changes
 * Handles detection of changes to workflow rules (priority, conditions, actions)
 */
export class RuleChangeDetector extends BaseChangeDetector {
	getFieldPath(): string {
		return "rules";
	}

	hasChanged(oldData: WorkflowVersionWithRulesAndTriggerConditions, request: UpdateWorkflowRequest): boolean {
		if (!request.rules) {
			return false;
		}

		const oldRules: WorkflowRuleRequest[] = oldData.rules.map(({ name, conditions, actions }) => ({
			name,
			conditions,
			actions
		}));

		return !this.areRulesEqual(oldRules, request.rules);
	}

	protected createChangeRecords(
		oldData: WorkflowVersionWithRulesAndTriggerConditions,
		request: UpdateWorkflowRequest
	): VersionChange[] {
		if (!request.rules) {
			return [];
		}

		const changes: VersionChange[] = [];

		const oldName = oldData.rules.map(rule => rule.name);
		const newName = request.rules.map(rule => rule.name);
		if (!isEqual(oldName, newName)) {
			changes.push({
				field_path: "rules.name",
				old_value: safeStringify(oldName),
				new_value: safeStringify(newName),
				change_type: VERSION_CHANGE_TYPES.RULE_RENAMED
			});
		}

		const oldActions = oldData.rules.map(rule => rule.actions);
		const newActions = request.rules.map(rule => rule.actions);
		if (!isEqual(oldActions, newActions)) {
			changes.push({
				field_path: "rules.actions",
				old_value: safeStringify(oldActions),
				new_value: safeStringify(newActions),
				change_type: VERSION_CHANGE_TYPES.RULE_MODIFIED
			});
		}

		const oldConditions = oldData.rules.map(rule => rule.conditions);
		const newConditions = request.rules.map(rule => rule.conditions);
		if (!isEqual(oldConditions, newConditions)) {
			changes.push({
				field_path: "rules.conditions",
				old_value: safeStringify(oldConditions),
				new_value: safeStringify(newConditions),
				change_type: VERSION_CHANGE_TYPES.RULE_MODIFIED
			});
		}

		return changes;
	}

	/**
	 * Compares rules from database with rules from request
	 * @param oldRules - The old rules from database
	 * @param requestRules - The rules from request
	 * @returns true if rules are equal, false otherwise
	 */
	private areRulesEqual(oldRules: WorkflowRuleRequest[], requestRules: WorkflowRuleRequest[]): boolean {
		if (oldRules.length !== requestRules.length) {
			return false;
		}

		const oldRulesData = oldRules.map(rule => ({
			name: rule.name,
			priority: rule.priority,
			conditions: rule.conditions, // Compare DSL directly
			actions: rule.actions
		}));

		const newRulesData = requestRules.map(rule => ({
			name: rule.name,
			priority: rule.priority,
			conditions: rule.conditions, // Compare DSL directly
			actions: rule.actions
		}));

		return isEqual(oldRulesData, newRulesData);
	}
}

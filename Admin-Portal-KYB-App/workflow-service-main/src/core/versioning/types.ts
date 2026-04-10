import { type Request } from "express";
import type { WorkflowRule } from "#core/rule/types";
import type { WorkflowAction } from "#core/actions/types";
import { WORKFLOW_STATUS, type VersionChangeType } from "#constants";
import type { WorkflowRuleRequest, WorkflowActionRequest } from "#types/workflow-dtos";

export type { WorkflowVersionResponse, VersionStatus } from "#types/workflow-dtos";

export interface VersionChange {
	field_path: string;
	old_value: string | null;
	new_value: string | null;
	change_type: string;
	note?: string;
}

export interface VersionCreationResult {
	workflow_id: string;
	version_id: string;
	version_number: number;
	changes: VersionChange[];
}

export interface WorkflowVersion {
	id: string;
	workflow_id: string;
	trigger_id: string;
	version_number: number;
	status: (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];
	snapshot?: Record<string, unknown>;
	published_at?: Date;
	default_action?: WorkflowAction | WorkflowAction[];
	is_current: boolean;
	created_by: string;
	created_at: Date;
	updated_by: string;
	updated_at: Date;
}

export interface WorkflowVersionWithRulesAndTriggerConditions extends WorkflowVersion {
	rules: WorkflowRule[];
	trigger_conditions?: Record<string, unknown> | null;
}

export interface UpdateWorkflowRequest {
	name?: string;
	description?: string;
	active?: boolean;
	trigger_id?: string;
	rules?: WorkflowRuleRequest[];
	default_action?: WorkflowActionRequest | WorkflowActionRequest[];
	auto_publish?: boolean;
}

export interface UpdateWorkflowRequestWithBody extends Request {
	body: UpdateWorkflowRequest;
	params: {
		id?: string;
	};
}

export interface VersioningConfig {
	versionGeneratingFields: string[];
	logAllChanges: boolean;
}

export interface WorkflowPriorityChange {
	workflow_id: string;
	old_priority: number;
	new_priority: number;
	affected_workflows: string[];
}

export interface ChangeLogEntry {
	workflow_id: string;
	workflow_version_id: string;
	field_path: string;
	old_value: string | null;
	new_value: string | null;
	change_type: VersionChangeType | string;
	note?: string;
	changed_by: string;
	changed_at: Date;
}

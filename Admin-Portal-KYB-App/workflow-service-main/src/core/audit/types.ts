import type { DecisionType } from "#constants";

export interface CsvExportResult {
	csvData: string;
	filename: string;
}

export interface ExportConfig {
	maxRecords: number;
	filenames: {
		executionLogs: string;
		workflowChangesLogs: string;
	};
}

export interface ExecutionLogRecord {
	case_id: string;
	workflow_version_id: string;
	matched_rule_id: string | null;
	executed_at: Date;
	input_attr: Record<string, unknown> | null;
	evaluation_log: Record<string, unknown> | null;
	latency_ms: number | null;
	created_at: Date;
	customer_id: string;
	workflow_id: string;
	action_applied: Record<string, unknown> | null;
}

export interface EnrichedExecutionLogRecord extends ExecutionLogRecord {
	matched_rule_name?: string | null;
	rule_outcome?: string | null;
	decision_type?: DecisionType | null;
	total_rules_evaluated?: number | null;
	trigger_matched?: string | null;
	conditions?: string | null;
	action_type?: string | null;
	action_target_field?: string | null;
	action_value?: unknown;
}

export interface WorkflowChangeLogRecord {
	workflow_version_id: string | null;
	workflow_id: string;
	field_path: string;
	old_value: string | null;
	new_value: string | null;
	change_type: string;
	note: string | null;
	changed_by: string;
	created_at: Date;
	customer_id: string;
}

export interface ExecutionWithWorkflowInfo extends ExecutionLogRecord {
	workflow_name: string;
	version_number: string;
}

export interface WorkflowInfoByVersionRecord {
	workflow_version_id: string;
	workflow_id: string;
	workflow_name: string;
	version_number: string;
}

export type WorkflowInfoByWorkflowIdRecord = Pick<WorkflowInfoByVersionRecord, "workflow_id" | "workflow_name">;

export interface WorkflowInfo {
	name: string;
	version: string;
}

export interface WorkflowVersionIdPair {
	workflow_id: string;
	workflow_version_id: string;
}

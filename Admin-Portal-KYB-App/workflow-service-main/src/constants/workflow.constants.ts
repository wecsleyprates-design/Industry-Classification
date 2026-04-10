import { Workflows } from "@joinworth/types";

export const WORKFLOW_STATUS = Workflows.Versions.VERSION_STATUS;
export const WORKFLOW_LIST_STATUS = Workflows.Workflows.WORKFLOW_LIST_STATUS;
export const ACTION_TYPES = Workflows.Validations.ACTION_TYPES;

export type WorkflowListStatus = (typeof WORKFLOW_LIST_STATUS)[keyof typeof WORKFLOW_LIST_STATUS];

export const FIELD_PATHS = {
	WORKFLOW: "workflow"
} as const;

export const ERROR_MESSAGES = {
	INVALID_WORKFLOW_ID: "Invalid workflow ID",
	INVALID_RULES_ARRAY: "Rules array is required and must not be empty",
	INVALID_RULE_STRUCTURE: "Invalid rule structure",
	ID_PARAM_REQUIRED: "The parameter 'id' is required and must be a string",
	ID_PARAM_INVALID_UUID: "The parameter 'id' must be a valid UUID format",
	WORKFLOW_NOT_FOUND: "Workflow not found or access denied",
	NO_DRAFT_VERSION: "No draft version found for this workflow",
	INVALID_INPUT_PARAMETERS: "Invalid input parameters",
	UNKNOWN_FIELD: "Unknown field referenced in rule conditions",
	OPERATOR_NOT_ALLOWED: "Operator not allowed for this field type",
	TYPE_MISMATCH: "Type mismatch between field and value",
	UNREACHABLE_BRANCH: "Unreachable branch detected in rule conditions",
	ACCESS_DENIED: "Access denied. You are not authorized to access this resource.",
	CUSTOMER_ID_REQUIRED: "Customer ID is required",
	CUSTOMER_ID_INVALID_UUID: "Customer ID must be a valid UUID format",
	CASE_ID_REQUIRED: "Case ID is required",
	CASE_ID_INVALID_UUID: "Case ID must be a valid UUID format",
	EXECUTION_ACCESS_DENIED: "Access denied. You are not authorized to access this case execution.",
	EXECUTION_MISSING_CUSTOMER_ID: "Execution record is missing customer_id.",
	SHARED_RULE_NOT_FOUND: "Rule not found",
	SHARED_RULE_FAILED_CREATE: "Failed to create rule",
	SHARED_RULE_FAILED_GET: "Failed to get rule",
	SHARED_RULE_FAILED_UPDATE_METADATA: "Failed to update rule metadata",
	SHARED_RULE_FAILED_CREATE_VERSION: "Failed to create rule version",
	SHARED_RULE_FAILED_GET_LATEST_VERSION: "Failed to get latest rule version",
	SHARED_RULE_FAILED_GET_MAX_VERSION: "Failed to get max version number",
	GENERIC_INTERNAL_SERVER_ERROR: "Internal server error"
} as const;

export const SUCCESS_MESSAGES = {
	RULES_ADDED: "Rules added to draft workflow successfully",
	RULES_UPDATED: "Rules updated successfully",
	TRIGGERS_RETRIEVED: "Triggers retrieved successfully",
	DRAFT_CREATED: "Workflow draft created successfully",
	WORKFLOW_PUBLISHED: "Workflow published successfully",
	WORKFLOW_CREATED_AND_PUBLISHED: "Workflow created and published successfully",
	WORKFLOW_UPDATED: "Workflow updated successfully",
	WORKFLOW_PRIORITY_CHANGED: "Workflow priority changed successfully",
	WORKFLOW_STATUS_UPDATED: "Workflow status updated successfully",
	PREVIEW_EVALUATION: "Workflow preview evaluation completed successfully",
	WORKFLOWS_RETRIEVED: "Workflows retrieved successfully",
	WORKFLOW_RETRIEVED: "Workflow retrieved successfully",
	ATTRIBUTE_CATALOG_RETRIEVED: "Attribute catalog retrieved successfully",
	CASE_EXECUTION_DETAILS_RETRIEVED: "Case execution details retrieved successfully",
	RULE_CREATED: "Rule created successfully",
	RULE_UPDATED: "Rule updated successfully",
	EVALUATION_COMPLETED: "Rule evaluation completed successfully",
	RULE_DETAILS_RETRIEVED: "Shared rule details retrieved successfully"
} as const;

export const RESPONSE_STATUS = {
	SUCCESS: "success",
	FAIL: "fail",
	ERROR: "error"
} as const;

export const TRIGGER_TYPES = {
	INITIAL_SUBMIT: "initial_submit",
	RESUBMIT: "resubmit"
} as const;

export type TriggerType = (typeof TRIGGER_TYPES)[keyof typeof TRIGGER_TYPES];

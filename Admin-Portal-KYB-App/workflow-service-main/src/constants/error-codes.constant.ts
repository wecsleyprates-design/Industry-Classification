// Re-export ERROR_CODES from Types repository to avoid duplication
import { Constants } from "@joinworth/types";
export const ERROR_CODES = Constants.ERROR_CODES;
export type ErrorCode = keyof typeof ERROR_CODES;

// Workflow-specific error codes that extend the base ERROR_CODES
export const WORKFLOW_ERROR_CODES = {
	AWAITING_THIRD_PARTY_RESPONSE: "AWAITING_THIRD_PARTY_RESPONSE",
	WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
	WORKFLOW_VERSION_NOT_FOUND: "WORKFLOW_VERSION_NOT_FOUND",
	WORKFLOW_VALIDATION_ERROR: "WORKFLOW_VALIDATION_ERROR",
	UNAUTHENTICATED: "UNAUTHENTICATED"
} as const;

// Combined error codes for workflow service
export const WORKFLOW_ERROR_CODES_COMBINED = {
	...Constants.ERROR_CODES,
	...WORKFLOW_ERROR_CODES
} as const;

export type WorkflowErrorCode = keyof typeof WORKFLOW_ERROR_CODES_COMBINED;

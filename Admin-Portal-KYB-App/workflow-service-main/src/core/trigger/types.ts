// Re-export types from centralized DTOs
export type {
	TriggerCondition,
	TriggerConditionGroup,
	TriggerConditions,
	TriggerResponse,
	GetTriggersResponse
} from "#types/workflow-dtos";

// Import for local use
import type { TriggerConditions } from "#types/workflow-dtos";

// Local types (DB models - internal to workflow-service)

export type JsonLogicTrigger = Record<string, unknown>;

/** Workflow trigger DB model (data_workflow_triggers) */
export interface WorkflowTrigger {
	id: string;
	name: string;
	conditions: TriggerConditions;
	created_by: string;
	created_at: Date;
	updated_by: string;
	updated_at: Date;
}

export interface TriggerEvaluationLog {
	workflow_id: string;
	workflow_version_id?: string;
	matched: boolean;
	error?: string;
}

export interface WorkflowTriggerCarrier {
	id: string;
	trigger?: Record<string, unknown>;
}

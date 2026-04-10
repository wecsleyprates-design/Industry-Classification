import { Workflows } from "@joinworth/types";

export const WORKFLOW_CHANGE_TYPES = Workflows.Versions.WORKFLOW_CHANGE_TYPES;

export type WorkflowChangeType = (typeof WORKFLOW_CHANGE_TYPES)[keyof typeof WORKFLOW_CHANGE_TYPES];

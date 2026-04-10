import { ACTION_TYPES } from "#constants";

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export interface WorkflowAction {
	type: ActionType;
	parameters: Record<string, unknown>;
}

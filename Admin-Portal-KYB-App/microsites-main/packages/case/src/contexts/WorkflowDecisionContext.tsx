import { createContext, useContext } from "react";

import { type WORKFLOW_DECISION_ENUM } from "@/constants/Workflows";

export interface WorkflowDecisionContextValue {
	workflowDecision: WORKFLOW_DECISION_ENUM | string;
}

export const WorkflowDecisionContext =
	createContext<WorkflowDecisionContextValue>({ workflowDecision: "" });

/**
 * Returns the current workflow decision from the nearest WorkflowDecisionContext.Provider.
 * Returns empty string when used outside the provider (e.g. WorkflowConditions on another route).
 */
export function useWorkflowDecision(): string {
	const context = useContext(WorkflowDecisionContext);
	return context.workflowDecision ?? "";
}

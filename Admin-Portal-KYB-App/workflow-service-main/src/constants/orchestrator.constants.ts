export const ORCHESTRATOR_MSG = {
	NOT_ALL_REQUIRED_EVENTS_RECEIVED: "Orchestrator: not all required events received yet",
	DISPATCH_ALREADY_CLAIMED: "Orchestrator: dispatch already claimed by another consumer",
	CASE_NOT_CUSTOM_WORKFLOW_CLEARING_STATE: "Orchestrator: case not custom_workflow, clearing state",
	NOTIFY_WORKFLOW_ENQUEUED: "Orchestrator: notifyWorkflow enqueued",
	TRY_DISPATCH_FAILED: "Orchestrator: tryDispatchIfReady failed",
	MARKED_FACTS_READY_AND_TRIED_DISPATCH: "Orchestrator: marked facts_ready and tried dispatch for case:",
	MARKED_CASE_STATUS_UPDATED_AND_TRIED_DISPATCH: "Orchestrator: marked case_status_updated and tried dispatch for case:"
} as const;

export const CASE_CONSUMER_ERROR_MSG = {
	FAILED_INTEGRATION_CATEGORY_COMPLETE: "Failed to process integration_category_complete_event for case",
	FAILED_CASE_STATUS_UPDATED: "Failed to process case_status_updated_event for case",
	FAILED_APPLICATION_EDIT_FACTS_READY: "Failed to process application_edit_facts_ready_event for case"
} as const;

export const ORCHESTRATOR_SKIP_MSG = {
	INTEGRATION_CATEGORY_COMPLETE: "Skipping integration_category_complete_event: case",
	CASE_STATUS_UPDATED: "Skipping case_status_updated_event: case",
	APPLICATION_EDIT_FACTS_READY: "Skipping application_edit_facts_ready_event: case"
} as const;

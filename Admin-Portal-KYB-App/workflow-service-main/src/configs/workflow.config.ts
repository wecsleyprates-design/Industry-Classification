import { type WorkflowConfig } from "#core/workflow/types";

export const workflowConfig: WorkflowConfig = {
	processingQueue: {
		removeOnComplete: 10,
		removeOnFail: 5,
		retry: {
			attempts: 3,
			backoffDelay: 60 * 1000, // 1 minute
			backoffType: "exponential"
		}
	},
	versioning: {
		versionGeneratingFields: ["trigger_id", "rules.priority", "rules.conditions", "rules.actions", "default_action"],
		logAllChanges: true
	}
};

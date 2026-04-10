import { envConfig } from "#configs/env.config";

export const KAFKA_TOPICS = {
	CASES_V1: envConfig.CASES_KAFKA_TOPIC ?? "cases.v1",
	WORKFLOWS_V1: envConfig.WORKFLOWS_KAFKA_TOPIC ?? "workflows.v1",
	NOTIFICATIONS_V1: envConfig.NOTIFICATIONS_KAFKA_TOPIC ?? "notifications.v1",
	BUSINESS_V1: envConfig.BUSINESS_KAFKA_TOPIC ?? "business.v1"
} as const;

export const KAFKA_MESSAGE_KEYS = {
	WORKFLOW_CHANGE_ATTRIBUTE_EVENT: "workflow_change_attribute_event",
	INTEGRATION_CATEGORY_COMPLETE_EVENT: "integration_category_complete_event",
	APPLICATION_EDIT_FACTS_READY_EVENT: "application_edit_facts_ready_event",
	CASE_STATUS_UPDATED_EVENT: "case_status_updated_event",
	SHARED_RULES_EVALUATION_EVENT: "shared_rules_evaluation_event",
	BUSINESS_STATE_UPDATE_EVENT: "business_state_update_event"
} as const;

// Topics to subscribe to (consume messages from)
export const KAFKA_SUBSCRIBE_TOPICS: string[] = [
	String(KAFKA_TOPICS.NOTIFICATIONS_V1),
	String(KAFKA_TOPICS.BUSINESS_V1)
];

// Topics to push/publish messages to
export const KAFKA_PUSH_TOPICS: string[] = [String(KAFKA_TOPICS.CASES_V1), String(KAFKA_TOPICS.WORKFLOWS_V1)];

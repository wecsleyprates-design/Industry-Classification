export interface ProcessCompletionFactsEvent {
	business_id: string;
	customer_id?: string | null;
	case_id?: string | null;
	score_trigger_id?: string | null;
	action: string; // "timeout_monitor" | "all_integrations_complete"
	category_id: "all" | number; // "all" or number between 1 and 9
	category_name?: string | null;
	completion_state: Record<string, unknown>;
}

export interface ApplicationEditFactsReadyEvent {
	business_id: string;
	case_id: string;
	customer_id?: string | null;
	previous_status?: string | null;
}

export interface CaseStatusUpdatedEvent {
	case_id: string;
	business_id: string;
	case_status: string;
}

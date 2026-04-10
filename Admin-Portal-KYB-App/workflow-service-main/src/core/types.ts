/**
 * Shared types without a dedicated module
 * Types with dedicated modules should be in their respective module's types.ts file
 */

import type { TriggerType } from "#constants";

export interface CaseData {
	id: string;
	customer_id: string;
	status: string | { id: string | number; code: string | number; label: string };
	business_id?: string;
	active_decisioning_type?: string;
	created_at: Date;
	updated_at: Date;
}

export interface WorkflowAnnotations {
	source_events: Record<string, string>;
	trigger_type: TriggerType;
}

export interface EventConfig {
	customerId?: string;
	eventType?: string;
	metadata?: Record<string, unknown>;
	priority?: number;
	timestamp?: string;
	annotations?: WorkflowAnnotations;
	previous_status?: string;
}

export interface CaseAttributeChangeEvent {
	case_id: string;
	attribute_type: string;
	attribute_value: string | number;
	comment: string;
}

export interface WorkflowNotificationData {
	case_id: string;
	customer_id: string;
	annotations?: WorkflowAnnotations;
	previous_status?: string;
}

export interface WorkflowNotificationResponse {
	message: string;
	job_id: string | number;
	estimated_processing_time: string;
}

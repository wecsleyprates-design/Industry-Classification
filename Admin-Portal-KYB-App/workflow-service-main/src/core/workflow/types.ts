/**
 * Types for workflow operations
 */

import type { WorkflowListStatus } from "#constants";
import type { JsonLogicTrigger } from "#core/trigger/types";
import type { WorkflowListItem } from "#types/workflow-dtos";

export type {
	WorkflowListItem,
	GetWorkflowByIdTrigger,
	GetWorkflowByIdRule,
	GetWorkflowByIdCurrentVersion,
	GetWorkflowByIdResponse
} from "#types/workflow-dtos";

export interface Workflow {
	id: string;
	customer_id: string;
	name: string;
	description?: string;
	active: boolean;
	priority?: number;
	created_by: string;
	created_at: Date;
	updated_by: string;
	updated_at: Date;
}

export interface WorkflowWithTrigger extends Workflow {
	trigger: JsonLogicTrigger;
}

export interface GetWorkflowsListParams {
	customerId: string;
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
	filter?: {
		status?: string | string[];
		created_by?: string | string[];
	};
	search?: {
		name?: string;
		description?: string;
	};
}

export interface GetWorkflowsListRepositoryParams {
	customerId: string;
	pagination: {
		page: number;
		itemsPerPage: number;
		usePagination: boolean;
		offset: number;
	};
	filter?: {
		status?: string | string[];
		created_by?: string | string[];
	};
	search?: {
		name?: string;
		description?: string;
	};
}

export interface WorkflowListResult {
	id: string;
	name: string;
	description: string | null;
	priority: number;
	cases: number;
	published_version: string | null;
	draft_version: string | null;
	status: WorkflowListStatus;
	created_by: string;
	created_at: Date;
	updated_at: Date | null;
}

export interface GetWorkflowsListResult {
	workflows: WorkflowListResult[];
	totalItems: number;
}

export interface GetWorkflowsListManagerResult {
	records: WorkflowListItem[];
	totalPages: number;
	totalItems: number;
}

export interface RawWorkflowRow {
	id: string;
	name: string;
	description: string | null;
	priority: number;
	active: boolean;
	created_by: string;
	created_at: Date;
	updated_at: Date | null;
	published_version: string | null;
	draft_version: string | null;
	case_count: string | number;
}

export type WorkflowRuleConditions = Record<string, unknown>;

export interface WorkflowJobData {
	case_id: string;
	customer_id: string;
	enqueued_at: string;
	annotations?: import("#core/types").WorkflowAnnotations;
	previous_status?: string;
}

export interface WorkflowResult {
	case_id: string;
	customer_id: string;
	status: string;
	processed_at: string;
	enqueued_at: string;
}

export interface WorkflowConfig {
	processingQueue: {
		removeOnComplete: number;
		removeOnFail: number;
		retry: {
			attempts: number;
			backoffDelay: number;
			backoffType: "exponential" | "fixed";
		};
	};
	versioning: {
		versionGeneratingFields: string[];
		logAllChanges: boolean;
	};
}

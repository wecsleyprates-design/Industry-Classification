/**
 * Express request types for workflow API endpoints
 * Only Express-specific types should be defined here.
 * For DTOs, import directly from @joinworth/types.
 * For domain types, import from #core/...
 */

import { type Request } from "express";
import type {
	CreateWorkflowRequest,
	AddRulesRequest,
	UpdateWorkflowStatusRequest,
	PreviewEvaluationRequest,
	GetWorkflowsListQuery
} from "#types/workflow-dtos";

export interface CreateWorkflowRequestWithBody extends Omit<Request, "body" | "params"> {
	body: CreateWorkflowRequest;
	params: {
		customerId: string;
	};
}

export interface AddRulesRequestWithBody extends Omit<Request, "body" | "params"> {
	body: AddRulesRequest;
	params: {
		id?: string;
	};
}

export interface PublishWorkflowRequestWithBody extends Omit<Request, "body" | "params"> {
	body: Record<string, never>;
	params: {
		id?: string;
	};
}

export interface PreviewEvaluationRequestWithBody extends Omit<Request, "body" | "params"> {
	body: PreviewEvaluationRequest;
	params: {
		id?: string;
	};
}

export interface DeleteWorkflowRequestWithBody extends Omit<Request, "params"> {
	params: {
		id?: string;
	};
}

export interface GetWorkflowsListRequest extends Omit<Request, "query"> {
	params: {
		customerId: string;
	};
	query: GetWorkflowsListQuery;
}

export interface UpdateWorkflowStatusRequestWithBody extends Omit<Request, "body" | "params"> {
	body: UpdateWorkflowStatusRequest;
	params: {
		id?: string;
	};
}

export interface GetWorkflowByIdRequest extends Omit<Request, "params"> {
	params: {
		id?: string;
	};
}

export interface ChangePriorityRequestWithBody extends Omit<Request, "body" | "params"> {
	body: {
		priority: number;
	};
	params: {
		id?: string;
	};
}

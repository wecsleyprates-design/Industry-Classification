import { type Request } from "express";
import type {
	ExportExecutionLogsQuery,
	ExportWorkflowChangesLogsQuery,
	GetCaseExecutionDetailsQuery
} from "#types/workflow-dtos";

export interface ExportExecutionLogsRequest extends Omit<Request, "query" | "params"> {
	query: ExportExecutionLogsQuery;
	params: {
		customerId: string;
	};
}

export interface ExportWorkflowChangesLogsRequest extends Omit<Request, "query" | "params"> {
	query: ExportWorkflowChangesLogsQuery;
	params: {
		customerId: string;
	};
}

export interface GetCaseExecutionDetailsRequest extends Omit<Request, "query"> {
	query: GetCaseExecutionDetailsQuery;
}

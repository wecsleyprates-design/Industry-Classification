import { StatusCodes } from "http-status-codes";
import { type ErrorCode } from "#constants/index";
import { CaseData } from "#core/types";
import { CustomFieldsSummaryResponse } from "#types/workflow-dtos";

// Re-export CaseData from core types
export { CaseData };

export interface CaseServiceResponse {
	data?: CaseData;
	status: number;
	message?: string;
}

export interface CaseServiceError {
	status: StatusCodes;
	errorCode: ErrorCode;
	message: string;
}

export interface CaseServiceConfig {
	baseURL: string;
	apiPrefix: string;
	healthPath: string;
	timeout: number;
}
export interface CustomFieldsResponse {
	status: string;
	message: string;
	data: CustomFieldsSummaryResponse;
}

import { StatusCodes } from "http-status-codes";
import { type ErrorCode, type WorkflowErrorCode } from "#constants/index";

/**
 * Generic API error class for external service calls
 * Can be used across all services (Case, Warehouse, WorthScore, etc.)
 */
export class ApiError extends Error {
	public status: StatusCodes;
	public errorCode: WorkflowErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: WorkflowErrorCode) {
		super(message);
		this.name = "ApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

/**
 * Validation middleware error for request validation failures
 */
export class ValidationMiddlewareError extends Error {
	public status: number;
	public errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "ValidationMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

/**
 * Role middleware error for authorization failures
 */
export class RoleMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "RoleMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

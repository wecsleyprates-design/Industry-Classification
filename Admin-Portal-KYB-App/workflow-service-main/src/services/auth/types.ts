import { StatusCodes } from "http-status-codes";
import { type ErrorCode } from "#constants";

export interface CustomerNamesResponse {
	[customerId: string]: string; // Map of UUID to customer name
}

export interface AuthServiceBatchResponse {
	status: "success" | "fail" | "error";
	message?: string;
	data?: CustomerNamesResponse;
}

export interface AuthServiceError {
	status: StatusCodes;
	errorCode: ErrorCode;
	message: string;
}

export interface AuthServiceConfig {
	baseURL: string;
	apiPrefix: string;
	timeout: number;
}

export interface UserSubroleResponse {
	id: string;
	code: string;
	label: string;
	role_id: number;
}

export interface AuthServiceUserResponse {
	status: "success" | "fail" | "error";
	message?: string;
	data?: {
		id: string;
		email: string;
		first_name: string;
		last_name: string;
		status: string;
		subrole: UserSubroleResponse;
	};
}

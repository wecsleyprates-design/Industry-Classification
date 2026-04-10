import { type Response } from "express";

// Re-export error classes from dedicated errors file
export { ApiError, ValidationMiddlewareError, RoleMiddlewareError } from "./errors";

export interface ApiResponse<T = unknown> {
	status: "success" | "fail" | "error";
	data?: T;
	message?: string;
}

export interface PaginationParams {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}
/**
 * User information extracted from JWT token and populated in res.locals.user
 *
 * @property user_id - Unique user identifier from Cognito (custom:id)
 * @property email - User email address
 * @property role - User role object with id and code (admin, customer, applicant)
 * @property given_name - User's first name
 * @property family_name - User's last name
 * @property customer_id - Customer ID for customer users (present in JWT as custom:customer_id)
 * @property sub_user_id - Cognito username (cognito:username)
 * @property access_token - JWT access token
 * @property subrole_id - Subrole ID for customer users (present in JWT as custom:subrole_id, used to fetch subrole_code from database)
 */
export interface UserInfo {
	user_id: string;
	email: string;
	role: {
		id: number;
		code: string;
	};
	given_name: string;
	family_name: string;
	customer_id: string;
	sub_user_id?: string;
	access_token?: string;
	subrole_id?: string;
}
interface ILocals {
	user: UserInfo;
}
export interface TResponseLocals {
	locals: ILocals;
}

export interface TResponseFlagValue {
	featureFlagValue?: boolean | string | number | Record<string, unknown>;
}

export interface IFlagConfig {
	contextBy: string;
	defaultValue?: boolean;
}

export interface ResponseWithLocals extends Response {
	locals: {
		user: UserInfo;
	};
}

export interface TestApiResponse {
	status: string;
	data: Record<string, unknown>;
	message?: string;
}

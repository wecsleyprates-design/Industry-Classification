// =====================
// PATCH /customers/:customerID/users/:userID
// =====================

import { type User } from "./User";

// Request interfaces
export interface PatchCustomerUserParams {
	customerID: string; // UUID
	userID: string; // UUID
}

export interface PatchCustomerUserRequest {
	first_name?: string;
	last_name?: string;
	email?: string; // Must be valid email, no disposable domains
	mobile?: string; // Can be empty string to clear, must be valid phone number if provided
	subrole?: Pick<User["subrole"], "id" | "code" | "label">; // Optional, can be used to change subrole
	status?: "ACTIVE" | "INACTIVE";
}

// No response body - just HTTP 200 with success message
export type PatchCustomerUserResponse = Record<string, never>;

// =====================
// POST /customers/:customerID/users
// =====================

import { type APIResponse } from "./APIResponse";
import { type User } from "./User";

// Request interfaces
export interface PostCustomerUserParams {
	customerID: string; // UUID
}

export interface PostCustomerUserRequest {
	first_name: string;
	last_name: string;
	email: string; // Must be valid email, no disposable domains
	mobile?: string; // Optional, must be valid phone number if provided
	subrole: Pick<User["subrole"], "id" | "code" | "label">;
}

// Response interface
export type PostCustomerUserResponse = APIResponse<{
	user_id: string; // UUID of the created user
}>;

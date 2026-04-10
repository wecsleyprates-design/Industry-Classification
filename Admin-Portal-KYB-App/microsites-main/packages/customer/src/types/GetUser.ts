// =====================
// GET /users/:userID
// =====================

import { type User } from "./User";

// Request interfaces
export interface GetUserParams {
	userID: string; // UUID
}

export interface GetUserQueryParams {
	role?: "ADMIN" | "CUSTOMER" | "APPLICANT"; // Maps to ROLE_ID, defaults to ADMIN
}

// Response interface
export type GetUserResponse = User;

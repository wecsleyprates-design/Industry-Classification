import { type APIResponse } from "./APIResponse";
import { type User } from "./User";

// =====================
// GET /customers/:customerID/users/:userID
// =====================

export interface GetCustomerUserParams {
	customerID: string; // UUID
	userID: string; // UUID
}

export type GetCustomerUserResponse = APIResponse<User>;

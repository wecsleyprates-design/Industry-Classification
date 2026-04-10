import { type PaginatedAPIResponse } from "./PaginatedAPIResponse";
import { type User } from "./User";

export interface GetCustomerUsersParams {
	// Pagination parameters
	pagination?: boolean;
	items_per_page?: number;
	page?: number;

	// Sorting parameters
	sort?: {
		first_name?: "ASC" | "DESC";
		last_name?: "ASC" | "DESC";
		"data_users.created_at"?: "ASC" | "DESC";
	};

	// Filtering parameters
	filter?: {
		"data_users.id"?: string | string[];
		is_email_verified?: boolean;
		is_first_login?: boolean;
		status?: string | string[]; // USER_STATUS values like 'ACTIVE', 'INVITED', etc.
	};

	// Search parameters
	search?: {
		first_name?: string;
		last_name?: string;
		email?: string;
	};

	// Date filtering parameters
	filter_date?: {
		"data_users.created_at"?: string; // Format: 'YYYY-MM-DD,YYYY-MM-DD'
	};

	// Special parameters
	owner_required?: boolean;
}

// Response interface
export type GetCustomerUsersResponse = PaginatedAPIResponse<User>;

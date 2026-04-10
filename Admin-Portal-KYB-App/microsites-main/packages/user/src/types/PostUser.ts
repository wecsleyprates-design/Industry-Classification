// =====================
// POST /users
// =====================

// Request interface
export interface PostUserRequest {
	first_name: string;
	last_name: string;
	email: string; // Must be valid email, no disposable domains
	mobile?: string; // Optional, must be valid phone number if provided
}

// Response interface
export interface PostUserResponse {
	user_id: string; // UUID of the created user
}

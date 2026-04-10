export const STATUS_CODES = {
	FORBIDDEN: 403,
	UNAUTHORIZED: 401,
	OK: 200,
	CREATED: 201,
	BAD_REQUEST: 400,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
	// Add more as needed
} as const;

export type StatusCode = (typeof STATUS_CODES)[keyof typeof STATUS_CODES];

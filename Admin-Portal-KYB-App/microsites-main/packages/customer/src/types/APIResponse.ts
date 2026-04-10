export interface APIResponse<T = unknown> {
	status: string;
	message: string;
	data: T;
}

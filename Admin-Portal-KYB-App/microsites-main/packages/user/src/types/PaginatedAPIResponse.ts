import { type APIResponse } from "./APIResponse";

export type PaginatedAPIResponse<T> = APIResponse<{
	records: T[];
	total_pages: number;
	total_items: number;
}>;

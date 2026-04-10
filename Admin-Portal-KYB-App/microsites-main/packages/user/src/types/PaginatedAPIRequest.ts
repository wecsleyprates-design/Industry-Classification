export interface PaginatedApiRequest {
	page?: number;
	items_per_page?: number;
	pagination?: boolean;
	sort?: Record<string, unknown>;
	search?: Record<string, unknown>;
	filter?: Record<string, unknown>;
	filter_date?: Record<string, unknown>;
	suppress_pagination_error?: boolean;
}

/**
 * Utility functions for parsing query parameters
 * Handles bracket notation (filter[status]) and nested object notation
 *
 * This module converts GetWorkflowsListQuery (raw format with bracket notation)
 * to ParsedQueryParams (normalized format with nested objects)
 */

import type { GetWorkflowsListParams } from "#core/workflow/types";

// ParsedQueryParams is the same as GetWorkflowsListParams but without customerId
export type ParsedQueryParams = Omit<GetWorkflowsListParams, "customerId">;

/**
 * Parses query parameters from Express request query
 * Handles both bracket notation (filter[status]) and nested object notation
 * @param query - Express request query object (GetWorkflowsListQuery format with bracket notation, or nested object format)
 * @returns Parsed query parameters in normalized format
 */
export function parseWorkflowsListQuery(query: Record<string, unknown>): ParsedQueryParams {
	const result: ParsedQueryParams = {};

	// Parse pagination parameters
	if (query.page) {
		result.page = Number(query.page);
	}
	if (query.items_per_page) {
		result.itemsPerPage = Number(query.items_per_page);
	}
	if (query.pagination !== undefined) {
		result.pagination = typeof query.pagination === "boolean" ? query.pagination : query.pagination === "true";
	}

	// Parse filter parameters - handle both bracket notation and nested object
	const filter: ParsedQueryParams["filter"] = {};
	const filterStatus = query["filter[status]"] ?? (query.filter as Record<string, unknown> | undefined)?.status;
	if (filterStatus) {
		filter.status = filterStatus as string | string[];
	}
	const filterCreatedBy =
		query["filter[created_by]"] ?? (query.filter as Record<string, unknown> | undefined)?.created_by;
	if (filterCreatedBy) {
		filter.created_by = filterCreatedBy as string | string[];
	}
	if (Object.keys(filter).length > 0) {
		result.filter = filter;
	}

	// Parse search parameters
	const search: ParsedQueryParams["search"] = {};
	const searchName = query["search[name]"] ?? (query.search as Record<string, unknown> | undefined)?.name;
	if (searchName) {
		search.name = String(searchName);
	}
	const searchDescription =
		query["search[description]"] ?? (query.search as Record<string, unknown> | undefined)?.description;
	if (searchDescription) {
		search.description = String(searchDescription);
	}
	if (Object.keys(search).length > 0) {
		result.search = search;
	}
	return result;
}

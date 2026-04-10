/**
 * Utility functions for building database queries with pagination, filtering, and sorting
 * These utilities can be reused across different repositories
 */

import type { Knex } from "knex";

export interface PaginationParams {
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface PaginationResult {
	page: number;
	itemsPerPage: number;
	usePagination: boolean;
	offset: number;
}

export interface SortField {
	column: string;
	order: "asc" | "desc";
}

/**
 * Normalizes pagination parameters with defaults
 * @param params - Pagination parameters
 * @param defaultPage - Default page number (default: 1)
 * @param defaultItemsPerPage - Default items per page (default: 10)
 * @returns Normalized pagination parameters
 */
export function normalizePagination(
	params: PaginationParams,
	defaultPage: number = 1,
	defaultItemsPerPage: number = 10
): PaginationResult {
	const page = params.page ?? defaultPage;
	const itemsPerPage = params.itemsPerPage ?? defaultItemsPerPage;
	const usePagination = params.pagination !== false;
	const offset = usePagination ? (page - 1) * itemsPerPage : 0;

	return {
		page,
		itemsPerPage,
		usePagination,
		offset
	};
}

/**
 * Applies pagination (limit/offset) to a Knex query
 * @param query - Knex query builder
 * @param pagination - Normalized pagination parameters
 * @returns Query with pagination applied
 */
export function applyPagination<T extends Knex.QueryBuilder>(query: T, pagination: PaginationResult): T {
	if (pagination.usePagination) {
		return query.limit(pagination.itemsPerPage).offset(pagination.offset) as T;
	}
	return query;
}

/**
 * Calculates total pages from total items and items per page
 * @param totalItems - Total number of items
 * @param itemsPerPage - Items per page
 * @param usePagination - Whether pagination is enabled
 * @returns Total number of pages (1 if pagination is disabled)
 */
export function calculateTotalPages(totalItems: number, itemsPerPage: number, usePagination: boolean): number {
	return usePagination ? Math.ceil(totalItems / itemsPerPage) : 1;
}

/**
 * Gets total count from a query (before pagination is applied)
 * @param query - Knex query builder
 * @param countColumn - Column to count (default: "id")
 * @returns Promise with total count
 */
export async function getTotalCount(query: Knex.QueryBuilder, countColumn: string = "id"): Promise<number> {
	const countQuery = query.clone().clearSelect().clearOrder().count(`${countColumn} as count`);
	const countResult = await countQuery.first();
	return Number((countResult as { count: string | number } | undefined)?.count ?? 0);
}

/**
 * Applies sorting to a Knex query
 * @param query - Knex query builder
 * @param sortFields - Array of sort fields with column and order
 * @param defaultSort - Default sort field to apply if no sort fields provided
 * @returns Query with sorting applied
 */
export function applySorting<T extends Knex.QueryBuilder>(
	query: T,
	sortFields: SortField[],
	defaultSort?: SortField
): T {
	if (sortFields.length > 0) {
		sortFields.forEach(field => {
			query = query.orderBy(field.column, field.order) as T;
		});
	} else if (defaultSort) {
		query = query.orderBy(defaultSort.column, defaultSort.order) as T;
	}
	return query;
}

/**
 * Applies whereIn filter to a query (handles single value or array)
 * @param query - Knex query builder
 * @param column - Column name to filter
 * @param values - Single value or array of values
 * @returns Query with filter applied
 */
export function applyWhereInFilter<T extends Knex.QueryBuilder>(
	query: T,
	column: string,
	values: string | string[] | undefined
): T {
	if (values) {
		const valueArray = Array.isArray(values) ? values : [values];
		if (valueArray.length > 0) {
			return query.whereIn(column, valueArray) as T;
		}
	}
	return query;
}

/**
 * Applies case-insensitive search filter to a query
 * Note: Uses PostgreSQL-specific whereILike - not compatible with other databases
 * Note: SQL wildcards (% and _) in searchTerm are treated as wildcards, not literals
 * @param query - Knex query builder
 * @param column - Column name to search in
 * @param searchTerm - Search term (will be wrapped with % wildcards)
 * @returns Modified query builder
 */
export function applySearchFilter<T extends Knex.QueryBuilder>(
	query: T,
	column: string,
	searchTerm: string | undefined
): T {
	if (searchTerm) {
		return query.whereILike(column, `%${searchTerm}%`) as T;
	}
	return query;
}

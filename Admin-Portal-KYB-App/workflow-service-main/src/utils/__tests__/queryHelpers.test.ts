import {
	normalizePagination,
	applyPagination,
	calculateTotalPages,
	getTotalCount,
	applyWhereInFilter,
	applySearchFilter,
	type PaginationParams
} from "../queryHelpers";
import type { Knex } from "knex";

describe("queryHelpers", () => {
	describe("normalizePagination", () => {
		it("should use default values when params are not provided", () => {
			const params: PaginationParams = {};
			const result = normalizePagination(params);

			expect(result).toEqual({
				page: 1,
				itemsPerPage: 10,
				usePagination: true,
				offset: 0
			});
		});

		it("should use custom default values when provided", () => {
			const params: PaginationParams = {};
			const result = normalizePagination(params, 2, 20);

			expect(result).toEqual({
				page: 2,
				itemsPerPage: 20,
				usePagination: true,
				offset: 20
			});
		});

		it("should use provided page and itemsPerPage", () => {
			const params: PaginationParams = {
				page: 3,
				itemsPerPage: 25
			};
			const result = normalizePagination(params);

			expect(result).toEqual({
				page: 3,
				itemsPerPage: 25,
				usePagination: true,
				offset: 50 // (3 - 1) * 25
			});
		});

		it("should set usePagination to false when pagination=false", () => {
			const params: PaginationParams = {
				page: 1,
				itemsPerPage: 10,
				pagination: false
			};
			const result = normalizePagination(params);

			expect(result).toEqual({
				page: 1,
				itemsPerPage: 10,
				usePagination: false,
				offset: 0
			});
		});

		it("should calculate offset correctly", () => {
			const params: PaginationParams = {
				page: 5,
				itemsPerPage: 20
			};
			const result = normalizePagination(params);

			expect(result.offset).toBe(80); // (5 - 1) * 20
		});
	});

	describe("applyPagination", () => {
		it("should apply limit and offset when pagination is enabled", () => {
			const mockQuery = {
				limit: jest.fn().mockReturnThis(),
				offset: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			const pagination = {
				page: 2,
				itemsPerPage: 10,
				usePagination: true,
				offset: 10
			};

			applyPagination(mockQuery, pagination);

			expect(mockQuery.limit).toHaveBeenCalledWith(10);
			expect(mockQuery.offset).toHaveBeenCalledWith(10);
		});

		it("should not apply limit/offset when pagination is disabled", () => {
			const mockQuery = {
				limit: jest.fn().mockReturnThis(),
				offset: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			const pagination = {
				page: 1,
				itemsPerPage: 10,
				usePagination: false,
				offset: 0
			};

			applyPagination(mockQuery, pagination);

			expect(mockQuery.limit).not.toHaveBeenCalled();
			expect(mockQuery.offset).not.toHaveBeenCalled();
		});
	});

	describe("calculateTotalPages", () => {
		it("should calculate total pages correctly", () => {
			expect(calculateTotalPages(25, 10, true)).toBe(3); // Math.ceil(25 / 10)
			expect(calculateTotalPages(20, 10, true)).toBe(2);
			expect(calculateTotalPages(21, 10, true)).toBe(3);
			expect(calculateTotalPages(0, 10, true)).toBe(0);
		});

		it("should return 1 when pagination is disabled", () => {
			expect(calculateTotalPages(25, 10, false)).toBe(1);
			expect(calculateTotalPages(100, 10, false)).toBe(1);
		});
	});

	describe("getTotalCount", () => {
		it("should extract count from query result", async () => {
			const mockQuery = {
				clone: jest.fn().mockReturnThis(),
				clearSelect: jest.fn().mockReturnThis(),
				clearOrder: jest.fn().mockReturnThis(),
				count: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ count: "25" })
			} as unknown as Knex.QueryBuilder;

			const result = await getTotalCount(mockQuery);

			expect(result).toBe(25);
		});

		it("should handle numeric count", async () => {
			const mockQuery = {
				clone: jest.fn().mockReturnThis(),
				clearSelect: jest.fn().mockReturnThis(),
				clearOrder: jest.fn().mockReturnThis(),
				count: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ count: 25 })
			} as unknown as Knex.QueryBuilder;

			const result = await getTotalCount(mockQuery);

			expect(result).toBe(25);
		});

		it("should return 0 when count is undefined", async () => {
			const mockQuery = {
				clone: jest.fn().mockReturnThis(),
				clearSelect: jest.fn().mockReturnThis(),
				clearOrder: jest.fn().mockReturnThis(),
				count: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			} as unknown as Knex.QueryBuilder;

			const result = await getTotalCount(mockQuery);

			expect(result).toBe(0);
		});

		it("should use custom count column", async () => {
			const mockQuery = {
				clone: jest.fn().mockReturnThis(),
				clearSelect: jest.fn().mockReturnThis(),
				clearOrder: jest.fn().mockReturnThis(),
				count: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ count: "42" })
			} as unknown as Knex.QueryBuilder;

			await getTotalCount(mockQuery, "custom_id");

			expect(mockQuery.count).toHaveBeenCalledWith("custom_id as count");
		});
	});

	describe("applyWhereInFilter", () => {
		it("should apply whereIn filter for single value", () => {
			const mockQuery = {
				whereIn: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applyWhereInFilter(mockQuery, "column", "value-1");

			expect(mockQuery.whereIn).toHaveBeenCalledWith("column", ["value-1"]);
		});

		it("should apply whereIn filter for array of values", () => {
			const mockQuery = {
				whereIn: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applyWhereInFilter(mockQuery, "column", ["value-1", "value-2"]);

			expect(mockQuery.whereIn).toHaveBeenCalledWith("column", ["value-1", "value-2"]);
		});

		it("should not apply filter when value is undefined", () => {
			const mockQuery = {
				whereIn: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applyWhereInFilter(mockQuery, "column", undefined);

			expect(mockQuery.whereIn).not.toHaveBeenCalled();
		});

		it("should not apply filter when array is empty", () => {
			const mockQuery = {
				whereIn: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applyWhereInFilter(mockQuery, "column", []);

			expect(mockQuery.whereIn).not.toHaveBeenCalled();
		});
	});

	describe("applySearchFilter", () => {
		it("should apply ILIKE filter with wildcards", () => {
			const mockQuery = {
				whereILike: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applySearchFilter(mockQuery, "column", "search term");

			expect(mockQuery.whereILike).toHaveBeenCalledWith("column", "%search term%");
		});

		it("should not apply filter when search term is undefined", () => {
			const mockQuery = {
				whereILike: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applySearchFilter(mockQuery, "column", undefined);

			expect(mockQuery.whereILike).not.toHaveBeenCalled();
		});

		it("should not apply filter when search term is empty string", () => {
			const mockQuery = {
				whereILike: jest.fn().mockReturnThis()
			} as unknown as Knex.QueryBuilder;

			applySearchFilter(mockQuery, "column", "");

			// Empty string is falsy, so filter should not be applied
			expect(mockQuery.whereILike).not.toHaveBeenCalled();
		});
	});
});

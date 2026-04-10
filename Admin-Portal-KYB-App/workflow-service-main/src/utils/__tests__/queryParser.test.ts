import { parseWorkflowsListQuery } from "../queryParser";

describe("queryParser", () => {
	describe("parseWorkflowsListQuery", () => {
		it("should parse pagination parameters", () => {
			const query = {
				page: "2",
				items_per_page: "20",
				pagination: "true"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				page: 2,
				itemsPerPage: 20,
				pagination: true
			});
		});

		it("should handle pagination=false", () => {
			const query = {
				pagination: "false"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				pagination: false
			});
		});

		it("should parse filter parameters with bracket notation", () => {
			const query = {
				"filter[status]": "active",
				"filter[created_by]": "user-123"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				filter: {
					status: "active",
					created_by: "user-123"
				}
			});
		});

		it("should parse filter parameters with nested object notation", () => {
			const query = {
				filter: {
					status: "active",
					created_by: "user-123"
				}
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				filter: {
					status: "active",
					created_by: "user-123"
				}
			});
		});

		it("should handle array filter values", () => {
			const query = {
				"filter[status]": ["active", "inactive"],
				"filter[created_by]": ["user-1", "user-2"]
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				filter: {
					status: ["active", "inactive"],
					created_by: ["user-1", "user-2"]
				}
			});
		});

		it("should parse search parameters with bracket notation", () => {
			const query = {
				"search[name]": "workflow",
				"search[description]": "test"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				search: {
					name: "workflow",
					description: "test"
				}
			});
		});

		it("should parse search parameters with nested object notation", () => {
			const query = {
				search: {
					name: "workflow",
					description: "test"
				}
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				search: {
					name: "workflow",
					description: "test"
				}
			});
		});

		it("should handle missing parameters gracefully", () => {
			const query = {};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({});
		});

		it("should handle partial parameters", () => {
			const query = {
				page: "1",
				"filter[status]": "active"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				page: 1,
				filter: {
					status: "active"
				}
			});
		});

		it("should prioritize bracket notation over nested object", () => {
			const query = {
				"filter[status]": "active",
				filter: {
					status: "inactive"
				}
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				filter: {
					status: "active" // Bracket notation takes precedence
				}
			});
		});

		it("should handle empty filter object", () => {
			const query = {
				filter: {}
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({});
		});

		it("should handle empty search object", () => {
			const query = {
				search: {}
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({});
		});

		it("should handle numeric string values for pagination", () => {
			const query = {
				page: "3",
				items_per_page: "15"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result).toEqual({
				page: 3,
				itemsPerPage: 15
			});
		});

		it("should handle boolean string for pagination", () => {
			const query = {
				pagination: "false"
			};

			const result = parseWorkflowsListQuery(query);

			expect(result.pagination).toBe(false);
		});

		it("should handle boolean value for pagination", () => {
			const query = {
				pagination: false
			};

			const result = parseWorkflowsListQuery(query);

			expect(result.pagination).toBe(false);
		});
	});
});

/**
 * Unit tests for DSL operators validation
 * Tests all operators using dslConverter and json-logic-js to ensure
 * proper conversion and evaluation
 */

import { convertDSLToJSONLogic } from "#helpers/workflow";
import jsonLogic from "json-logic-js";
import { RulesLogic } from "json-logic-js";
import { initializeJsonLogic } from "#helpers";

// Initialize custom JSON Logic operators before running tests
initializeJsonLogic();

describe("DSL Operators - Full Integration Test", () => {
	/**
	 * Test data structure that mimics case and facts data
	 */
	const testData = {
		case: {
			id: "case-123",
			status: "ACTIVE",
			amount: 1000,
			score: 85,
			name: "John Doe",
			tags: ["premium", "vip"],
			active: true,
			created_date: "2024-01-15"
		},
		facts: {
			credit_score: 750,
			annual_income: 50000,
			age: 30,
			email: "john.doe@example.com",
			categories: ["finance", "technology"],
			is_verified: true,
			registration_date: "2024-01-10"
		},
		custom_fields: {
			product_codes: ["PROD-001", "PROD-002", "PROD-003"],
			document_types: ["passport", "driver_license"],
			risk_levels: ["low", "medium"],
			approval_statuses: [],
			contact_emails: ["user@example.com", "admin@example.com"],
			tags: ["verified", "premium", "active"]
		}
	};

	describe("Equality Operator (=)", () => {
		it("should convert and evaluate = operator correctly for matching values", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "ACTIVE" },
					{ field: "case.amount", operator: "=", value: 1000 },
					{ field: "case.active", operator: "=", value: true }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule).toEqual({
				and: [
					{ "==": [{ var: "case.status" }, "ACTIVE"] },
					{ "==": [{ var: "case.amount" }, 1000] },
					{ "==": [{ var: "case.active" }, true] }
				]
			});
		});

		it("should return false for non-matching values", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "INACTIVE" },
					{ field: "case.amount", operator: "=", value: 2000 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Inequality Operator (!=)", () => {
		it("should convert and evaluate != operator correctly for different values", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "!=", value: "INACTIVE" },
					{ field: "case.amount", operator: "!=", value: 2000 },
					{ field: "case.active", operator: "!=", value: false }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule).toEqual({
				and: [
					{ "!=": [{ var: "case.status" }, "INACTIVE"] },
					{ "!=": [{ var: "case.amount" }, 2000] },
					{ "!=": [{ var: "case.active" }, false] }
				]
			});
		});

		it("should return false when values are equal", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.status", operator: "!=", value: "ACTIVE" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Greater Than Operator (>)", () => {
		it("should convert and evaluate > operator correctly", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: ">", value: 500 },
					{ field: "facts.credit_score", operator: ">", value: 700 },
					{ field: "facts.age", operator: ">", value: 25 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({ ">": [{ var: "case.amount" }, 500] });
		});

		it("should return false when value is not greater", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: ">", value: 2000 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Less Than Operator (<)", () => {
		it("should convert and evaluate < operator correctly", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: "<", value: 2000 },
					{ field: "facts.credit_score", operator: "<", value: 800 },
					{ field: "facts.age", operator: "<", value: 40 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({ "<": [{ var: "case.amount" }, 2000] });
		});

		it("should return false when value is not less", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "<", value: 500 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Greater Than or Equal Operator (>=)", () => {
		it("should convert and evaluate >= operator correctly for greater value", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: ">=", value: 500 },
					{ field: "facts.credit_score", operator: ">=", value: 700 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({ ">=": [{ var: "case.amount" }, 500] });
		});

		it("should convert and evaluate >= operator correctly for equal value", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: ">=", value: 1000 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
		});

		it("should return false when value is less", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: ">=", value: 2000 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Less Than or Equal Operator (<=)", () => {
		it("should convert and evaluate <= operator correctly for less value", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: "<=", value: 2000 },
					{ field: "facts.credit_score", operator: "<=", value: 800 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({ "<=": [{ var: "case.amount" }, 2000] });
		});

		it("should convert and evaluate <= operator correctly for equal value", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "<=", value: 1000 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
		});

		it("should return false when value is greater", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "<=", value: 500 }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("IN Operator", () => {
		it("should convert and evaluate IN operator correctly for array values", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "IN", value: ["ACTIVE", "PENDING", "APPROVED"] },
					{ field: "facts.credit_score", operator: "IN", value: [700, 750, 800] }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				in: [{ var: "case.status" }, ["ACTIVE", "PENDING", "APPROVED"]]
			});
		});

		it("should return false when value is not in array", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.status", operator: "IN", value: ["INACTIVE", "REJECTED"] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should handle IN operator with string array", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.tags", operator: "IN", value: ["premium", "vip", "standard"] }]
			};

			// Note: IN operator in json-logic-js checks if the field value is in the array
			// For array fields, we need to check if any element is in the array
			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			// This test validates the conversion, actual evaluation depends on json-logic-js behavior
			expect(jsonLogicRule.and[0]).toEqual({
				in: [{ var: "case.tags" }, ["premium", "vip", "standard"]]
			});
		});
	});

	describe("NOT_IN Operator", () => {
		it("should convert and evaluate NOT_IN operator correctly", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "NOT_IN", value: ["INACTIVE", "REJECTED"] },
					{ field: "facts.credit_score", operator: "NOT_IN", value: [600, 650, 900] }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				"!": { in: [{ var: "case.status" }, ["INACTIVE", "REJECTED"]] }
			});
		});

		it("should return false when value is in array", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.status", operator: "NOT_IN", value: ["ACTIVE", "PENDING"] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should handle NOT_IN operator with numeric values", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: "NOT_IN", value: [600, 650, 900] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				"!": { in: [{ var: "facts.credit_score" }, [600, 650, 900]] }
			});
		});
	});

	describe("BETWEEN Operator", () => {
		it("should convert and evaluate BETWEEN operator correctly (inclusive)", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: "BETWEEN", value: [500, 2000] },
					{ field: "facts.credit_score", operator: "BETWEEN", value: [700, 800] },
					{ field: "facts.age", operator: "BETWEEN", value: [25, 35] }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				"<=": [500, { var: "case.amount" }, 2000]
			});
		});

		it("should return true when value equals min boundary", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "BETWEEN", value: [1000, 2000] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
		});

		it("should return true when value equals max boundary", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: "BETWEEN", value: [700, 750] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
		});

		it("should return false when value is less than min", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "BETWEEN", value: [1500, 2000] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should return false when value is greater than max", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: "BETWEEN", value: [600, 700] }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should throw error when value is not an array", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "BETWEEN", value: 1000 }]
			};

			expect(() => convertDSLToJSONLogic(dsl)).toThrow(
				"BETWEEN operator requires an array with exactly 2 elements [min, max]"
			);
		});

		it("should throw error when value array has wrong length", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.amount", operator: "BETWEEN", value: [500, 1000, 2000] }]
			};

			expect(() => convertDSLToJSONLogic(dsl)).toThrow(
				"BETWEEN operator requires an array with exactly 2 elements [min, max]"
			);
		});
	});

	describe("CONTAINS Operator", () => {
		it("should convert and evaluate CONTAINS operator correctly for strings", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "facts.email", operator: "CONTAINS", value: "example.com" },
					{ field: "case.name", operator: "CONTAINS", value: "John" }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				contains: [{ var: "facts.email" }, "example.com"]
			});
		});

		it("should return false when string does not contain value", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "facts.email", operator: "CONTAINS", value: "nonexistent.com" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should handle CONTAINS operator with array values", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.tags", operator: "CONTAINS", value: "premium" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				contains: [{ var: "case.tags" }, "premium"]
			});
		});
	});

	describe("NOT_CONTAINS Operator", () => {
		it("should convert and evaluate NOT_CONTAINS operator correctly", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "facts.email", operator: "NOT_CONTAINS", value: "spam.com" },
					{ field: "case.name", operator: "NOT_CONTAINS", value: "Invalid" }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				"!": { contains: [{ var: "facts.email" }, "spam.com"] }
			});
		});

		it("should return false when string contains the value", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "facts.email", operator: "NOT_CONTAINS", value: "example.com" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});

		it("should handle NOT_CONTAINS operator with array values", () => {
			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.tags", operator: "NOT_CONTAINS", value: "banned" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and[0]).toEqual({
				"!": { contains: [{ var: "case.tags" }, "banned"] }
			});
		});
	});

	describe("Complex Scenarios - Multiple Operators Combined", () => {
		it("should handle complex DSL with multiple different operators", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "ACTIVE" },
					{ field: "case.amount", operator: ">=", value: 500 },
					{ field: "facts.credit_score", operator: ">", value: 700 },
					{ field: "facts.credit_score", operator: "IN", value: [700, 750, 800] },
					{ field: "facts.email", operator: "CONTAINS", value: "example" },
					{ field: "case.tags", operator: "CONTAINS", value: "premium" }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and).toHaveLength(6);
		});

		it("should handle nested OR conditions with different operators", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "ACTIVE" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.credit_score", operator: ">=", value: 800 },
							{ field: "facts.annual_income", operator: ">", value: 40000 },
							{ field: "case.amount", operator: "<=", value: 1000 }
						]
					}
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl) as { and: RulesLogic[] };
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
			expect(jsonLogicRule.and).toHaveLength(2);
			expect(jsonLogicRule.and[1]).toHaveProperty("or");
		});

		it("should return false when any condition in AND fails", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "ACTIVE" },
					{ field: "case.amount", operator: ">", value: 2000 }, // This will fail
					{ field: "facts.credit_score", operator: ">=", value: 700 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(false);
		});
	});

	describe("Edge Cases", () => {
		it("should handle null values correctly", () => {
			const testDataWithNull = {
				case: {
					status: null,
					amount: 1000
				}
			};

			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.status", operator: "=", value: null }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testDataWithNull);

			expect(result).toBe(true);
		});

		it("should handle boolean values correctly", () => {
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.active", operator: "=", value: true },
					{ field: "facts.is_verified", operator: "=", value: true }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testData);

			expect(result).toBe(true);
		});

		it("should handle numeric zero values correctly", () => {
			const testDataWithZero = {
				case: {
					amount: 0
				}
			};

			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.amount", operator: "=", value: 0 },
					{ field: "case.amount", operator: ">=", value: 0 }
				]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testDataWithZero);

			expect(result).toBe(true);
		});

		it("should handle empty string values correctly", () => {
			const testDataWithEmpty = {
				case: {
					name: ""
				}
			};

			const dsl = {
				operator: "AND",
				conditions: [{ field: "case.name", operator: "=", value: "" }]
			};

			const jsonLogicRule = convertDSLToJSONLogic(dsl);
			const result = jsonLogic.apply(jsonLogicRule, testDataWithEmpty);

			expect(result).toBe(true);
		});
	});

	describe("Array Operators", () => {
		describe("ANY_EQUALS", () => {
			it("should return true when any element in array equals the value", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ANY_EQUALS", value: "PROD-001" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(true);
			});

			it("should return false when no element in array equals the value", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ANY_EQUALS", value: "PROD-999" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(false);
			});

			it("should return false when array is null or empty", () => {
				const testDataEmpty = {
					...testData,
					custom_fields: { ...testData.custom_fields, product_codes: [] }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ANY_EQUALS", value: "PROD-001" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataEmpty);

				expect(result).toBe(false);
			});
		});

		describe("ANY_CONTAINS", () => {
			it("should return true when any element in array contains the value", () => {
				const testDataWithStrings = {
					...testData,
					custom_fields: { ...testData.custom_fields, contact_emails: ["user@example.com", "admin@example.com"] }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.contact_emails", operator: "ANY_CONTAINS", value: "example.com" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataWithStrings);

				expect(result).toBe(true);
			});

			it("should return false when no element in array contains the value", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.contact_emails", operator: "ANY_CONTAINS", value: "nonexistent.com" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(false);
			});
		});

		describe("ARRAY_INTERSECTS", () => {
			it("should return true when arrays have common elements", () => {
				const dsl = {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.document_types",
							operator: "ARRAY_INTERSECTS",
							value: ["passport", "birth_certificate"]
						}
					]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(true);
			});

			it("should return false when arrays have no common elements", () => {
				const dsl = {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.document_types",
							operator: "ARRAY_INTERSECTS",
							value: ["birth_certificate", "social_security"]
						}
					]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(false);
			});
		});

		describe("ARRAY_LENGTH", () => {
			it("should return true when array length equals the value", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ARRAY_LENGTH", value: 3 }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(true);
			});

			it("should return false when array length does not equal the value", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ARRAY_LENGTH", value: 5 }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(false);
			});
		});

		describe("ARRAY_IS_EMPTY", () => {
			it("should return true when array is empty", () => {
				const testDataEmpty = {
					...testData,
					custom_fields: { ...testData.custom_fields, approval_statuses: [] }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.approval_statuses", operator: "ARRAY_IS_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataEmpty);

				expect(result).toBe(true);
			});

			it("should return false when array has elements", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ARRAY_IS_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(false);
			});

			it("should return true when field is null", () => {
				const testDataNull = {
					...testData,
					custom_fields: { ...testData.custom_fields, product_codes: null }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.product_codes", operator: "ARRAY_IS_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataNull);

				expect(result).toBe(true);
			});
		});

		describe("ARRAY_IS_NOT_EMPTY", () => {
			it("should return true when array has elements", () => {
				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.risk_levels", operator: "ARRAY_IS_NOT_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testData);

				expect(result).toBe(true);
			});

			it("should return false when array is empty", () => {
				const testDataEmpty = {
					...testData,
					custom_fields: { ...testData.custom_fields, approval_statuses: [] }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.approval_statuses", operator: "ARRAY_IS_NOT_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataEmpty);

				expect(result).toBe(false);
			});

			it("should return false when field is null", () => {
				const testDataNull = {
					...testData,
					custom_fields: { ...testData.custom_fields, risk_levels: null }
				};

				const dsl = {
					operator: "AND",
					conditions: [{ field: "custom_fields.risk_levels", operator: "ARRAY_IS_NOT_EMPTY" }]
				};

				const jsonLogicRule = convertDSLToJSONLogic(dsl);
				const result = jsonLogic.apply(jsonLogicRule, testDataNull);

				expect(result).toBe(false);
			});
		});
	});
});

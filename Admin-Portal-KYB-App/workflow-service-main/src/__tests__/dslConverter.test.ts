import { convertDSLToJSONLogic, isValidDSL } from "#helpers/workflow";
import { RulesLogic } from "json-logic-js";

describe("DSL Converter", () => {
	describe("convertDSLToJSONLogic", () => {
		it("should convert simple AND condition to JSON Logic", () => {
			const dslRule = {
				operator: "AND",
				conditions: [
					{
						field: "facts.mcc_code",
						operator: "=",
						value: true
					},
					{
						field: "facts.naics_code",
						operator: "=",
						value: null
					},
					{
						field: "case.case_type",
						operator: "=",
						value: 1
					}
				]
			};

			const result = convertDSLToJSONLogic(dslRule);

			expect(result).toEqual({
				and: [
					{ "==": [{ var: "facts.mcc_code" }, true] },
					{ "==": [{ var: "facts.naics_code" }, null] },
					{ "==": [{ var: "case.case_type" }, 1] }
				]
			});
		});

		it("should convert complex nested condition to JSON Logic", () => {
			const dslRule = {
				operator: "AND",
				conditions: [
					{
						field: "application.mcc",
						operator: "IN",
						value: ["5967", "5812"]
					},
					{
						field: "financials.judgments_total",
						operator: ">",
						value: 50000
					},
					{
						operator: "OR",
						conditions: [
							{
								field: "financials.judgments",
								operator: ">",
								value: 50000
							},
							{
								field: "adverse_media.bankruptcies",
								operator: "=",
								value: true
							}
						]
					}
				]
			};

			const result = convertDSLToJSONLogic(dslRule);

			expect(result).toEqual({
				and: [
					{ in: [{ var: "application.mcc" }, ["5967", "5812"]] },
					{ ">": [{ var: "financials.judgments_total" }, 50000] },
					{
						or: [
							{ ">": [{ var: "financials.judgments" }, 50000] },
							{ "==": [{ var: "adverse_media.bankruptcies" }, true] }
						]
					}
				]
			});
		});

		it("should handle different comparison operators", () => {
			const dslRule = {
				operator: "AND",
				conditions: [
					{ field: "field1", operator: "!=", value: "test" },
					{ field: "field2", operator: ">=", value: 10 },
					{ field: "field3", operator: "<=", value: 100 },
					{ field: "field4", operator: "CONTAINS", value: "substring" },
					{ field: "field5", operator: "NOT_CONTAINS", value: "excluded" }
				]
			};

			const result = convertDSLToJSONLogic(dslRule) as { and: RulesLogic[] };

			expect(result.and).toHaveLength(5);
			expect(result.and[0]).toEqual({ "!=": [{ var: "field1" }, "test"] });
			expect(result.and[1]).toEqual({ ">=": [{ var: "field2" }, 10] });
			expect(result.and[2]).toEqual({ "<=": [{ var: "field3" }, 100] });
			expect(result.and[3]).toEqual({ contains: [{ var: "field4" }, "substring"] });
			expect(result.and[4]).toEqual({ "!": { contains: [{ var: "field5" }, "excluded"] } });
		});

		it("should throw error for invalid root operator", () => {
			const dslRule = {
				operator: "OR",
				conditions: []
			};

			expect(() => convertDSLToJSONLogic(dslRule)).toThrow("Root operator must be AND");
		});

		it("should throw error for invalid DSL structure", () => {
			expect(() => convertDSLToJSONLogic(null)).toThrow("Invalid DSL structure");
			expect(() => convertDSLToJSONLogic({})).toThrow("Invalid DSL structure");
			expect(() => convertDSLToJSONLogic({ operator: "AND" })).toThrow("Invalid DSL structure");
		});

		it("should throw error for unsupported operator", () => {
			const dslRule = {
				operator: "AND",
				conditions: [
					{
						field: "test.field",
						operator: "UNSUPPORTED_OPERATOR",
						value: "test"
					}
				]
			};

			expect(() => convertDSLToJSONLogic(dslRule)).toThrow("Unsupported operator: UNSUPPORTED_OPERATOR");
		});

		it("should convert REGEX_MATCH condition to regex_match JSON Logic expression", () => {
			const dslRule = {
				operator: "AND",
				conditions: [{ field: "facts.code", operator: "REGEX_MATCH", value: "^[A-Z]{2}-\\d+$" }]
			};

			const result = convertDSLToJSONLogic(dslRule) as { and: RulesLogic[] };

			expect(result.and).toHaveLength(1);
			expect(result.and[0]).toEqual({
				regex_match: [{ var: "facts.code" }, "^[A-Z]{2}-\\d+$"]
			});
		});

		it("should throw when REGEX_MATCH has non-string value", () => {
			const dslRule = {
				operator: "AND",
				conditions: [{ field: "facts.code", operator: "REGEX_MATCH", value: 123 }]
			};

			expect(() => convertDSLToJSONLogic(dslRule)).toThrow("REGEX_MATCH operator requires a string value");
		});
	});

	describe("isValidDSL", () => {
		it("should validate correct DSL structure", () => {
			const validDSL = {
				operator: "AND",
				conditions: [
					{
						field: "test.field",
						operator: "=",
						value: "test"
					}
				]
			};

			expect(isValidDSL(validDSL)).toBe(true);
		});

		it("should validate complex nested DSL structure", () => {
			const validDSL = {
				operator: "AND",
				conditions: [
					{
						field: "application.mcc",
						operator: "IN",
						value: ["5967", "5812"]
					},
					{
						operator: "OR",
						conditions: [
							{
								field: "financials.judgments",
								operator: ">",
								value: 50000
							},
							{
								field: "adverse_media.bankruptcies",
								operator: "=",
								value: true
							}
						]
					}
				]
			};

			expect(isValidDSL(validDSL)).toBe(true);
		});

		it("should reject invalid DSL structures", () => {
			expect(isValidDSL(null)).toBe(false);
			expect(isValidDSL(undefined)).toBe(false);
			expect(isValidDSL({})).toBe(false);
			expect(isValidDSL({ operator: "OR" })).toBe(false);
			expect(isValidDSL({ operator: "AND" })).toBe(false);
			expect(isValidDSL({ operator: "AND", conditions: [] })).toBe(false);
			expect(isValidDSL({ operator: "AND", conditions: [{}] })).toBe(false);
		});
	});
});

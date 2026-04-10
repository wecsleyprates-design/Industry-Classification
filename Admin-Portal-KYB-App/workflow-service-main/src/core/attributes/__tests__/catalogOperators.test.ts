import { buildCatalogOperatorsForDataType, normalizeCatalogOperatorTypeParam } from "../catalogOperators";
import { Workflows } from "@joinworth/types";

const { VARIATION_OPERATOR } = Workflows.Conditions;
const FILTER = Workflows.Attributes.ATTRIBUTE_CATALOG_OPERATORS_FILTER;

describe("catalogOperators", () => {
	describe("normalizeCatalogOperatorTypeParam", () => {
		it("returns all for unknown values", () => {
			expect(normalizeCatalogOperatorTypeParam(undefined)).toBe(FILTER.ALL);
			expect(normalizeCatalogOperatorTypeParam("")).toBe(FILTER.ALL);
			expect(normalizeCatalogOperatorTypeParam("foo")).toBe(FILTER.ALL);
		});

		it("returns valid literals", () => {
			expect(normalizeCatalogOperatorTypeParam(FILTER.COMPARISON)).toBe(FILTER.COMPARISON);
			expect(normalizeCatalogOperatorTypeParam(FILTER.VARIATION)).toBe(FILTER.VARIATION);
			expect(normalizeCatalogOperatorTypeParam(FILTER.ALL)).toBe(FILTER.ALL);
		});
	});

	describe("buildCatalogOperatorsForDataType", () => {
		it("includes numeric variation operators only for number when variation", () => {
			const ops = buildCatalogOperatorsForDataType("number", FILTER.VARIATION);
			expect(ops).toContain(VARIATION_OPERATOR.INCREASED_BY);
			expect(ops).toContain(VARIATION_OPERATOR.CROSSED_ABOVE);
			expect(ops).not.toContain("=");
		});

		it("includes boolean-only variation operators for boolean when variation", () => {
			const ops = buildCatalogOperatorsForDataType("boolean", FILTER.VARIATION);
			expect(ops).toEqual([
				VARIATION_OPERATOR.BECAME_TRUE,
				VARIATION_OPERATOR.BECAME_FALSE,
				VARIATION_OPERATOR.CHANGED_FROM_NULL,
				VARIATION_OPERATOR.CHANGED_TO_NULL,
				VARIATION_OPERATOR.CHANGED,
				VARIATION_OPERATOR.UNCHANGED
			]);
		});

		it("merges comparison and variation for all", () => {
			const ops = buildCatalogOperatorsForDataType("string", FILTER.ALL);
			expect(ops).toContain("=");
			expect(ops).toContain(VARIATION_OPERATOR.CHANGED);
		});
	});
});

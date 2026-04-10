// Mock all dependencies to avoid circular imports
jest.mock("#services/case");
jest.mock("#workers/workflowWorker");
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

// Import the centralized service
import { FactsManager } from "#core/facts";

describe("DSL Fact Extraction", () => {
	describe("extractFactsFromDSL", () => {
		it("should extract facts from simple DSL conditions", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "facts.mcc_code", operator: "=", value: true },
					{ field: "facts.naics_code", operator: "=", value: null },
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" }
				]
			};

			// Use the centralized service
			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["mcc_code", "naics_code"]);
		});

		it("should extract facts from nested OR conditions", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.financials.judgments", operator: ">", value: 50000 },
							{ field: "facts.adverse_media.bankruptcies", operator: "=", value: true }
						]
					}
				]
			};

			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["financials", "adverse_media"]);
		});

		it("should handle complex nested DSL structures", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "facts.application.mcc", operator: "IN", value: ["5967", "5812"] },
					{ field: "facts.financials.judgments_total", operator: ">", value: 50000 },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.financials.judgments", operator: ">", value: 50000 },
							{ field: "facts.adverse_media.bankruptcies", operator: "=", value: true },
							{ field: "case.status.id", operator: "=", value: "APPROVED" }
						]
					}
				]
			};

			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["application", "financials", "adverse_media"]);
		});

		it("should ignore non-facts fields", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{ field: "case.status.id", operator: "=", value: "SUBMITTED" },
					{ field: "case.customer_id", operator: "=", value: "customer-123" },
					{ field: "application.id", operator: "=", value: "app-456" }
				]
			};

			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual([]);
		});

		it("should handle empty DSL structures", () => {
			const factsSet = new Set<string>();

			FactsManager.extractFactsFromDSL(null, factsSet);
			FactsManager.extractFactsFromDSL(undefined, factsSet);
			FactsManager.extractFactsFromDSL({}, factsSet);

			expect(Array.from(factsSet)).toEqual([]);
		});

		it("should handle invalid DSL structures gracefully", () => {
			const factsSet = new Set<string>();
			const invalidDsl = {
				operator: "AND",
				conditions: [
					{ field: "facts.valid_field", operator: "=", value: true },
					{ invalid: "structure" },
					{ field: "facts.another_valid_field", operator: "=", value: false }
				]
			};

			FactsManager.extractFactsFromDSL(invalidDsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["valid_field", "another_valid_field"]);
		});
	});
});

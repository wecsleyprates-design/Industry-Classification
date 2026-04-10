import { type FactsBusinessKybResponse } from "@/types/integrations";
import { getKybMiddeskNamesSubmitted } from "../getKybMiddeskNamesSubmitted";

describe("getKybMiddeskNamesSubmitted", () => {
	const createNamesSubmittedFact = (
		overrides: Partial<FactsBusinessKybResponse["names_submitted"]> = {},
	): FactsBusinessKybResponse["names_submitted"] => ({
		name: "names_submitted",
		value: [
			{ name: "Test Business LLC", submitted: true },
			{ name: "Test Corp", submitted: false },
		],
		dependencies: ["kyb_submitted"],
		confidence: 100,
		category: "business",
		...overrides,
	});

	describe("basic functionality", () => {
		it("should return names when source.platformId is 16", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 16,
				value: [
					{ name: "Middesk Business LLC", submitted: true },
					{ name: "Another Corp", submitted: false },
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Middesk Business LLC");
			expect(result[1].name).toBe("Another Corp");
		});

		it("should return names from alternatives when source is middesk", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 5,
				value: [{ name: "Wrong Source Business", submitted: true }],
				alternatives: [
					{
						value: [
							{ name: "Alternative Business 1", submitted: true },
							{
								name: "Alternative Business 2",
								submitted: false,
							},
						],
						source: "16", // String representation of Middesk platform ID
					},
					{
						value: [
							{ name: "Other Source Business", submitted: true },
						],
						source: "12",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Alternative Business 1");
			expect(result[1].name).toBe("Alternative Business 2");
		});

		it("should return names from alternatives when source is numeric middesk", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 5,
				value: [{ name: "Wrong Source Business", submitted: true }],
				alternatives: [
					{
						value: [
							{
								name: "Numeric Source Business",
								submitted: true,
							},
						],
						source: 16, // Numeric representation
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Numeric Source Business");
		});
	});

	describe("edge cases", () => {
		it("should return empty array when input is undefined", () => {
			/** Act */
			const result = getKybMiddeskNamesSubmitted(undefined);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should return empty array when input is null", () => {
			/** Act */
			const result = getKybMiddeskNamesSubmitted(null as any);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should fall back to primary value when no alternatives exist", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 5,
				value: [{ name: "Non-Middesk Business", submitted: true }],
				alternatives: undefined,
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Non-Middesk Business");
		});

		it("should fall back to primary value when alternatives is empty array", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 5,
				value: [{ name: "Non-Middesk Business", submitted: true }],
				alternatives: [],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Non-Middesk Business");
		});
	});

	describe("priority handling", () => {
		it("should prefer main value over alternatives when platform ID is 16", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 16,
				value: [{ name: "Main Value Business", submitted: true }],
				alternatives: [
					{
						value: [
							{ name: "Alternative Business", submitted: true },
						],
						source: "16",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Main Value Business");
		});

		it("should find first matching alternative when multiple exist", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 5,
				value: [{ name: "Wrong Source Business", submitted: true }],
				alternatives: [
					{
						value: [
							{ name: "Other Source Business", submitted: true },
						],
						source: "12",
					},
					{
						value: [
							{ name: "First Middesk Business", submitted: true },
						],
						source: "16",
					},
					{
						value: [
							{
								name: "Second Middesk Business",
								submitted: true,
							},
						],
						source: "16",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("First Middesk Business");
		});
	});

	describe("data structure validation", () => {
		it("should handle empty names array", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 16,
				value: [],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should preserve all properties of names", () => {
			/** Arrange */
			const expectedNames = [
				{ name: "Test Business LLC", submitted: true },
				{ name: "Test Corp", submitted: false },
			];
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 16,
				value: expectedNames,
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toEqual(expectedNames);
		});

		it("should handle names with complex structures", () => {
			/** Arrange */
			const complexNames = [
				{
					name: "Complex Business & Associates, LLC",
					submitted: true,
				},
				{
					name: "Company (Holdings) Ltd.",
					submitted: false,
				},
			];
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 16,
				value: complexNames,
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toEqual(complexNames);
		});
	});

	describe("non-Middesk platform fallback (e.g. Trulioo)", () => {
		it("should return primary value for Trulioo-only data (platformId 38)", () => {
			/** Arrange */
			const truliooNames = [
				{ name: "Trulioo Verified Business LLC", submitted: true },
			];
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 38,
				value: truliooNames,
				alternatives: [
					{
						value: truliooNames,
						source: 38,
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Trulioo Verified Business LLC");
		});

		it("should still prefer Middesk alternative even when primary is Trulioo", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 38,
				value: [{ name: "Trulioo Business", submitted: true }],
				alternatives: [
					{
						value: [
							{
								name: "Middesk Business",
								submitted: true,
							},
						],
						source: 16,
					},
				],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Middesk Business");
		});

		it("should return empty array when primary value is null for non-Middesk platform", () => {
			/** Arrange */
			const namesSubmittedFact = createNamesSubmittedFact({
				"source.platformId": 38,
				value: null as any,
				alternatives: [],
			});

			/** Act */
			const result = getKybMiddeskNamesSubmitted(namesSubmittedFact);

			/** Assert */
			expect(result).toEqual([]);
		});
	});
});

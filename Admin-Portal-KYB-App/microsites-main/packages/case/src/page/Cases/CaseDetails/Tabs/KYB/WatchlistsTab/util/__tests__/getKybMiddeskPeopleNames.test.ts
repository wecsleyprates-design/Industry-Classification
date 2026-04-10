import { type FactsBusinessKybResponse } from "@/types/integrations";
import { getKybMiddeskPeopleNames } from "../getKybMiddeskPeopleNames";

describe("getKybMiddeskPeopleNames", () => {
	const createPeopleFact = (
		overrides: Partial<FactsBusinessKybResponse["people"]> = {},
	): FactsBusinessKybResponse["people"] => ({
		name: "people",
		value: [
			{
				name: "John Doe",
				titles: ["CEO", "President"],
				submitted: true,
				source: ["registration"],
				jurisdictions: ["DE"],
			},
			{
				name: "Jane Smith",
				titles: ["CFO"],
				submitted: false,
				source: ["filing"],
				jurisdictions: ["CA"],
			},
		],
		dependencies: ["kyb_submitted"],
		confidence: 95,
		category: "people",
		...overrides,
	});

	describe("basic functionality", () => {
		it("should return people when source.platformId is 16", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: [
					{
						name: "Middesk Person",
						titles: ["Director"],
						submitted: true,
						source: ["middesk"],
						jurisdictions: ["NY"],
					},
					{
						name: "Another Person",
						titles: ["Manager"],
						submitted: false,
						source: ["middesk"],
						jurisdictions: ["TX"],
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Middesk Person");
			expect(result[1].name).toBe("Another Person");
		});

		it("should return people from alternatives when source is middesk", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 5,
				value: [
					{
						name: "Wrong Source Person",
						titles: ["CEO"],
						submitted: true,
						source: ["other"],
						jurisdictions: ["FL"],
					},
				],
				alternatives: [
					{
						value: [
							{
								name: "Alternative Person 1",
								titles: ["CTO"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["CA"],
							},
							{
								name: "Alternative Person 2",
								titles: ["COO"],
								submitted: false,
								source: ["middesk"],
								jurisdictions: ["NY"],
							},
						],
						source: "16", // String representation of Middesk platform ID
					},
					{
						value: [
							{
								name: "Other Source Person",
								titles: ["Manager"],
								submitted: true,
								source: ["other"],
								jurisdictions: ["TX"],
							},
						],
						source: "12",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Alternative Person 1");
			expect(result[1].name).toBe("Alternative Person 2");
		});

		it("should return people from alternatives when source is numeric middesk", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 5,
				value: [
					{
						name: "Wrong Source Person",
						titles: ["CEO"],
						submitted: true,
						source: ["other"],
						jurisdictions: ["FL"],
					},
				],
				alternatives: [
					{
						value: [
							{
								name: "Numeric Source Person",
								titles: ["Director"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["WA"],
							},
						],
						source: 16, // Numeric representation
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Numeric Source Person");
		});
	});

	describe("edge cases", () => {
		it("should return empty array when input is undefined", () => {
			/** Act */
			const result = getKybMiddeskPeopleNames(undefined);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should return empty array when input is null", () => {
			/** Act */
			const result = getKybMiddeskPeopleNames(null as any);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should fall back to primary value when no alternatives exist", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 5,
				value: [
					{
						name: "Non-Middesk Person",
						titles: ["CEO"],
						submitted: true,
						source: ["other"],
						jurisdictions: ["FL"],
					},
				],
				alternatives: undefined,
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Non-Middesk Person");
		});

		it("should fall back to primary value when alternatives is empty array", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 5,
				value: [
					{
						name: "Non-Middesk Person",
						titles: ["CEO"],
						submitted: true,
						source: ["other"],
						jurisdictions: ["FL"],
					},
				],
				alternatives: [],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Non-Middesk Person");
		});
	});

	describe("priority handling", () => {
		it("should prefer main value over alternatives when platform ID is 16", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: [
					{
						name: "Main Value Person",
						titles: ["CEO"],
						submitted: true,
						source: ["middesk"],
						jurisdictions: ["CA"],
					},
				],
				alternatives: [
					{
						value: [
							{
								name: "Alternative Person",
								titles: ["Manager"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["NY"],
							},
						],
						source: "16",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Main Value Person");
		});

		it("should find first matching alternative when multiple exist", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 5,
				value: [
					{
						name: "Wrong Source Person",
						titles: ["CEO"],
						submitted: true,
						source: ["other"],
						jurisdictions: ["FL"],
					},
				],
				alternatives: [
					{
						value: [
							{
								name: "Other Source Person",
								titles: ["Manager"],
								submitted: true,
								source: ["other"],
								jurisdictions: ["TX"],
							},
						],
						source: "12",
					},
					{
						value: [
							{
								name: "First Middesk Person",
								titles: ["Director"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["CA"],
							},
						],
						source: "16",
					},
					{
						value: [
							{
								name: "Second Middesk Person",
								titles: ["VP"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["NY"],
							},
						],
						source: "16",
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("First Middesk Person");
		});
	});

	describe("data structure validation", () => {
		it("should handle empty people array", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: [],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toEqual([]);
		});

		it("should preserve all properties of people", () => {
			/** Arrange */
			const expectedPeople = [
				{
					name: "John Doe",
					titles: ["CEO", "President"],
					submitted: true,
					source: ["registration"],
					jurisdictions: ["DE"],
				},
				{
					name: "Jane Smith",
					titles: ["CFO"],
					submitted: false,
					source: ["filing"],
					jurisdictions: ["CA"],
				},
			];
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: expectedPeople,
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toEqual(expectedPeople);
		});

		it("should handle people with complex structures", () => {
			/** Arrange */
			const complexPeople = [
				{
					name: "Dr. John Smith III",
					titles: [
						"Chief Executive Officer",
						"Chairman of the Board",
					],
					submitted: true,
					source: ["registration", "filing"],
					jurisdictions: ["DE", "NY"],
				},
				{
					name: "María José González-López",
					titles: ["Chief Financial Officer"],
					submitted: false,
					source: ["middesk"],
					jurisdictions: ["CA"],
				},
			];
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: complexPeople,
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toEqual(complexPeople);
		});

		it("should handle people with minimal properties", () => {
			/** Arrange */
			const minimalPeople = [
				{
					name: "Minimal Person",
					titles: [],
				},
			];
			const peopleFact = createPeopleFact({
				"source.platformId": 16,
				value: minimalPeople,
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toEqual(minimalPeople);
		});
	});

	describe("non-Middesk platform fallback (e.g. Trulioo)", () => {
		it("should return primary value for Trulioo-only data (platformId 38)", () => {
			/** Arrange */
			const truliooPersons = [
				{
					name: "JOHN,M,SANCHES",
					titles: ["Owner/Controller"],
				},
				{
					name: "JOHN,M,SANCHEZ",
					titles: ["Owner/Controller"],
				},
			];
			const peopleFact = createPeopleFact({
				"source.platformId": 38,
				value: truliooPersons,
				alternatives: [
					{
						value: truliooPersons,
						source: 38,
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("JOHN,M,SANCHES");
			expect(result[1].name).toBe("JOHN,M,SANCHEZ");
		});

		it("should still prefer Middesk alternative even when primary is Trulioo", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 38,
				value: [
					{
						name: "Trulioo Person",
						titles: ["Director"],
					},
				],
				alternatives: [
					{
						value: [
							{
								name: "Middesk Person",
								titles: ["CEO"],
								submitted: true,
								source: ["middesk"],
								jurisdictions: ["NY"],
							},
						],
						source: 16,
					},
				],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Middesk Person");
		});

		it("should return empty array when primary value is null for non-Middesk platform", () => {
			/** Arrange */
			const peopleFact = createPeopleFact({
				"source.platformId": 38,
				value: null as any,
				alternatives: [],
			});

			/** Act */
			const result = getKybMiddeskPeopleNames(peopleFact);

			/** Assert */
			expect(result).toEqual([]);
		});
	});
});

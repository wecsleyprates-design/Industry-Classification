import type { FactEngine } from "../factEngine";
import { truliooFacts } from "../truliooFacts";
import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";

function findFact(name: string) {
	const fact = truliooFacts.find(f => f.name === name);
	if (!fact?.fn) throw new Error(`Fact '${name}' not found`);
	return fact;
}

function createMockEngine(resolved: Record<string, { value: unknown }>): FactEngine {
	return {
		getResolvedFact: (name: string) => resolved[name]
	} as unknown as FactEngine;
}

describe("truliooFacts architecture", () => {
	describe("removed facts do not exist", () => {
		it("should NOT have watchlist_hits as a trulioo source fact", () => {
			const watchlistHitsFact = truliooFacts.find(f => f.name === "watchlist_hits");
			expect(watchlistHitsFact).toBeUndefined();
		});

		it("should NOT have total_watchlist_hits fact", () => {
			const totalFact = truliooFacts.find(f => (f.name as string) === "total_watchlist_hits");
			expect(totalFact).toBeUndefined();
		});
	});

	describe("remaining facts", () => {
		it("should still have screened_people fact", () => {
			const fact = truliooFacts.find(f => f.name === "screened_people");
			expect(fact).toBeDefined();
			expect(fact?.source?.name).toBe("person");
		});

		it("should still have pep_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "pep_hits");
			expect(fact).toBeDefined();
		});

		it("should still have sanctions_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "sanctions_hits");
			expect(fact).toBeDefined();
		});

		it("should still have adverse_media_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "adverse_media_hits");
			expect(fact).toBeDefined();
		});

		it("should still have high_risk_people fact", () => {
			const fact = truliooFacts.find(f => f.name === "high_risk_people");
			expect(fact).toBeDefined();
			expect(fact?.dependencies).toContain("screened_people");
		});

		it("should still have risk_score fact", () => {
			const fact = truliooFacts.find(f => f.name === "risk_score");
			expect(fact).toBeDefined();
			expect(fact?.dependencies).toContain("watchlist_hits");
			expect(fact?.dependencies).toContain("high_risk_people");
		});

		it("risk_score should NOT depend on total_watchlist_hits", () => {
			const fact = truliooFacts.find(f => f.name === "risk_score");
			expect(fact?.dependencies).not.toContain("total_watchlist_hits");
		});

		it("should still have compliance_status fact", () => {
			const fact = truliooFacts.find(f => f.name === "compliance_status");
			expect(fact).toBeDefined();
		});
	});

	describe("screened_people adverse media filtering", () => {
		const screenedPeopleFact = findFact("screened_people");

		it("should strip ADVERSE_MEDIA hits from watchlistHits", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "Leslie Knope",
						screeningResults: {
							watchlistHits: [
								{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 1 },
								{ listType: "PEP", listName: "PEP List", confidence: 0.9 }
							]
						}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect(result).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits![0].listType).toBe("PEP");
		});

		it("should strip ADVERSE_MEDIA from top-level watchlistResults (legacy field)", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "Donald Trump",
						watchlistResults: [
							{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 1, url: "https://example.com/am1" },
							{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 1, url: "https://example.com/am2" },
							{ listType: "PEP", listName: "PEP List", confidence: 1, url: "https://cbsnews.com/pep" }
						],
						screeningResults: {
							watchlistHits: [
								{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 1 },
								{ listType: "PEP", listName: "PEP List", confidence: 1 }
							]
						}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect(result).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits![0].listType).toBe("PEP");
			const legacy = (result[0] as any).watchlistResults;
			expect(legacy).toHaveLength(1);
			expect(legacy[0].listType).toBe("PEP");
		});

		it("should leave watchlistResults untouched when it is not an array", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "No Legacy",
						screeningResults: {
							watchlistHits: [
								{ listType: "PEP", listName: "PEP List", confidence: 0.9 }
							]
						}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect((result[0] as any).watchlistResults).toBeUndefined();
		});

		it("should preserve PEP and SANCTIONS hits", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "Test Person",
						screeningResults: {
							watchlistHits: [
								{ listType: "PEP", listName: "PEP List", confidence: 0.9 },
								{ listType: "SANCTIONS", listName: "OFAC SDN", confidence: 1 },
								{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 0.8 }
							]
						}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect(result[0].screeningResults.watchlistHits).toHaveLength(2);
			const types = result[0].screeningResults.watchlistHits!.map((h: any) => h.listType);
			expect(types).toContain("PEP");
			expect(types).toContain("SANCTIONS");
			expect(types).not.toContain("ADVERSE_MEDIA");
		});

		it("should return person with empty watchlistHits when only ADVERSE_MEDIA hits exist", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "AM Only Person",
						screeningResults: {
							watchlistHits: [
								{ listType: "ADVERSE_MEDIA", listName: "Adverse Media", confidence: 1 }
							]
						}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect(result).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits).toHaveLength(0);
		});

		it("should handle missing watchlistHits gracefully", async () => {
			const mockResponse = {
				screenedPersons: [
					{
						fullName: "No Hits",
						screeningResults: {}
					}
				]
			};
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, mockResponse);
			expect(result).toHaveLength(1);
			expect(result[0].screeningResults.watchlistHits).toEqual([]);
		});

		it("should return empty array when no screened persons", async () => {
			const engine = createMockEngine({});
			const result = await screenedPeopleFact.fn.call(screenedPeopleFact, engine, undefined);
			expect(result).toEqual([]);
		});
	});

	describe("high_risk_people", () => {
		const highRiskPeopleFact = findFact("high_risk_people");

		it("should return empty array when no screened people", async () => {
			const engine = createMockEngine({ screened_people: { value: [] } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toEqual([]);
		});

		it("should return empty array when screened_people value is not an array", async () => {
			const engine = createMockEngine({ screened_people: { value: null } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toEqual([]);
		});

		it("should filter only people with watchlist hits", async () => {
			const people = [
				{
					fullName: "Has Hits",
					screeningResults: { watchlistHits: [{ listType: "PEP" }] }
				},
				{
					fullName: "No Hits",
					screeningResults: { watchlistHits: [] }
				},
				{
					fullName: "No Results",
					screeningResults: undefined
				}
			] as unknown as TruliooScreenedPersonData[];
			const engine = createMockEngine({ screened_people: { value: people } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toHaveLength(1);
			expect(result[0].fullName).toBe("Has Hits");
		});

		it("should exclude people with only ADVERSE_MEDIA hits (already stripped by screened_people)", async () => {
			const people = [
				{
					fullName: "PEP Person",
					screeningResults: { watchlistHits: [{ listType: "PEP" }] }
				},
				{
					fullName: "AM-Only Person (stripped)",
					screeningResults: { watchlistHits: [] }
				}
			] as unknown as TruliooScreenedPersonData[];
			const engine = createMockEngine({ screened_people: { value: people } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toHaveLength(1);
			expect(result[0].fullName).toBe("PEP Person");
		});
	});

	describe("compliance_status", () => {
		const complianceFact = findFact("compliance_status");

		it("should return 'pending' when business not verified", async () => {
			const engine = createMockEngine({
				business_verified: { value: false },
				risk_score: { value: 0 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("pending");
		});

		it("should return 'high_risk' when risk_score >= 80", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 80 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("high_risk");
		});

		it("should return 'medium_risk' when 50 <= risk_score < 80", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 50 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("medium_risk");
		});

		it("should return 'low_risk' when risk_score < 50", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 30 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("low_risk");
		});
	});
});

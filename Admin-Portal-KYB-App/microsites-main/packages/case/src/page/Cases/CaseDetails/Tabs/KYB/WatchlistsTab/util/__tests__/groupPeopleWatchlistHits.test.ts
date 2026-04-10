import {
	type WatchlistPerson,
	type WatchlistPersonResult,
} from "@/types/businessEntityVerification";
import { type PeopleObjectValue } from "@/types/integrations";
import { groupPeopleWatchlistHits } from "../groupPeopleWatchlistHits";

describe("groupPeopleWatchlistHits", () => {
	const createPeopleObjectValue = (
		overrides: Partial<PeopleObjectValue> = {},
	): PeopleObjectValue => ({
		name: "John Doe",
		titles: ["Director"],
		submitted: true,
		source: ["registration"],
		jurisdictions: ["DE"],
		...overrides,
	});

	const createWatchlistPersonResult = (
		overrides: Partial<WatchlistPersonResult> = {},
	): WatchlistPersonResult => ({
		id: "test-result-id",
		url: "https://example.com",
		type: "watchlist_result",
		list_country: "United States of America",
		metadata: {
			abbr: "SDN",
			title: "Specially Designated Nationals",
			agency: "Office of Foreign Assets Control",
			agency_abbr: "OFAC",
			entity_name: "watchlist hit",
		},
		score: 95,
		object: "watchlist_result",
		list_url: "https://sanctionssearch.ofac.treas.gov",
		addresses: [{ full_address: "123 Main St, Anytown, USA" }],
		listed_at: "2023-01-01T00:00:00Z",
		categories: ["sanctions"],
		entity_name: "John Doe",
		list_region: "North America",
		entity_aliases: ["J. Doe"],
		agency_list_url: "https://ofac.treasury.gov",
		agency_information_url: "https://ofac.treasury.gov/info",
		...overrides,
	});

	const createWatchlistPerson = (
		overrides: Partial<WatchlistPerson> = {},
	): WatchlistPerson => ({
		id: "test-person-id",
		name: "John Doe",
		titles: ["Director"],
		watchlist_results: [createWatchlistPersonResult()],
		...overrides,
	});

	describe("basic functionality", () => {
		it("should group watchlist hits by person name", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: "Jane Smith" }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
				createWatchlistPerson({
					name: "Jane Smith",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-3" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(2);
			expect(result["JANE SMITH"]).toHaveLength(1);
			expect(result["JOHN DOE"][0].id).toBe("result-1");
			expect(result["JOHN DOE"][1].id).toBe("result-2");
			expect(result["JANE SMITH"][0].id).toBe("result-3");
		});

		it("should initialize empty arrays for people with no hits", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: "Jane Smith" }),
				createPeopleObjectValue({ name: "Bob Wilson" }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [createWatchlistPersonResult()],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["JANE SMITH"]).toHaveLength(0);
			expect(result["BOB WILSON"]).toHaveLength(0);
		});
	});

	describe("case insensitive matching", () => {
		it("should match names regardless of case", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "john doe" })];

			const hits = [
				createWatchlistPerson({
					name: "JOHN DOE",
					watchlist_results: [createWatchlistPersonResult()],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
		});

		it("should handle mixed case scenarios", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "JoHn DoE" }),
				createPeopleObjectValue({ name: "jane SMITH" }),
			];

			const hits = [
				createWatchlistPerson({
					name: "john doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
				createWatchlistPerson({
					name: "JANE smith",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["JANE SMITH"]).toHaveLength(1);
		});
	});

	describe("multiple hits for same person", () => {
		it("should combine watchlist results from multiple hit records for same person", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-3" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(3);
			expect(result["JOHN DOE"].map((r) => r.id)).toEqual([
				"result-1",
				"result-2",
				"result-3",
			]);
		});
	});

	describe("hits for names not in people list", () => {
		it("should include hits for names not in the original people list", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
				createWatchlistPerson({
					name: "Unknown Person",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["UNKNOWN PERSON"]).toHaveLength(1);
		});
	});

	describe("edge cases", () => {
		it("should handle empty people names array", () => {
			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [createWatchlistPersonResult()],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits([], hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
		});

		it("should handle empty hits array", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: "Jane Smith" }),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, []);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(0);
			expect(result["JANE SMITH"]).toHaveLength(0);
		});

		it("should handle both arrays being empty", () => {
			/** Act */
			const result = groupPeopleWatchlistHits([], []);

			/** Assert */
			expect(result).toEqual({});
		});

		it("should handle person with empty watchlist results", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(0);
		});
	});

	describe("return value structure", () => {
		it("should return correct type structure", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [createWatchlistPersonResult()],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(typeof result).toBe("object");
			expect(Array.isArray(result["JOHN DOE"])).toBe(true);
			expect(result["JOHN DOE"][0]).toHaveProperty("id");
			expect(result["JOHN DOE"][0]).toHaveProperty(
				"type",
				"watchlist_result",
			);
			expect(result["JOHN DOE"][0]).toHaveProperty("metadata");
		});

		it("should maintain all properties of watchlist results", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const customResult = createWatchlistPersonResult({
				id: "custom-id",
				url: "https://custom.com",
				score: 88,
				entity_name: "Custom Entity",
				categories: ["custom-category"],
			});

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [customResult],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"][0]).toEqual(customResult);
		});
	});

	describe("null value handling", () => {
		it("should skip people with null name.name", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: null as any }),
				createPeopleObjectValue({ name: undefined as any }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["JOHN DOE"]);
		});

		it("should skip hits with null name", () => {
			/** Arrange */
			const peopleNames = [createPeopleObjectValue({ name: "John Doe" })];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
				createWatchlistPerson({
					name: null as any,
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
				createWatchlistPerson({
					name: undefined as any,
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-3" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["JOHN DOE"][0].id).toBe("result-1");
		});

		it("should handle mixed null values correctly", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: null as any }),
				createPeopleObjectValue({ name: "Jane Smith" }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
				createWatchlistPerson({
					name: null as any,
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
				createWatchlistPerson({
					name: "Jane Smith",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-3" }),
					],
				}),
				createWatchlistPerson({
					name: undefined as any,
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-4" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["JANE SMITH"]).toHaveLength(1);
			expect(result["JOHN DOE"][0].id).toBe("result-1");
			expect(result["JANE SMITH"][0].id).toBe("result-3");
			expect(Object.keys(result)).toEqual(["JOHN DOE", "JANE SMITH"]);
		});

		it("should return empty object when all people have null name.name", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: null as any }),
				createPeopleObjectValue({ name: undefined as any }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [createWatchlistPersonResult()],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["JOHN DOE"]);
		});

		it("should handle empty string names correctly", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "" }),
				createPeopleObjectValue({ name: "John Doe" }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [createWatchlistPersonResult()],
				}),
				createWatchlistPerson({
					name: "",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["JOHN DOE"]);
		});

		it("should create new groups for hits with names not in people list when hit name is valid", () => {
			/** Arrange */
			const peopleNames = [
				createPeopleObjectValue({ name: "John Doe" }),
				createPeopleObjectValue({ name: null as any }),
			];

			const hits = [
				createWatchlistPerson({
					name: "John Doe",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-1" }),
					],
				}),
				createWatchlistPerson({
					name: "Unknown Person",
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-2" }),
					],
				}),
				createWatchlistPerson({
					name: null as any,
					watchlist_results: [
						createWatchlistPersonResult({ id: "result-3" }),
					],
				}),
			];

			/** Act */
			const result = groupPeopleWatchlistHits(peopleNames, hits);

			/** Assert */
			expect(result["JOHN DOE"]).toHaveLength(1);
			expect(result["UNKNOWN PERSON"]).toHaveLength(1);
			expect(result["JOHN DOE"][0].id).toBe("result-1");
			expect(result["UNKNOWN PERSON"][0].id).toBe("result-2");
			expect(Object.keys(result)).toEqual(["JOHN DOE", "UNKNOWN PERSON"]);
		});
	});
});

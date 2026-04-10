import type { WatchlistValueMetadatum } from "@/types/integrations";
import { groupWatchlistHitsByEntityName } from "../groupWatchlistHitsByEntityName";

describe("groupWatchlistHitsByEntityName", () => {
	const createWatchlistValueMetadatum = (
		overrides: Partial<WatchlistValueMetadatum> = {},
	): WatchlistValueMetadatum => ({
		id: "test-hit-id",
		type: "watchlist_result",
		metadata: {
			abbr: "SDN",
			title: "Specially Designated Nationals",
			agency: "Office of Foreign Assets Control",
			agency_abbr: "OFAC",
			entity_name: "Test Entity",
		},
		...overrides,
	});

	it("should group watchlist hits by entity_name", () => {
		/** Arrange */
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "hit-1",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "ZHAO, Dongdong",
				},
			}),
			createWatchlistValueMetadatum({
				id: "hit-2",
				metadata: {
					abbr: "BIS",
					title: "Bureau of Industry and Security",
					agency: "Bureau of Industry and Security",
					agency_abbr: "BIS",
					entity_name: "WEI, Hsueh Lung",
				},
			}),
			createWatchlistValueMetadatum({
				id: "hit-3",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "ZHAO, Dongdong",
				},
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(hits, [], []);

		/** Assert */
		expect(result["ZHAO, DONGGONG"]).toHaveLength(2);
		expect(result["WEI, HSUEH LUNG"]).toHaveLength(1);
		expect(result["ZHAO, DONGGONG"][0].id).toBe("hit-1");
		expect(result["ZHAO, DONGGONG"][1].id).toBe("hit-3");
	});

	it("should group hits case-insensitively", () => {
		/** Arrange */
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "hit-1",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "ZHAO, Dongdong",
				},
			}),
			createWatchlistValueMetadatum({
				id: "hit-2",
				metadata: {
					abbr: "BIS",
					title: "Bureau of Industry and Security",
					agency: "Bureau of Industry and Security",
					agency_abbr: "BIS",
					entity_name: "zhao, dongdong",
				},
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(hits, [], []);

		/** Assert */
		expect(result["ZHAO, DONGGONG"]).toHaveLength(2);
		expect(Object.keys(result)).toEqual(["ZHAO, DONGGONG"]);
	});

	it("should skip hits with invalid entity_name", () => {
		/** Arrange */
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "hit-1",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "Valid Entity",
				},
			}),
			createWatchlistValueMetadatum({
				id: "hit-2",
				metadata: null as any,
			}),
			createWatchlistValueMetadatum({
				id: "hit-3",
				metadata: {
					abbr: "BIS",
					title: "Bureau of Industry and Security",
					agency: "Bureau of Industry and Security",
					agency_abbr: "BIS",
					entity_name: null as any,
				},
			}),
			createWatchlistValueMetadatum({
				id: "hit-4",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "",
				},
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(hits, [], []);

		/** Assert */
		expect(result["VALID ENTITY"]).toHaveLength(1);
		expect(result["VALID ENTITY"][0].id).toBe("hit-1");
		expect(Object.keys(result)).toEqual(["VALID ENTITY"]);
	});

	it("should return empty object when hits array is empty and no scanned entities", () => {
		/** Act */
		const result = groupWatchlistHitsByEntityName([], [], []);

		/** Assert */
		expect(result).toEqual({});
	});

	it("should handle Middesk watchlist structure with all fields", () => {
		/** Arrange */
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "e9917229-d903-45b9-9012-98d3ecea3a01",
				type: "watchlist_result",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "Allison NeJame watchlist hit",
				},
				addresses: [{ full_address: "PA" }],
				agency_information_url: "http://bit.ly/1MLgpye",
				agency_list_url: "http://bit.ly/1I7ipyR",
				categories: [],
				entity_aliases: [],
				list_country: "United States of America",
				list_region: "North America",
				list_url: null,
				listed_at: null,
				score: 100,
				url: "https://sanctionssearch.ofac.treas.gov/Details.aspx?id=1043",
			}),
			createWatchlistValueMetadatum({
				id: "hit-2",
				type: "watchlist_result",
				metadata: {
					abbr: "BIS",
					title: "Bureau of Industry and Security",
					agency: "Bureau of Industry and Security",
					agency_abbr: "BIS",
					entity_name: "Allison NeJame watchlist hit",
				},
				url: "https://example.com/bis",
				score: 95,
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(hits, [], []);

		/** Assert */
		expect(result["ALLISON NEJAME WATCHLIST HIT"]).toHaveLength(2);
		expect(result["ALLISON NEJAME WATCHLIST HIT"][0].url).toBe(
			"https://sanctionssearch.ofac.treas.gov/Details.aspx?id=1043",
		);
		expect(result["ALLISON NEJAME WATCHLIST HIT"][0].score).toBe(100);
		expect(result["ALLISON NEJAME WATCHLIST HIT"][0].list_country).toBe(
			"United States of America",
		);
	});

	it("should pre-populate with business names even when there are no hits", () => {
		/** Arrange */
		const businessNames = [
			{ name: "Test Business LLC" },
			{ name: "Another Corp" },
		];
		const peopleNames: Array<{ name?: string }> = [];

		/** Act */
		const result = groupWatchlistHitsByEntityName(
			[],
			businessNames,
			peopleNames,
		);

		/** Assert */
		expect(result["TEST BUSINESS LLC"]).toHaveLength(0);
		expect(result["ANOTHER CORP"]).toHaveLength(0);
		expect(Object.keys(result)).toEqual([
			"TEST BUSINESS LLC",
			"ANOTHER CORP",
		]);
	});

	it("should pre-populate with people names even when there are no hits", () => {
		/** Arrange */
		const businessNames: Array<{ name?: string }> = [];
		const peopleNames = [{ name: "John Doe" }, { name: "Jane Smith" }];

		/** Act */
		const result = groupWatchlistHitsByEntityName(
			[],
			businessNames,
			peopleNames,
		);

		/** Assert */
		expect(result["JOHN DOE"]).toHaveLength(0);
		expect(result["JANE SMITH"]).toHaveLength(0);
		expect(Object.keys(result)).toEqual(["JOHN DOE", "JANE SMITH"]);
	});

	it("should pre-populate with both business and people names", () => {
		/** Arrange */
		const businessNames = [{ name: "Test Business LLC" }];
		const peopleNames = [{ name: "John Doe" }];

		/** Act */
		const result = groupWatchlistHitsByEntityName(
			[],
			businessNames,
			peopleNames,
		);

		/** Assert */
		expect(result["TEST BUSINESS LLC"]).toHaveLength(0);
		expect(result["JOHN DOE"]).toHaveLength(0);
		expect(Object.keys(result)).toEqual(["TEST BUSINESS LLC", "JOHN DOE"]);
	});

	it("should include scanned entities with hits and without hits", () => {
		/** Arrange */
		const businessNames = [
			{ name: "Test Business LLC" },
			{ name: "No Hits Corp" },
		];
		const peopleNames: Array<{ name?: string }> = [];
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "hit-1",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "Test Business LLC",
				},
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(
			hits,
			businessNames,
			peopleNames,
		);

		/** Assert */
		expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
		expect(result["NO HITS CORP"]).toHaveLength(0);
		expect(Object.keys(result)).toEqual([
			"TEST BUSINESS LLC",
			"NO HITS CORP",
		]);
	});

	it("should handle empty arrays for businessNames and peopleNames", () => {
		/** Arrange */
		const hits: WatchlistValueMetadatum[] = [
			createWatchlistValueMetadatum({
				id: "hit-1",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "Some Entity",
				},
			}),
		];

		/** Act */
		const result = groupWatchlistHitsByEntityName(hits, [], []);

		/** Assert */
		expect(result["SOME ENTITY"]).toHaveLength(1);
		expect(Object.keys(result)).toEqual(["SOME ENTITY"]);
	});

	it("should handle entities with optional name property", () => {
		/** Arrange */
		const businessNames = [
			{ name: "Valid Business" },
			{ name: undefined },
			{},
		];
		const peopleNames: Array<{ name?: string }> = [];

		/** Act */
		const result = groupWatchlistHitsByEntityName(
			[],
			businessNames,
			peopleNames,
		);

		/** Assert */
		expect(result["VALID BUSINESS"]).toHaveLength(0);
		expect(Object.keys(result)).toEqual(["VALID BUSINESS"]);
	});
});

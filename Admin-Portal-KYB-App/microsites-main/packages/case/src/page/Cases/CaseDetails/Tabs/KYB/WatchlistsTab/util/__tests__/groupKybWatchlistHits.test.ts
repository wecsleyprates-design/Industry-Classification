import {
	type NamesSubmittedValue,
	type WatchlistValueMetadatum,
} from "@/types/integrations";
import { groupKybWatchlistHits } from "../groupKybWatchlistHits";

describe("groupKybWatchlistHits", () => {
	const createNamesSubmittedValue = (
		overrides: Partial<NamesSubmittedValue> = {},
	): NamesSubmittedValue => ({
		name: "Test Business LLC",
		submitted: true,
		...overrides,
	});

	const createWatchlistValueMetadatum = (
		overrides: Partial<WatchlistValueMetadatum> = {},
	): WatchlistValueMetadatum => ({
		id: "test-hit-id",
		type: "watchlist_hit",
		metadata: {
			abbr: "SDN",
			title: "Specially Designated Nationals",
			agency: "Office of Foreign Assets Control",
			agency_abbr: "OFAC",
			entity_name: "Test Business LLC",
		},
		...overrides,
	});

	describe("basic functionality", () => {
		it("should group watchlist hits by business name", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
				createNamesSubmittedValue({ name: "Another Corp" }),
			];

			const hits = [
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
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "Test Business LLC",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-3",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Another Corp",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(2);
			expect(result["ANOTHER CORP"]).toHaveLength(1);
			expect(result["TEST BUSINESS LLC"][0].id).toBe("hit-1");
			expect(result["TEST BUSINESS LLC"][1].id).toBe("hit-2");
			expect(result["ANOTHER CORP"][0].id).toBe("hit-3");
		});

		it("should initialize empty arrays for names with no hits", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
				createNamesSubmittedValue({ name: "Another Corp" }),
				createNamesSubmittedValue({ name: "Clean Company" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
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
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
			expect(result["ANOTHER CORP"]).toHaveLength(0);
			expect(result["CLEAN COMPANY"]).toHaveLength(0);
		});
	});

	describe("case insensitive matching", () => {
		it("should match names regardless of case", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "test business llc" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "TEST BUSINESS LLC",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
		});

		it("should handle mixed case scenarios", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "TeSt BuSiNeSs LLC" }),
				createNamesSubmittedValue({ name: "another CORP" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "test business llc",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "ANOTHER corp",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
			expect(result["ANOTHER CORP"]).toHaveLength(1);
		});
	});

	describe("multiple hits for same business", () => {
		it("should combine watchlist hits for the same business name", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
			];

			const hits = [
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
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "Test Business LLC",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-3",
					metadata: {
						abbr: "UNSC",
						title: "UN Security Council",
						agency: "United Nations",
						agency_abbr: "UN",
						entity_name: "Test Business LLC",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(3);
			expect(result["TEST BUSINESS LLC"].map((h) => h.id)).toEqual([
				"hit-1",
				"hit-2",
				"hit-3",
			]);
		});
	});

	describe("hits for names not in submitted list", () => {
		it("should include hits for names not in the original submitted list", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
			];

			const hits = [
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
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "Unknown Company",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
			expect(result["UNKNOWN COMPANY"]).toHaveLength(1);
		});
	});

	describe("edge cases", () => {
		it("should handle empty names submitted array", () => {
			/** Arrange */
			const hits = [
				createWatchlistValueMetadatum({
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
			const result = groupKybWatchlistHits([], hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(1);
		});

		it("should handle empty hits array", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
				createNamesSubmittedValue({ name: "Another Corp" }),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, []);

			/** Assert */
			expect(result["TEST BUSINESS LLC"]).toHaveLength(0);
			expect(result["ANOTHER CORP"]).toHaveLength(0);
		});

		it("should handle both arrays being empty", () => {
			/** Act */
			const result = groupKybWatchlistHits([], []);

			/** Assert */
			expect(result).toEqual({});
		});

		it("should handle names with special characters", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test & Associates, LLC" }),
				createNamesSubmittedValue({ name: "Company (Holdings) Ltd." }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Test & Associates, LLC",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "Company (Holdings) Ltd.",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST & ASSOCIATES, LLC"]).toHaveLength(1);
			expect(result["COMPANY (HOLDINGS) LTD."]).toHaveLength(1);
		});
	});

	describe("return value structure", () => {
		it("should return correct type structure", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
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
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(typeof result).toBe("object");
			expect(Array.isArray(result["TEST BUSINESS LLC"])).toBe(true);
			expect(result["TEST BUSINESS LLC"][0]).toHaveProperty("id");
			expect(result["TEST BUSINESS LLC"][0]).toHaveProperty("type");
			expect(result["TEST BUSINESS LLC"][0]).toHaveProperty("metadata");
			expect(result["TEST BUSINESS LLC"][0].metadata).toHaveProperty(
				"entity_name",
			);
		});

		it("should maintain all properties of watchlist hits", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business LLC" }),
			];

			const customHit = createWatchlistValueMetadatum({
				id: "custom-hit-id",
				type: "custom_type",
				metadata: {
					abbr: "CUSTOM",
					title: "Custom Watchlist",
					agency: "Custom Agency",
					agency_abbr: "CA",
					entity_name: "Test Business LLC",
				},
			});

			const hits = [customHit];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS LLC"][0]).toEqual(customHit);
		});
	});

	describe("submitted flag handling", () => {
		it("should work regardless of submitted flag value", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({
					name: "Submitted Business",
					submitted: true,
				}),
				createNamesSubmittedValue({
					name: "Not Submitted Business",
					submitted: false,
				}),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Submitted Business",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: "Not Submitted Business",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["SUBMITTED BUSINESS"]).toHaveLength(1);
			expect(result["NOT SUBMITTED BUSINESS"]).toHaveLength(1);
		});
	});

	describe("null value handling", () => {
		it("should skip names with null name.name", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Valid Business" }),
				createNamesSubmittedValue({ name: null as any }),
				createNamesSubmittedValue({ name: undefined as any }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Valid Business",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["VALID BUSINESS"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["VALID BUSINESS"]);
		});

		it("should skip hits with null metadata", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Test Business",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: null as any,
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS"]).toHaveLength(1);
			expect(result["TEST BUSINESS"][0].id).toBe("hit-1");
		});

		it("should skip hits with null metadata.entity_name", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Test Business" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Test Business",
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-2",
					metadata: {
						abbr: "BIS",
						title: "Bureau of Industry and Security",
						agency: "Bureau of Industry and Security",
						agency_abbr: "BIS",
						entity_name: null as any,
					},
				}),
				createWatchlistValueMetadatum({
					id: "hit-3",
					metadata: {
						abbr: "UNSC",
						title: "UN Security Council",
						agency: "United Nations",
						agency_abbr: "UN",
						entity_name: undefined as any,
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["TEST BUSINESS"]).toHaveLength(1);
			expect(result["TEST BUSINESS"][0].id).toBe("hit-1");
		});

		it("should handle mixed null values correctly", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "Valid Business" }),
				createNamesSubmittedValue({ name: null as any }),
				createNamesSubmittedValue({ name: "Another Business" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					id: "hit-1",
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Valid Business",
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
						abbr: "UNSC",
						title: "UN Security Council",
						agency: "United Nations",
						agency_abbr: "UN",
						entity_name: "Another Business",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["VALID BUSINESS"]).toHaveLength(1);
			expect(result["ANOTHER BUSINESS"]).toHaveLength(1);
			expect(result["VALID BUSINESS"][0].id).toBe("hit-1");
			expect(result["ANOTHER BUSINESS"][0].id).toBe("hit-4");
			expect(Object.keys(result)).toEqual([
				"VALID BUSINESS",
				"ANOTHER BUSINESS",
			]);
		});

		it("should return empty object when all names have null name.name", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: null as any }),
				createNamesSubmittedValue({ name: undefined as any }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Some Business",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["SOME BUSINESS"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["SOME BUSINESS"]);
		});

		it("should handle empty string names correctly", () => {
			/** Arrange */
			const namesSubmitted = [
				createNamesSubmittedValue({ name: "" }),
				createNamesSubmittedValue({ name: "Valid Business" }),
			];

			const hits = [
				createWatchlistValueMetadatum({
					metadata: {
						abbr: "SDN",
						title: "Specially Designated Nationals",
						agency: "Office of Foreign Assets Control",
						agency_abbr: "OFAC",
						entity_name: "Valid Business",
					},
				}),
			];

			/** Act */
			const result = groupKybWatchlistHits(namesSubmitted, hits);

			/** Assert */
			expect(result["VALID BUSINESS"]).toHaveLength(1);
			expect(Object.keys(result)).toEqual(["VALID BUSINESS"]);
		});
	});
});

import { randomUUID } from "crypto";

import {
	buildBaselayerReviewTasks,
	mapBaselayerAddresses,
	matchFieldToReviewStatus
} from "../baselayerBusinessMapping";

describe("matchFieldToReviewStatus", () => {
	it("maps EXACT to success", () => {
		expect(matchFieldToReviewStatus("EXACT")).toBe("success");
		expect(matchFieldToReviewStatus("exact")).toBe("success");
	});

	it("maps SIMILAR to warning", () => {
		expect(matchFieldToReviewStatus("SIMILAR")).toBe("warning");
		expect(matchFieldToReviewStatus("similar")).toBe("warning");
	});

	it("maps null/undefined/empty to warning", () => {
		expect(matchFieldToReviewStatus(null)).toBe("warning");
		expect(matchFieldToReviewStatus(undefined)).toBe("warning");
		expect(matchFieldToReviewStatus("")).toBe("warning");
	});

	it("maps other values to failure", () => {
		expect(matchFieldToReviewStatus("NO_MATCH")).toBe("failure");
		expect(matchFieldToReviewStatus("PARTIAL")).toBe("failure");
	});
});

describe("buildBaselayerReviewTasks", () => {
	const bevId = randomUUID();

	it("sets name/address/officer rows from matchFieldToReviewStatus", () => {
		const rows = buildBaselayerReviewTasks(bevId, {
			business_name_match: "EXACT",
			business_address_match: "SIMILAR",
			business_officer_match: "NO_MATCH",
			tin_matched: true,
			watchlist_hits: []
		});
		const name = rows.find(r => r.key === "name");
		const addr = rows.find(r => r.key === "address_verification");
		const officer = rows.find(r => r.key === "person_verification");
		expect(name?.status).toBe("success");
		expect(addr?.status).toBe("warning");
		expect(officer?.status).toBe("failure");
	});

	it("maps tin_matched true/false/null to tin row statuses", () => {
		const rTrue = buildBaselayerReviewTasks(bevId, { tin_matched: true, watchlist_hits: [] });
		const rFalse = buildBaselayerReviewTasks(bevId, { tin_matched: false, watchlist_hits: [] });
		const rNull = buildBaselayerReviewTasks(bevId, { tin_matched: null, watchlist_hits: [] });
		expect(rTrue.find(r => r.key === "tin")?.status).toBe("success");
		expect(rFalse.find(r => r.key === "tin")?.status).toBe("failure");
		expect(rNull.find(r => r.key === "tin")?.status).toBe("warning");
	});

	it("sets watchlist row to failure when any hit has count > 0", () => {
		const rows = buildBaselayerReviewTasks(bevId, {
			watchlist_hits: [{ code: "OFAC", name: "Test", count: 1, details: [] }]
		});
		const wl = rows.find(r => r.key === "watchlist");
		expect(wl?.status).toBe("failure");
	});

	it("sets watchlist row to success when no hits or zero counts", () => {
		const rows = buildBaselayerReviewTasks(bevId, {
			watchlist_hits: [{ code: "X", count: 0 }]
		});
		expect(rows.find(r => r.key === "watchlist")?.status).toBe("success");
	});
});

describe("mapBaselayerAddresses", () => {
	const bevId = randomUUID();

	it("assembles full_address from street, city, state, zip", () => {
		const [row] = mapBaselayerAddresses(bevId, {
			addresses: [
				{
					id: randomUUID(),
					street: "1 Main St",
					city: "Austin",
					state: "TX",
					zip: "78701",
					deliverable: true,
					cmra: false,
					delivery_type: "commercial",
					latitude: 30,
					longitude: -97
				}
			]
		});
		expect(row.full_address).toBe("1 Main St, Austin, TX, 78701");
		expect(row.deliverable).toBe(true);
		expect(row.cmra).toBe(false);
		expect(row.address_property_type).toBe("commercial");
		expect(row.lat).toBe(30);
		expect(row.long).toBe(-97);
	});

	it("appends country to full_address when provided", () => {
		const [row] = mapBaselayerAddresses(bevId, {
			addresses: [
				{
					id: randomUUID(),
					street: "Rue 1",
					city: "Paris",
					state: "IDF",
					zip: "75001",
					country: "FR"
				}
			]
		});
		expect(row.full_address).toContain("FR");
	});

	it("treats deliverable/cmra as booleans", () => {
		const [row] = mapBaselayerAddresses(bevId, {
			addresses: [{ id: randomUUID(), street: "x", city: "y", state: "Z", zip: "1", deliverable: false, cmra: true }]
		});
		expect(row.deliverable).toBe(false);
		expect(row.cmra).toBe(true);
	});

	it("returns empty array when no addresses", () => {
		expect(mapBaselayerAddresses(bevId, {})).toEqual([]);
		expect(mapBaselayerAddresses(bevId, { addresses: [] })).toEqual([]);
	});
});

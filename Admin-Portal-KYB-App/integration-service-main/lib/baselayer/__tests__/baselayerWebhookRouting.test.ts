import { baselayerEventType, routeBaselayerWebhookAfterBevResolved } from "../baselayerWebhookRouting";

describe("baselayerEventType", () => {
	it("returns empty string when __event__ missing", () => {
		expect(baselayerEventType({})).toBe("");
	});

	it("returns event type string", () => {
		expect(
			baselayerEventType({
				__event__: { type: "BusinessSearch.completed" }
			})
		).toBe("BusinessSearch.completed");
	});
});

describe("routeBaselayerWebhookAfterBevResolved", () => {
	it("returns submitted_skip for BusinessSearch.submitted", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "BusinessSearch.submitted" },
				state: "PENDING"
			})
		).toBe("submitted_skip");
	});

	it("returns failed when event type includes failed", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "BusinessSearch.failed" }
			})
		).toBe("failed");
	});

	it("returns failed when state is FAILED", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "BusinessSearch.completed" },
				state: "FAILED"
			})
		).toBe("failed");
	});

	it("returns ignored for unknown event types (not completed/updated)", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "Order.created" },
				state: "PENDING"
			})
		).toBe("ignored");
	});

	it("returns persist for BusinessSearch.completed", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "BusinessSearch.completed" },
				state: "COMPLETED"
			})
		).toBe("persist");
	});

	it("returns persist for BusinessSearch.updated", () => {
		expect(
			routeBaselayerWebhookAfterBevResolved({
				__event__: { type: "BusinessSearch.updated" },
				state: "COMPLETED"
			})
		).toBe("persist");
	});
});

/**
 * Pure helpers for Baselayer webhook event routing (testable without DB/service).
 */

export function baselayerEventType(body: { __event__?: { type?: string } }): string {
	return (body.__event__?.type || "").toString();
}

export type BaselayerWebhookRoute =
	| "submitted_skip"
	| "failed"
	| "ignored"
	| "persist";

/**
 * Decide what to do after a BEV row has been resolved (same rules as ingestBaselayerWebhookPayload).
 */
export function routeBaselayerWebhookAfterBevResolved(body: {
	__event__?: { type?: string };
	state?: string | null;
}): BaselayerWebhookRoute {
	const eventType = baselayerEventType(body).toLowerCase();
	const state = (body.state || "").toString().toUpperCase();

	if (eventType.includes("submitted")) {
		return "submitted_skip";
	}
	if (eventType.includes("failed") || state === "FAILED") {
		return "failed";
	}
	if (!eventType.includes("completed") && !eventType.includes("updated")) {
		return "ignored";
	}
	return "persist";
}

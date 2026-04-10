#!/usr/bin/env node
/**
 * Opt-in load against POST /api/v1/internal/businesses/:id/search-business-details.
 *
 * Env:
 *   HTTP_BASELINE_BASE_URL   default http://127.0.0.1:3000
 *   HTTP_BASELINE_BUSINESS_ID (required) UUID path segment
 *   HTTP_BASELINE_CONNECTIONS default 5
 *   HTTP_BASELINE_DURATION_SEC default 10
 *   HTTP_BASELINE_BUSINESS_NAME / HTTP_BASELINE_BUSINESS_ADDRESS optional JSON body fields
 * Default body values match the documented `test.utils.ts` fixture contract.
 */
import autocannon from "autocannon";

const baseUrl = (process.env.HTTP_BASELINE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const businessId = process.env.HTTP_BASELINE_BUSINESS_ID?.trim();
if (!businessId) {
	console.error(
		"http-baseline:load-internal: set HTTP_BASELINE_BUSINESS_ID to the business UUID used for local runs."
	);
	process.exit(1);
}

const url = `${baseUrl}/api/v1/internal/businesses/${businessId}/search-business-details`;
const connections = Number(process.env.HTTP_BASELINE_CONNECTIONS || "5");
const duration = Number(process.env.HTTP_BASELINE_DURATION_SEC || "10");
const body = JSON.stringify({
	businessName: process.env.HTTP_BASELINE_BUSINESS_NAME || "Test Business",
	businessAddress: process.env.HTTP_BASELINE_BUSINESS_ADDRESS || "123 Market St, San Francisco, CA 94105"
});

const result = await autocannon({
	url,
	method: "POST",
	headers: {
		"content-type": "application/json"
	},
	body,
	connections,
	duration
});

process.stdout.write(autocannon.printResult(result));

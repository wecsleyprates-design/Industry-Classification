#!/usr/bin/env node
/**
 * Minimal local Serp-shaped stub for baseline work only (maps /search, reviews /search.json).
 * Default: empty local_results / no place match, empty reviews. Binds 127.0.0.1.
 *
 * Optional env: SERP_STUB_HOST (default 127.0.0.1), SERP_STUB_PORT (default 18765).
 * Pair with CONFIG_SERPAPI_BASE_URL=http://127.0.0.1:18765 and a non-empty dummy SERP_API_KEY.
 */
import http from "node:http";

const host = process.env.SERP_STUB_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.SERP_STUB_PORT || "18765");

const mapsNoMatch = JSON.stringify({ local_results: [], place_results: null });
const reviewsEmpty = JSON.stringify({ reviews: [] });

const server = http.createServer((req, res) => {
	const base = `http://${host}:${port}`;
	let pathname;
	try {
		pathname = new URL(req.url || "/", base).pathname;
	} catch {
		res.writeHead(400);
		res.end();
		return;
	}

	if (req.method !== "GET") {
		res.writeHead(405);
		res.end();
		return;
	}

	if (pathname === "/search") {
		res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
		res.end(mapsNoMatch);
		return;
	}
	if (pathname === "/search.json") {
		res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
		res.end(reviewsEmpty);
		return;
	}

	res.writeHead(404);
	res.end();
});

server.listen(port, host, () => {
	process.stderr.write(`serp-stub: http://${host}:${port}  GET /search  GET /search.json\n`);
});

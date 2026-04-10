# Local performance baseline: `search-business-details`

Service-local runbook for capturing a reproducible local baseline on the integration-service `search-business-details` path. Follow it end to end; partial steps invalidate comparability.

## Purpose

This runbook exists to support before/after comparisons between a baseline commit and a candidate commit under one frozen local protocol.

It does not define CI policy, production SLOs, or customer-perceived latency.

## Related files

- [`README.md`](../../README.md)
- [`package.json`](../../package.json)
- [`scripts/http-baseline/serp-stub.mjs`](../../scripts/http-baseline/serp-stub.mjs)
- [`scripts/http-baseline/autocannon-internal-search-business-details.mjs`](../../scripts/http-baseline/autocannon-internal-search-business-details.mjs)
- [`src/api/v1/modules/data-scrape/__tests__/search-business-details.routes.test.ts`](../../src/api/v1/modules/data-scrape/__tests__/search-business-details.routes.test.ts)
- [`src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.regression.test.ts`](../../src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.regression.test.ts)
- [`src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.serpKey.test.ts`](../../src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.serpKey.test.ts)
- [`src/api/v1/modules/data-scrape/__tests__/dataScrapeService.serpBaseUrl.test.ts`](../../src/api/v1/modules/data-scrape/__tests__/dataScrapeService.serpBaseUrl.test.ts)
- [`src/api/v1/modules/data-scrape/__tests__/test.utils.ts`](../../src/api/v1/modules/data-scrape/__tests__/test.utils.ts)
- [`.github/workflows/test.yml`](../../.github/workflows/test.yml)

## Claim boundaries

Controlled local baseline results are valid only for the exact route, request body, fixture identity, `external_policy_id`, profiling UUID, machine/runtime fingerprint, and SHAs recorded for that run.

Controlled local results do not, by themselves, prove:

- production latency or throughput
- customer-perceived performance
- CI performance
- parity between public and internal route surfaces
- behavior for other payloads, businesses, flags, or dependency states

Deployed-environment APM observations may be used as a separate source of evidence, but they must be named separately and must not be presented as if this local runbook validated them.

## Default protocol surface

The default measurement surface for this runbook is the internal route.

| Field                   | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Surface label           | `internal`                                                                                                 |
| Method                  | `POST`                                                                                                     |
| URL template            | `{BASE_URL}/api/v1/internal/businesses/{businessID}/search-business-details`                               |
| Auth                    | none                                                                                                       |
| Middleware implications | excludes `validateUser`; includes `validateTypedSchema` and `validatePurgedBusiness` before the controller |

The public route is a separate, non-comparable experiment:

| Field                   | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Surface label           | `public`                                                               |
| Method                  | `POST`                                                                 |
| URL template            | `{BASE_URL}/api/v1/businesses/{businessID}/search-business-details`    |
| Auth                    | `Authorization: Bearer <valid JWT>`                                    |
| Middleware implications | includes `validateUser` ahead of validation and purged-business checks |

Do not mix `internal` and `public` results inside the same comparison table. If you benchmark both, label them as separate experiments.

## Fixed inputs

Use the same default inputs used by the `search-business-details` regression harness unless the experiment explicitly says otherwise.

| Input                   | Canonical source                                         | Default value                            |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `businessID` path param | `src/api/v1/modules/data-scrape/__tests__/test.utils.ts` | `11111111-1111-4111-8111-111111111111`   |
| `businessName`          | `buildValidSearchBusinessBody()`                         | `Test Business`                          |
| `businessAddress`       | `buildValidSearchBusinessBody()`                         | `123 Market St, San Francisco, CA 94105` |

Default body payload:

```json
{
	"businessName": "Test Business",
	"businessAddress": "123 Market St, San Francisco, CA 94105"
}
```

If you add optional body keys such as `businessDbaName`, `persistGoogleReviews`, or `is_bulk`, record the exact payload bytes and do not compare those runs to the default-body series unless that payload difference is the hypothesis under test.

## External-services policy (stable IDs)

Every recorded metrics row must include an `external_policy_id`. Rows with missing or ambiguous policy IDs are invalid.

| `external_policy_id` | Serp / search API      | OpenAI                             | PostgreSQL              | Redis | Other outbound dependencies            | Intended use                      |
| -------------------- | ---------------------- | ---------------------------------- | ----------------------- | ----- | -------------------------------------- | --------------------------------- |
| `EXT-001`            | live                   | live if invoked                    | live                    | live  | as configured in your local env source | highest realism, highest variance |
| `EXT-002`            | live                   | disabled or stubbed if path allows | live                    | live  | minimized where possible               | isolate search path more narrowly |
| `EXT-003`            | stubbed or replayed    | stubbed or disabled                | live                    | live  | as configured                          | deterministic local baseline      |
| `EXT-004`            | live                   | live or disabled as recorded       | local seeded fixture DB | live  | as configured                          | DB-focused tuning work            |
| `EXT-005`            | off / missing-key path | off / missing-key path             | live                    | live  | as configured                          | intentional error-path latency    |

Do not compare numeric rows across different `external_policy_id` values unless the comparison is explicitly framed as cross-policy and interpreted separately.

## Local stub recipe (`EXT-003`)

Use this path when you want deterministic Serp behavior while keeping the app, DB, and Redis real.

1. Ensure the service's normal config source still resolves `SERP_API_KEY` to a non-empty value. A dummy value is acceptable when the stub is in use.
1. Start the localhost stub:

```bash
npm run http-baseline:serp-stub
```

1. Start the app with the local-only origin override:

```bash
CONFIG_SERPAPI_BASE_URL=http://127.0.0.1:18765 npm run dev
```

1. `CONFIG_SERPAPI_BASE_URL` defaults to `https://serpapi.com`. For `EXT-003`, point it at the loopback stub locally.

Migration note: replace `SERP_API_LOCAL_ORIGIN=http://127.0.0.1:18765` with `CONFIG_SERPAPI_BASE_URL=http://127.0.0.1:18765`.

`CONFIG_SERPAPI_BASE_URL` is part of the service's committed env config surface and is intentionally optional in `compare-configs` during rollout, so shared deployed configs do not need an immediate update.

## Git identity and dependency preflight

Record both revisions before running load:

| Field           | Record                                              |
| --------------- | --------------------------------------------------- |
| `baseline_sha`  | full 40-character git SHA                           |
| `candidate_sha` | full 40-character git SHA                           |
| branch / ref    | optional but recommended                            |
| dirty tree      | `yes` or `no`; if `yes`, summarize the diff or stop |

Before the first timed request:

1. Confirm Postgres is reachable by the same integration-service process you are measuring.
2. Confirm migrations required by the target branch are applied.
3. Confirm Redis is reachable by the same integration-service process you are measuring.
4. Confirm the chosen `businessID` is not blocked by the purge gate for this environment.
5. Record Node and npm versions.
6. Record the exact service start command and `BASE_URL`.
7. Generate a `profiling_session_uuid` for the run window.
8. Record pass/fail for a minimal Redis reachability check against the same endpoint used by the app.

If Redis preflight fails, do not record comparable timing data.

## Measurement recipe

Complete every field before recording numbers.

| Field                     | Record                                        |
| ------------------------- | --------------------------------------------- |
| tool name                 | `autocannon`                                  |
| tool version              | exact version                                 |
| full command              | full copy-paste command including all flags   |
| target URL                | resolved full URL, including `businessID`     |
| method                    | `POST`                                        |
| headers                   | exact header set                              |
| payload fixture identity  | body source plus content hash if using a file |
| concurrency               | exact value                                   |
| duration or request count | exact value                                   |
| warm-up rule              | exact rule                                    |
| discard rule              | exact rule                                    |
| repeat count              | exact count                                   |
| recorded metrics          | exact list, e.g. p50/p95/p99, RPS, error rate |
| `external_policy_id`      | one stable ID from this runbook               |
| `profiling_session_uuid`  | UUID from preflight                           |
| `baseline_sha`            | full SHA                                      |
| `candidate_sha`           | full SHA                                      |

Example load command using the committed helper:

```bash
HTTP_BASELINE_BASE_URL=http://127.0.0.1:3000 \
HTTP_BASELINE_BUSINESS_ID=11111111-1111-4111-8111-111111111111 \
HTTP_BASELINE_CONNECTIONS=5 \
HTTP_BASELINE_DURATION_SEC=10 \
npm run http-baseline:load-internal
```

Optional overrides:

- `HTTP_BASELINE_BUSINESS_NAME`
- `HTTP_BASELINE_BUSINESS_ADDRESS`

If you override them, record the exact values and do not compare those rows to the default-body series unless the payload change is the hypothesis.

## Run fingerprint

Every recorded metrics capture must include a run fingerprint. Do not average or compare captures whose fingerprints differ on relevant fields.

| Field                    | Record                                  |
| ------------------------ | --------------------------------------- |
| timestamp (UTC)          | ISO-8601 timestamp                      |
| host OS / arch           | e.g. `darwin arm64`                     |
| machine class            | laptop / workstation / VM description   |
| CPU / RAM notes          | brief description                       |
| Node version             | `node -v`                               |
| npm version              | `npm -v`                                |
| service start command    | e.g. `npm run dev`                      |
| `BASE_URL`               | full base URL                           |
| fixture or seed identity | payload source + hash or explicit `N/A` |
| `external_policy_id`     | stable ID from policy table             |
| Serp status              | `live`, `stub`, or `off`                |
| OpenAI status            | `live`, `stub`, `off`, or `not_invoked` |
| Postgres identity        | host / db name / environment note       |
| Redis identity           | host / logical name / environment note  |
| `profiling_session_uuid` | UUID                                    |
| git SHA served           | full SHA                                |
| dirty tree               | `yes` or `no`                           |

If any dependency state is unknown, record `unknown` and treat that capture as non-authoritative until clarified.

## Results template

Do not commit numeric results to the repo by default. Use this shape in local notes, ticket comments, or attached artifacts.

```text
run_label,timestamp_utc,git_sha,external_policy_id,profiling_session_uuid,tool_version,fixture_hash,p50_ms,p95_ms,p99_ms,rps,error_rate,notes
baseline-1,,,,,,,,,,,,
baseline-2,,,,,,,,,,,,
baseline-3,,,,,,,,,,,,
candidate-1,,,,,,,,,,,,
candidate-2,,,,,,,,,,,,
candidate-3,,,,,,,,,,,,
```

Every row is invalid unless `external_policy_id` is populated and matches the preflight confirmation used for that run.

## Correctness anchors

Treat these as the named correctness anchors for this baseline protocol:

- `src/api/v1/modules/data-scrape/__tests__/search-business-details.routes.test.ts`
- `src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.regression.test.ts`
- `src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.serpKey.test.ts`
- `src/api/v1/modules/data-scrape/__tests__/dataScrapeService.serpBaseUrl.test.ts`
- `src/api/v1/modules/data-scrape/__tests__/test.utils.ts`

Suggested targeted commands:

```bash
npm run test -- src/api/v1/modules/data-scrape/__tests__/search-business-details.routes.test.ts
npm run test -- src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.regression.test.ts
npm run test -- src/api/v1/modules/data-scrape/__tests__/searchSerpAPI.serpKey.test.ts
npm run test -- src/api/v1/modules/data-scrape/__tests__/dataScrapeService.serpBaseUrl.test.ts
```

Passing these checks does not prove performance. They are functional guards only.

Not part of this named anchor set: `src/api/v1/modules/data-scrape/__tests__/dataScrapeService.spec.ts`.

## CI boundary

`.github/workflows/test.yml` currently runs `npm run test:coverage-ci` on pull requests to `main`.

That workflow does not execute, enforce, or validate this local baseline protocol. The new seam test is part of ordinary Jest coverage, but the stub server, load helper, profiling steps, and metric interpretation remain local manual work.

Do not describe CI as covering this local baseline unless the workflow is explicitly changed to do so.

## Reporting rules

Allowed phrasing:

- "Under `EXT-00x`, on machine `<fingerprint>`, comparing `<baseline_sha>` to `<candidate_sha>`, we observed `<metric>` on the internal `search-business-details` route."

Disallowed phrasing:

- "This proves production got faster."
- "CI validated the baseline."
- "Public and internal route numbers are directly comparable."
- "Jest passing means the latency result is safe."

## Notes

- Prefer a quiet machine with stable power settings.
- Note VPN, thermal throttling, or noisy background processes.
- If you export results outside this repo, include the run fingerprint and `external_policy_id` beside the numbers.

# AIPlane — Test Plan (Playwright + k6, ground-up)

Companion to `docs/SPEC.md`, `docs/DEVLOG.md`, `docs/MICROSERVICES_PLAN.md`, and the GitHub epic **#100 "Microservices Migration (Strangler Fig)"**. Written for two SDETs starting in parallel — this document is the onboarding artifact; read it top to bottom once, then use §6 as your day-to-day phase-by-phase checklist.

Written 2026-07-25. Assumes `docs/MICROSERVICES_PLAN.md`'s phased rollout is in progress — issues **#100** (epic), **#101** (Phase 0), **#102** (Phase 1), **#103** (Phase 2), **#104** (Phase 2.5) already exist on the tracker at time of writing; Phases 3–6 are referenced by name below since their issues had not been filed yet.

## 1. Purpose & Scope

This is the test plan for AIPlane's transition from a modular monolith + 5 micro-frontends into gateway-fronted microservices, covering both **what exists today** (must not regress) and **what test infrastructure needs to exist before each migration phase can be called done**.

Two people, one plan:

- **SDET A — UI**: owns Playwright browser-driven end-to-end tests across the dashboard host and 5 MFEs.
- **SDET B — API/Backend**: owns Playwright API-level tests (no browser), k6 load testing, and CI support for backend integration/contract testing.

Both own the shared fixtures/test-data layer jointly (§5, §11) — build that once, together, before splitting off into your own suites, since duplicating it is the most likely way this plan produces flaky, diverging tests between the two of you.

## 2. Current State — What Already Exists (do not rebuild)

| Layer | Tool | Location | CI job |
|---|---|---|---|
| Frontend unit/component | Vitest + React Testing Library + `@testing-library/jest-dom` | `apps/*/src/**/*.test.tsx`, `packages/*/src/**/*.test.ts` | `ci` (required) |
| Frontend HTTP mocking | MSW | `packages/api-client/src/test/msw/` | part of `ci` |
| Backend unit | JUnit 5 + Mockito | `backend/*/src/test/java/**/*Test.java` | `backend` (not yet required) |
| Backend integration | JUnit 5 + Testcontainers (Postgres) | `backend/*/src/test/java/**/*IT.java`, shared fixture `AbstractPostgresIntegrationTest` | `backend` |
| Coverage | Vitest v8 provider (frontend), JaCoCo (backend) | uploaded as CI artifacts | both jobs |
| Lint/typecheck/build | Biome, `tsc`, Vite/Turbo | — | `ci` (required) |

**Gaps this plan fills**: no Playwright anywhere yet, no k6 anywhere yet, no contract testing, no dedicated e2e CI job, no load-testing baseline. Nothing above changes — you are adding three new layers on top (Playwright, k6, contract validation), not replacing the two that exist.

One backend fixture detail worth knowing before you write a single integration test: `AbstractPostgresIntegrationTest` starts its Testcontainers Postgres in a **static initializer**, not via `@Container` on the class — `@Container` on a shared parent stops the DB between test classes and leaves later classes with a dead JDBC URL (this bit the team once already, see `docs/DEVLOG.md` 2026-07-24 "Guardrail sets"). Copy this pattern for every new service's own integration-test base class; do not reintroduce `@Container`.

## 3. Test Strategy — The Pyramid, With Load as a Separate Axis

```
        /  E2E (Playwright)         \   few, slow, cross-service confidence
       /  Contract (OpenAPI schema)  \  some, per service-pair boundary
      /   Integration (Testcontainers) \ per service, HTTP + DB layer
     /       Unit (Vitest / JUnit)        \ many, fast — already in place, unchanged

     k6 load/performance testing sits beside this pyramid, not inside it —
     it answers "does it hold up under traffic," a different question from
     "is it correct," and runs on its own cadence (§8).
```

Rule of thumb for what goes where: if a bug would be caught by a unit test, do not write an integration test for it; if an integration test would catch it, do not write an E2E test for it. E2E and load tests are reserved for things only observable across process/network boundaries — the strangler migration is what's creating those boundaries, which is why this plan exists now.

## 4. Ownership Split

| Area | Owner | Notes |
|---|---|---|
| Playwright UI specs (`tests/e2e/ui/**`) | **SDET A** | One spec per MFE critical journey + one cross-MFE journey through the dashboard host |
| Playwright API specs (`tests/e2e/api/**`) | **SDET B** | `request`-context only, no browser; hits the gateway/monolith directly |
| k6 scenarios (`tests/load/k6/**`) | **SDET B** | Load, smoke, spike, soak (§8) |
| Shared fixtures (`tests/e2e/fixtures/**`, `tests/load/k6/lib/**`) | **Joint** | Auth helper, test-project seeding/cleanup, ID generators — build once, both consume it |
| Contract/OpenAPI-schema CI step | **SDET B**, reviewed by backend devs | One check per service, added the same PR that adds the service's OpenAPI spec |
| Database/schema testing (`tests/db/**`, per-service Flyway ITs) | **Joint** — backend devs implement, SDET B verifies | Migration correctness, schema-isolation checks, referential-integrity tests once the orphan-data policy is decided (§10) |
| CI workflow wiring (new `e2e.yml`/`load.yml`) | **Joint**, SDET B drives the PR | Both need to agree on trigger conditions before either starts depending on them |

Do not let SDET A's UI specs make direct backend assertions (e.g. querying Postgres to verify a write) — if a UI journey needs to confirm server-side state, it should do so through the same API the app uses, or leave that verification to SDET B's API suite. Keeps the two suites from silently depending on each other's internals.

## 5. Repository Layout (new)

```
tests/
├── e2e/
│   ├── ui/                      # SDET A — Playwright browser specs
│   │   ├── dashboard.spec.ts        cross-MFE smoke journey
│   │   ├── prompt-manager.spec.ts
│   │   ├── guardrail.spec.ts
│   │   ├── user-manager.spec.ts
│   │   └── usages-data.spec.ts
│   ├── api/                     # SDET B — Playwright API (request context) specs
│   │   ├── auth.spec.ts
│   │   ├── prompts.spec.ts
│   │   ├── guardrails.spec.ts
│   │   ├── usage.spec.ts
│   │   └── full-journey.spec.ts     login → prompt → playground → guardrail → usage
│   ├── fixtures/                # Joint — shared across ui/ and api/
│   │   ├── auth.ts                  login helper, storageState reuse
│   │   ├── test-project.ts          create/cleanup an isolated project per test
│   │   └── ids.ts                   collision-safe test data generators
│   └── playwright.config.ts     # two projects: "ui" (baseURL :5173), "api" (baseURL :8080)
├── load/
│   ├── k6/
│   │   ├── scenarios/
│   │   │   ├── usage-ingest-smoke.js
│   │   │   ├── usage-ingest-load.js
│   │   │   ├── usage-ingest-spike.js
│   │   │   └── full-journey-load.js   (added once Phase 6 nears)
│   │   └── lib/
│   │       ├── auth.js              token fetch in setup(), reused across VUs
│   │       └── data.js              per-VU/iteration unique payloads
│   └── README.md                # how to run locally, thresholds explained
├── contract/
│   └── validate-openapi.sh      # CI step: generated spec vs response-schema check, per service
└── db/
    ├── check-schema-isolation.sh   # CI step: fails if a service's SQL touches another schema
    └── migration-checklist.md      # per-phase data-move checklist (§10.4)
```

`tests/e2e` joins the pnpm workspace (`pnpm-workspace.yaml` gains `tests/*`) so `pnpm install` and Playwright's own dependency management both work through the existing toolchain. `tests/load/k6` deliberately does **not** join the pnpm workspace — k6 scripts run inside k6's own limited JS runtime (no `node_modules`, no npm imports at runtime; see §8) — keep it a plain directory with its own README rather than a fake `package.json` that implies `pnpm install` does something there.

## 6. Phase-by-Phase Plan

Mirrors `docs/MICROSERVICES_PLAN.md` §4 exactly, same phase numbers, so the two of you can track test-readiness against the same milestones the backend team is using.

### Phase 0 — issue #101 (Gateway passthrough + observability baseline)

This is where both of you start, before any service is extracted.

- **Joint**: scaffold `tests/e2e` (Playwright installed, `playwright.config.ts` with `ui`/`api` projects, `fixtures/auth.ts` built against the *current* monolith's cookie-based login). Scaffold `tests/load/k6` with its README.
- **SDET A**: one smoke UI spec — dashboard loads, all 4 remote MFEs federate and render. This is valuable immediately, independent of the migration, since Module Federation runtime issues are invisible to Vitest/jsdom.
- **SDET B**: `full-journey.spec.ts` — login → create prompt → promote → run playground → evaluate a guardrail set → ingest a usage event → read the summary, run against `:8080` (today: `api-server` directly). This single spec is the **regression baseline**: once the gateway lands (still on `:8080`, passthrough, zero behavior change per the migration plan), this exact spec should pass unchanged. If it does not, the gateway broke something it should not have.
- **SDET B**: `usage-ingest-smoke.js` (k6, 1 VU, 1 iteration) plus `usage-ingest-load.js` run once manually against the monolith **before** the gateway exists, to record a pre-migration baseline (p95/p99, error rate) — you will not have anything to compare Phase 2's numbers against otherwise. Save the output under `tests/load/k6/README.md`.
- **Joint**: snapshot per-table row counts on the monolith's single schema (a one-off script is fine) — this is the "before" baseline every later phase's data-migration checklist (§10.4) diffs against. Nothing to move yet at this phase, but there is nothing to compare later without it.
- **DoD**: `pnpm --filter tests-e2e exec playwright test` green locally and in a new (non-blocking) CI job; k6 baseline numbers and the row-count snapshot checked into the repo.

### Phase 1 — issue #102 (guardrail-service, strangler pilot)

- **SDET A**: `guardrail.spec.ts` — build a guardrail set, add keyword/regex/max-length rules, run the test panel, confirm short-circuit behavior in the UI.
- **SDET B**: extend `guardrails.spec.ts` with negative/edge cases the migration is most likely to regress — invalid regex rejected, the ReDoS pattern-length guard still enforced, ordering/short-circuit correct after the service moves. Point requests at `/api/v1/guardrails/**` through the gateway once routed.
- **SDET B**: `contract/validate-openapi.sh` gets its first real target — guardrail-service's generated-then-frozen spec (per `docs/MICROSERVICES_PLAN.md` §5).
- **SDET B**: first per-service k6 scenario worth adding here is evaluate-under-load — rule evaluation is CPU-bound (regex matching), a reasonable place to catch a performance regression from the extraction itself.
- **SDET B**: first real run of the data-migration checklist (§10.4) — `guardrails`/`guardrail_sets`/`guardrail_set_members` move into their own schema; row counts and a spot-check of real rows verified against the Phase 0 baseline. Schema-isolation check (§10.2) added and passing for guardrail-service.
- **DoD**: `full-journey.spec.ts` from Phase 0 still green, now partially routed through the new service; guardrail-specific specs, the OpenAPI validation step, and the schema-isolation/migration checks all green in CI.

### Phase 2 — issue #103 (usage-service, reactive pilot)

This is the highest-priority k6 work in the whole plan — the reactive rewrite's go/no-go decision (`docs/MICROSERVICES_PLAN.md` §7 risk: "R2DBC's tooling gaps prove too costly") should be informed by these numbers, not just a subjective feel for whether it works.

- **SDET B — primary k6 scenario**, proposed default thresholds (confirm/override once you have real traffic data; nothing here is contractual yet):

  | Scenario | Stages | Threshold |
  |---|---|---|
  | `usage-ingest-smoke.js` | 1 VU, 1 iteration | Runs in PR CI as a fast sanity check — functional pass/fail, not a load test |
  | `usage-ingest-load.js` | ramp 0→50→200 VUs, hold 200 for 5m, ramp down | `p(95)<200ms`, `p(99)<500ms`, `http_req_failed rate<0.001` |
  | `usage-ingest-spike.js` | sudden jump to 400 (2×) for 30s | Same latency thresholds; confirms no cascading failure, not a strict pass gate |

  Run `usage-ingest-load.js` against both the old (blocking, monolith) and new (WebFlux/R2DBC) implementations if both are reachable during the transition — the comparison is the actual deliverable for the go/no-go call, not the absolute numbers.
- **SDET B**: `usage.spec.ts` — Playwright API tests against the reactive service; note `WebTestClient`-style async behavior does not change anything from the *client's* perspective, so the Playwright spec itself does not need special handling, but do add a test for the batched-envelope validation behavior (`{"events": [...]}`, all-or-nothing rejection) since that is easy to regress silently.
- **SDET A**: `usages-data.spec.ts` — KPI tiles and the daily-calls chart render correctly against seeded multi-day usage data.
- **SDET B**: `usage_events` data-migration checklist (§10.4) run the same way as Phase 1's; if Flyway does not run cleanly against the reactive (R2DBC) datasource, note the workaround explicitly in `tests/db/migration-checklist.md` rather than solving it silently — the next service to hit this should not have to rediscover it.
- **DoD**: k6 comparison numbers documented (old vs new implementation) and attached to the Phase 2 issue before it is marked done; `usage.spec.ts`, `usages-data.spec.ts`, and the usage schema migration checklist green.

### Phase 2.5 — issue #104 (graphql-bff)

- **SDET B**: add a `/graphql` variant of the dashboard-overview flow to `full-journey.spec.ts` (or a new `graphql.spec.ts`) and assert its response matches what the equivalent individual REST calls return — this is the parity check called out in `docs/MICROSERVICES_PLAN.md` §6.4.
- **SDET B**: a light k6 scenario here is less about raw throughput and more about confirming the DataLoader batching actually batches under concurrency — assert via response time (a resolver N+1 regression shows up as a multiplying latency curve as VUs increase) rather than a hard RPS target.
- **SDET A**: no new UI spec needed yet unless the dashboard overview screen starts consuming `/graphql` in this phase — if it does, extend `dashboard.spec.ts` rather than adding a new file.

### Phase 3 — prompt-manager-service (+ provider) — issue TBD

- **SDET A**: `prompt-manager.spec.ts` — library, version timeline (promote through draft → testing → active), editor, playground panel.
- **SDET B**: playground endpoint tests including provider-timeout and provider-error simulation. **Mock/stub the LLM provider for all automated tests and all k6 load runs** — do not let CI or load tests hit real Anthropic/OpenAI endpoints; that is a cost and rate-limit risk, and Spring AI's `ChatClient` is already designed to be swapped for a test double (the existing unit tests already mock the runner/factory per `docs/DEVLOG.md`; extend the same approach here rather than introducing a new pattern).
- **SDET B**: version-promotion state-machine edge cases (no skipping "testing," re-promoting a stale version) as API tests, not just backend unit tests — this is exactly the kind of cross-layer behavior an E2E suite exists to catch.
- **SDET B**: `prompts`/`prompt_versions` data-migration checklist (§10.4).

### Phase 4 — user-management-service (+ project) — issue TBD

- **SDET A**: `user-manager.spec.ts` — invite flow, accept-invite, API key create (show-once secret) and revoke.
- **SDET B**: CRUD tests for users/API keys/projects, plus one **security-regression test that matters more than it looks**: assert the gateway does *not* expose `/internal/**` (the `verify-credentials` and `projects/{id}` internal endpoints) to external callers. This is the one place two new services trust each other directly instead of going through the gateway's normal auth path — worth a standing negative test, not a one-time manual check.
- **SDET B**: `users`/`api_keys`/`project_memberships`/`projects` data-migration checklist (§10.4). This phase is also where the cross-service orphaned-data policy (§10.3, open item #5) needs to be resolved — `user-management-service` now owns the identity/tenancy table every other domain references by scalar ID, so it is the natural owner of whatever cascade/tombstone behavior gets decided.

### Phase 5 — authentication-service — issue TBD

- **SDET B**: full auth-flow coverage — login, refresh, logout, invite/accept-invite, cookie attributes (`httpOnly`, `SameSite`), expired-token handling, tampered-token rejection. These are functional correctness tests, not a penetration test, but they are the closest thing this plan has to security testing — call this out explicitly as in-scope here rather than assuming a separate security review covers it.
- **SDET B**: k6 scenario on the login endpoint plus a mixed-endpoint scenario measuring the gateway's added JWT-validation overhead now that it is validating every request centrally (`docs/MICROSERVICES_PLAN.md` §3.2) — this is the first point in the migration where the gateway is doing real per-request work beyond routing, worth its own number.
- **SDET A**: no new UI spec — `user-manager.spec.ts` from Phase 4 already exercises login/invite through the browser; re-run it here to confirm nothing changed from the caller's perspective.

### Phase 6 — decommission `api-server` — issue TBD

- **Joint**: full regression — every Playwright UI and API spec green against gateway-only routing, `api-server` fully out of the loop.
- **SDET B**: `full-journey-load.js` — the one full-journey k6 scenario across all five services, run as the final performance gate before sign-off, referenced directly by `docs/MICROSERVICES_PLAN.md` §10 open decision #4 (100% traffic on new routes for 7 days, tracked on the Grafana cutover dashboard).
- **Joint**: remove/update any test still pointing at internal port `:8090` or asserting `api-server`-specific behavior.
- **Joint**: if physical DB split (separate Postgres instances per service, `docs/MICROSERVICES_PLAN.md` §10 open decision #3) happens around this phase, run the validation in §10.6 — each service boots and migrates cleanly against its own instance, and the schema-isolation check in §10.2 still passes.

## 7. Playwright — Setup & Best Practices

- **Auth**: log in once via `fixtures/auth.ts`, save `storageState`, reuse it across specs instead of logging in through the UI in every test — standard Playwright pattern, and the difference between a 2-minute and a 20-minute suite run at this spec count.
- **Test data isolation**: each spec (or each `test.describe` block) creates its own project via the API in a `beforeAll`/fixture, and cleans it up after — never assume a shared "demo project" state, since both of you running suites concurrently against the same local stack will otherwise collide. The existing Flyway seed (`R__01_seed_local_dev.sql`, `admin@aiplane.local`) is for manual local dev, not for automated test isolation — do not build tests against its specific seeded rows.
- **API specs**: use Playwright's `request` fixture/context directly — no browser startup cost, much faster than routing API checks through UI actions. This is why the split in §4 matters: SDET B's suite should never need a browser at all.
- **Retries & tracing**: `retries: 2` on CI, `0` locally (a test that only passes on retry locally is a bug, not a flaky-CI problem); `trace: 'on-first-retry'` so a CI failure comes with a debuggable trace instead of a bare stack trace.
- **Tagging**: tag specs `@smoke` (fast subset, safe to consider for the required `ci` job later) vs `@regression` (full suite, PR-path-filtered + nightly only) using Playwright's `--grep`. Do not run the full suite on every commit — matches the pyramid framing in §3.
- **Page objects**: one per MFE for UI specs (`fixtures/pages/prompt-manager.page.ts` etc.) once `prompt-manager.spec.ts` and friends have more than a couple of tests each — do not over-engineer this on day one with only smoke specs.
- **Accessibility (recommended, not required for v1)**: `@axe-core/playwright` run against each MFE's main screen is a cheap addition once the UI specs exist — flag it to the team as a fast-follow rather than blocking Phase 0-1 on it.

## 8. k6 — Setup & Best Practices

- **No npm dependency management at runtime.** k6 scripts are JavaScript but execute inside k6's own Goja-based runtime, not Node — you cannot `import` an arbitrary npm package the way Playwright specs can. Shared logic (`lib/auth.js`, `lib/data.js`) uses plain JS modules imported via relative path (k6 supports local ES module imports), not `node_modules`. If you need a capability k6 does not ship (e.g. a specific protocol), that is an `xk6` extension/custom binary decision — flag it rather than reaching for an npm package that will not resolve.
- **Three tiers, three cadences** (already reflected in §6's Phase 2 table): *smoke* (1 VU, 1 iteration, every PR touching `backend/**`, must pass, fast), *load* (ramping VUs, sustained hold, nightly only, thresholds enforced via k6's built-in `thresholds` config so a threshold breach fails the run automatically), *spike* (sudden traffic jump, scheduled/manual, informational rather than a hard gate). Consider adding a *soak* run (steady load for 30–60 minutes) on a weekly cadence once Phase 2 stabilizes — this is what catches connection-pool exhaustion and memory leaks that a 5-minute load test cannot, and is a standard "production grade" addition worth planning for even if it does not start on day one.
- **Auth once per run, not per VU**: fetch a token/cookie in k6's `setup()` function and pass it to every VU, rather than each virtual user logging in independently — logging in per-VU would make you load-test the login endpoint by accident while trying to load-test something else.
- **Never hit real LLM providers.** Same rule as Playwright's Phase 3 guidance (§6) — any k6 scenario touching the playground endpoint must run against a stubbed/mocked provider (WireMock or a test-profile Spring AI double), never Anthropic/OpenAI directly. Cost and provider-side rate limits make this a hard rule, not a suggestion.
- **Reuse the observability stack you are already building.** `docs/MICROSERVICES_PLAN.md` §9 stands up Prometheus + Grafana in Phase 0 for the services themselves — k6 can push its own metrics to the same Prometheus via the `xk6-output-prometheus-remote` output, so load-test results show up in the same Grafana instance instead of a separate dashboard. Worth wiring once Phase 0's observability stack exists, rather than building k6 a dashboard of its own.
- **Where results live**: k6's built-in summary (JSON + a simple HTML/text report) uploaded as a CI artifact for smoke runs; full load/spike run output goes to Grafana per the point above once that pipeline exists, with the JSON summary still checked as a CI artifact in the meantime.

## 9. Contract Testing

Default is lightweight, per `docs/MICROSERVICES_PLAN.md` §6.3: `contract/validate-openapi.sh` starts each service, exercises its live endpoints, and validates responses against its own committed OpenAPI schema — catches "the code no longer matches the contract" without a consumer-driven contract broker. SDET B adds this CI step the same PR that introduces each service's frozen OpenAPI spec (§5 of the migration plan), not as a separate follow-up.

Escalate to Spring Cloud Contract only once a second independent consumer of a service's contract exists (an internal service-to-service call, or an external project like News Radar) — this is an explicit open decision in the migration plan (§10, item 2), not a default to build ahead of need.

## 10. Database Testing

Distinct from the backend integration tests already covered in §2 — `AbstractPostgresIntegrationTest` + Testcontainers already verifies repository-level correctness against a real Postgres, per service, and that does not change here. This section is about what the **migration itself** puts at risk at the database layer: schema separation, referential integrity now that domains only share plain scalar IDs instead of database-level foreign keys, and the one-time data moves each phase performs. Mostly backend-owned work — SDET B's job is verifying it is actually tested, not necessarily writing every Flyway script.

### 10.1 Migration correctness (extends the existing pattern)

Every extracted service gets its own `AbstractPostgresIntegrationTest`-style base class (§2) running its own Flyway migrations, not just `api-server`'s. Add an explicit CI check that migrations validate cleanly (`spring.flyway.validate-on-migrate`, already the Spring Boot default — confirm it stays on) so a checksum-mismatched migration fails fast in CI rather than surfacing at deploy time. If a service's Flyway migrations behave differently against a reactive (R2DBC) datasource than the blocking JDBC one `usage-service` is replacing, document the gap explicitly (`tests/db/migration-checklist.md`) rather than solving it silently — R2DBC's migration tooling is genuinely thinner than JPA's, per `docs/MICROSERVICES_PLAN.md` §7.

### 10.2 Schema isolation enforcement

`docs/MICROSERVICES_PLAN.md` §3.5 states "no cross-schema SQL, ever" as a code-review rule. Turn that into an automated check rather than relying on review discipline alone: `tests/db/check-schema-isolation.sh` scans each service's migrations and JPA/JdbcTemplate SQL for another service's schema name (e.g. `guardrail.` appearing anywhere inside `usage-service`'s codebase) and fails CI if found. Also worth a companion check that each service's datasource config only ever points at its own schema — a misconfigured connection string is a more likely real-world failure than someone hand-writing a cross-schema join.

### 10.3 Referential integrity / orphaned-reference testing

Every cross-domain reference in this codebase is a plain scalar ID (`project_id`, `prompt_id`, `api_key_id`) rather than a JPA `@ManyToOne` — confirmed against the actual entity fields, not assumed. That was a non-issue in the monolith (one schema, informal consistency); it becomes a real one the moment `user-management-service` and, say, `usage-service` have separate schemas or databases, since nothing at the database level stops a `usage_event` from outliving the `project` it references.

This needs a product decision before it needs a test: does deleting a project cascade to dependent prompt/guardrail/usage data (via an event or internal call), soft-delete/tombstone it, or is orphaned data simply tolerated? `docs/MICROSERVICES_PLAN.md` does not currently specify this — tracked as a new open item below rather than assumed here. Once decided, the test is API-level, not a direct cross-schema query (which would itself violate §10.2): create a project, create dependent records referencing it, delete the project through the API, then assert the decided behavior within a defined window.

### 10.4 Data-migration validation (per phase, one-time)

Every phase that moves tables from the monolith's single schema into a service's own schema (Phase 1 guardrail, Phase 2 usage, Phase 3 prompt, Phase 4 identity) is a one-time move that needs a checklist, not just "run it and hope": per-table row-count match before/after against the Phase 0 baseline snapshot, a spot-check of actual row contents (a matching count with silently corrupted data is worse than an obvious failure), and a rehearsal against a copy of realistic-shaped data before it runs for real. The backend dev doing the extraction drives the move; SDET B verifies the checklist in `tests/db/migration-checklist.md` and signs off before the phase is marked done (§13).

### 10.5 Query performance review

Not a separate automated suite — a manual `EXPLAIN ANALYZE` pass on any new query added during an extraction, especially on `usage-service`'s ingest path, where R2DBC does not have Hibernate's query-stats tooling and a missing index is easy to miss by default. If a k6 load run (§8) shows p95 creeping up with no obvious application-layer cause, this is the first place to look before assuming the reactive stack itself is the problem.

### 10.6 Physical DB split validation (later)

Once a service moves from a shared-instance schema to its own physical Postgres instance (`docs/MICROSERVICES_PLAN.md` §10 open decision #3), the test is mostly configuration correctness rather than new business logic: the service boots and runs its Flyway migrations cleanly against a fresh instance, connection-pool sizing is still sane at the new network hop, and the §10.2 isolation check still passes — trivially, since there is no longer a shared instance to cross into.

## 11. Test Data Strategy

- **Local dev seed** (`R__01_seed_local_dev.sql`, demo projects + `admin@aiplane.local`/`changeme`) is for humans clicking around locally — automated tests must not depend on its specific rows, since it can change independent of this plan.
- **Playwright**: each spec provisions its own project/user via the API before running and tears it down after (§7). Use `fixtures/ids.ts` for collision-safe naming (timestamp + random suffix) so parallel Playwright workers never collide on a project slug.
- **k6**: each VU/iteration generates its own unique payload (via `lib/data.js`) rather than reusing one fixed request body — hitting the same `project_id`/prompt repeatedly at 200 RPS will exercise very different code paths (lock contention, cache hits) than realistic traffic would.
- **Cleanup**: prefer API-driven teardown (delete the test project, cascades to its prompts/guardrails/usage rows) over relying on Testcontainers' natural container-per-run isolation, since Playwright/k6 run against a long-lived docker-compose stack, not a fresh container per test the way backend integration tests do.

## 12. CI/CD Integration

- Leave the existing `ci` (required) and `backend` (not required) jobs exactly as they are — do not add Playwright or k6 into either.
- New `e2e.yml`: runs `@smoke`-tagged Playwright specs on every PR touching `backend/**` or `docker-compose*.yml`; runs the full `@regression` tag nightly against `main`. Not a required check at first — promote it to required once it has run stably for a couple of weeks, the same rollout approach this repo already used for its own test-execution CI step (`docs/DEVLOG.md`/`ISSUE_WORKFLOW.md` hygiene issues #47–#49 added tests before making them required).
- New `load.yml`: k6 smoke scenario on the same PR-path trigger as `e2e.yml` (fast, must pass); full load/spike scenarios on a nightly or manual-dispatch trigger only — never a required merge check, since a 5-minute sustained load run has no place blocking someone's PR.
- Both new workflows upload their reports (Playwright HTML report, k6 JSON summary) as build artifacts, matching the existing `frontend-coverage`/`backend-jacoco-coverage` artifact pattern already in `ci.yml`.

## 13. Definition of Done — Per Phase

A phase's test coverage is done when: the relevant Playwright UI and/or API specs are green in CI (not just locally), any new service has its `contract/validate-openapi.sh` and `check-schema-isolation.sh` checks passing, its data-migration checklist (§10.4) is signed off, k6 numbers (where applicable per §6) are recorded and attached to the phase's GitHub issue, and `full-journey.spec.ts` still passes end to end. Do not mark a migration phase issue complete (per the epic checklist on #100) until its corresponding test-plan checklist here is also complete — treat this document as an equal gate to the backend/frontend implementation work, not an afterthought.

## 14. Open Items — Confirm With the Team

| # | Question | Default assumed above |
|---|---|---|
| 1 | Exact k6 thresholds for `usage-ingest-load.js` (§6, Phase 2) | Proposed defaults (`p95<200ms`, `p99<500ms`, error rate `<0.1%` @ 200 RPS) — confirm once real traffic data exists |
| 2 | Who owns promoting `e2e.yml`/`load.yml` from non-required to required checks, and when | Joint decision after a stable run history; no fixed date set here |
| 3 | Provider-mocking approach for Phase 3 playground tests — WireMock vs a Spring AI test double | Recommend reusing the existing mocked-runner pattern from current unit tests rather than introducing WireMock, unless a real HTTP-level mock proves necessary |
| 4 | Soak-test cadence (§8) | Proposed weekly, starting after Phase 2 stabilizes — not committed |
| 5 | Cross-service orphaned-data policy once project/prompt/user records can be deleted independently of usage/guardrail data (§10.3) | Not yet decided — blocks the referential-integrity test in §10.3 from being written until resolved. Needs a product/backend decision, not just a test-plan default. |
| 6 | Physical DB split validation ownership (§10.6) | Proposed: same joint sign-off pattern as the §10.4 per-phase migration checklist — backend devs execute, SDET B verifies |

## 15. References

- `docs/SDET_AI_WORKFLOW.md` — how the two of you work with Claude Code to build everything in this plan: briefing templates, the human review checklist, and hard guardrails. Read this alongside §6 of this document, not instead of it.
- `docs/MICROSERVICES_PLAN.md` — architecture, phased rollout, OpenAPI/contract-testing/observability design this plan is built against
- `docs/SPEC.md`, `docs/DEVLOG.md` — product spec and engineering decision history
- `docs/ISSUE_WORKFLOW.md` — issue/branch/PR conventions this plan's phases follow
- GitHub epic **#100** and phase issues **#101–#104** (Phases 3–6 issues pending)
- `scripts/create_microservices_migration_issues.sh` — how the phase issues above were filed
- `.cursor/rules/e2e-testing.mdc`, `.cursor/rules/load-testing.mdc`, `.cursor/rules/database-testing.mdc` — Playwright, k6, and database-testing conventions from §7/§8/§10 of this document, packaged so Claude Code picks them up automatically per-file, the same way `.cursor/rules/frontend-testing.mdc`/`backend-testing.mdc` already work for Vitest/JUnit

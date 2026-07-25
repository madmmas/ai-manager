# AIPlane — Microservices Migration Plan (Strangler Fig)

Companion to `docs/SPEC.md` (product spec) and `docs/DEVLOG.md` (decision journal). This document plans the transition of `backend/api-server` — a modular monolith with Phases 0–5 shipped — into five independently deployable services behind a gateway, using the Strangler Fig pattern. Written 2026-07-25, before any extraction PR lands.

## 1. Goals

- Extract `prompt-manager`, `usage`, `guardrail`, `user-management`, and `authentication` as standalone Spring Boot services, each reusable by other projects (the way `config-server` is already consumed by News Radar — see `docs/integrations/news-radar-config-server.md`).
- Each service is Clean Architecture internally (domain / application / infrastructure / interfaces layers), OpenAPI-first, and independently testable.
- Zero-downtime, incremental cutover via Strangler Fig: a gateway sits in front of both the legacy monolith and the new services, routing by path, so extraction happens one domain at a time without a big-bang rewrite.
- Reactive stack is applied selectively (see §3.1) — mixed mode, not blanket WebFlux/R2DBC adoption.
- Read-heavy, multi-service frontend views get a GraphQL aggregation layer where it genuinely reduces round-trips (§8).
- The migration is observable from Phase 0 onward (§9), since it's the strangler pattern itself that turns single-process debugging into distributed-request debugging.

## 2. Target Architecture

### 2.1 Service map

| Service | Port | Stack | Owns (Flyway tables) | Reads (via internal API) |
|---|---|---|---|---|
| **gateway** | 8080 | Spring Cloud Gateway (WebFlux, reactive by nature) | — | routes to all services |
| **guardrail-service** | 8083 | Spring MVC + JdbcTemplate (unchanged) | `guardrails`, `guardrail_sets`, `guardrail_set_members` | none |
| **usage-service** | 8082 | **WebFlux + R2DBC** (reactive pilot) | `usage_events` | none (see §4, Phase 2 decoupling) |
| **prompt-manager-service** | 8081 | Spring MVC + JPA (unchanged) | `prompts`, `prompt_versions` | `user-management` (project slug lookup) |
| **user-management-service** | 8084 | Spring MVC + JPA (unchanged) | `users`, `api_keys`, `project_memberships`, `projects` | none |
| **authentication-service** | 8085 | Spring MVC (unchanged) | (no tables of its own — see §3.2) | `user-management` (`verify-credentials`, internal-only) |
| **graphql-bff** | 8086 | Spring for GraphQL + WebFlux (reactive fan-out) | none | all 5 services, parallel + DataLoader-batched (see §8) |
| **config-server** | 8888 | unchanged | `config_properties` | none — untouched by this plan |
| legacy `api-server` | 8090 (internal only) | unchanged | shrinking subset of the above | — |

Observability infrastructure (§9) runs alongside these as platform services, not domain services:

| Component | Local port | Role |
|---|---|---|
| `otel-collector` | 4317 (OTLP gRPC), 4318 (OTLP HTTP) | Receives traces from every service, forwards to Jaeger |
| `prometheus` | 9090 | Scrapes each service's `/actuator/prometheus` |
| `jaeger` | 16686 (UI) | Distributed trace storage/UI, native OTLP ingestion |
| `loki` | 3100 | Log aggregation |
| `promtail` | — | Tails container logs, ships to Loki |
| `grafana` | 3000 | Dashboards; Explore view correlates Prometheus + Loki + Jaeger by `trace_id` |

`gateway` takes over port **8080**, which is what the UI's `VITE_API_URL` already points to — this is deliberate. It means the external contract never changes during the migration; only the frontend's `docker/nginx.conf` and `docker-compose.yml` upstream wiring change, not `apps/*` code.

### 2.2 Topology

```
                         ┌────────────────────────────┐
Client (UI :5173,        │   gateway :8080 (WebFlux)   │
Playwright, News Radar,  │   - JWT/API-key validation  │
other projects)  ───────▶│   - routes by path prefix   │
                         │   - aggregates /v3/api-docs │
                         └───────────┬────────────────┘
                                     │
   ┌───────────────┬───────────┬────┼──────┬─────────────────┬───────────────┐
   ▼               ▼           ▼    ▼      ▼                 ▼               ▼
guardrail-svc  usage-svc  prompt-mgr-svc  user-mgmt-svc  authentication-svc  graphql-bff
  :8083          :8082       :8081          :8084             :8085            :8086
(MVC/JDBC)    (WebFlux/     (MVC/JPA)      (MVC/JPA)      (MVC, stateless,   (WebFlux,
               R2DBC)                                      calls user-mgmt    fans out to
                                                             internally)       the 5 services
                                                                               via WebClient)
   │               │           │               │                 │
   └───────┬───────┴───────────┴───────┬───────┴─────────────────┘
          ▼                           ▼
   Postgres (schema-per-service:   config-server :8888
   guardrail.*, usage.*,           (unchanged, untouched)
   prompt.*, identity.*)
                                legacy api-server :8090
                                (internal-only, shrinks each
                                 phase, gateway's default route
                                 until fully decommissioned)

   Every application service above also exports OTLP traces to
   otel-collector:4317 and exposes /actuator/prometheus — see §9.
```

Service-to-service and gateway-to-service routing uses plain Docker Compose DNS (service names on the shared network) — the same mechanism `api-server` already uses to reach `postgres` and `config-server` today. No separate discovery registry is part of this plan.

### 2.3 Clean Architecture package template (applies to every new service)

The current codebase is package-by-feature but framework-coupled (controllers/services/repositories sit together, entities carry JPA annotations directly). Extraction is the natural point to also move each service to ports-and-adapters, rather than doing a separate restructuring pass first:

```
<service>/src/main/java/dev/madmmas/aiplane/<service>/
├── domain/            Entities & value objects — no Spring/JPA/framework imports.
│                       e.g. Prompt, PromptVersion, PromptVersionStatus as plain Java.
├── application/        Use cases (one class per operation: CreatePrompt, PromoteVersion,
│                       RunPlayground). Depends only on domain + port interfaces it declares.
│                       This is where today's *Service.java business logic moves.
├── infrastructure/
│   ├── persistence/    JPA/JdbcTemplate/R2DBC repository implementations of the
│                       application-layer port interfaces. Framework-specific mapping lives here.
│   ├── client/          Outbound calls to other services (e.g. prompt-manager's
│                       ProjectLookupClient calling user-management's internal API).
│   └── config/          Spring @Configuration, security, OpenAPI, observability beans.
└── interfaces/
    ├── rest/            @RestController classes — thin, map HTTP <-> application layer DTOs.
    └── dto/              Request/response records, generated-or-validated against the
                          service's OpenAPI contract (§5).
```

This is a real rewrite of the internal wiring per service, not a lift-and-shift of the current packages. Budget for it explicitly in each phase's estimate rather than assuming extraction is copy-paste.

## 3. Cross-Cutting Decisions

Per the project's own DEVLOG convention, decisions and trade-offs are made explicit here rather than left implicit.

### 3.1 Reactive scope — mixed mode

`gateway` (reactive by default via Spring Cloud Gateway), `usage-service`, and `graphql-bff` run WebFlux + R2DBC / reactive WebClient. `prompt-manager`, `guardrail`, `user-management`, `authentication` stay on the current blocking stack (Spring MVC + JPA/JdbcTemplate) — they're CRUD-shaped and low-QPS, so the same code that runs today just moves into new modules. `usage-service` is the one write-heavy ingest path where non-blocking I/O has a real payoff; `graphql-bff` is a fan-out/aggregation service (parallel calls to up to five backends per request) — a distinct, equally valid reactive use case.

### 3.2 Splitting authentication from user-management

Today, `security` (JWT/API-key filters, `UserDetailsServiceImpl`) directly imports `user` in-process. Splitting them into two deployables requires a decision on who owns the `users` table and how login verification crosses the boundary.

**Decision:** `user-management-service` owns `users`, `api_keys`, `project_memberships`, and `projects` — it's the single source of truth for identity and tenancy. `authentication-service` owns no tables. On login, it calls an **internal-only** endpoint on user-management, `POST /internal/users/verify-credentials`, to check the password hash and get `{userId, roles}`, then signs the JWT itself (owns `JwtTokenProvider`, the signing key, and the `aiplane_access`/`aiplane_refresh` httpOnly cookie logic already built in Phase 4).

To avoid a network round-trip to authentication-service (and from there to user-management) on *every* authenticated request, the **gateway** validates the JWT signature itself (shared secret or JWKS, per open decision in §10) and forwards a trusted `X-Aiplane-User-Id` / `X-Aiplane-Roles` header downstream. Services trust that header only because the gateway is the sole ingress. Only login/refresh/invite/accept-invite call authentication-service directly, and only authentication-service calls user-management's internal endpoint — this keeps the hot path (every other request) to a single JWT signature check at the edge, no service call.

### 3.3 Where `project` lives

`project` currently has zero dependents needing anything beyond the opaque `project_id` string — confirmed by import-graph inspection: `guardrail` and `usage` never import `project` at all; only `prompt` (via `PromptConfigExporter`, for the project *slug* used in Config Server keys) and `user` need real project data.

**Decision:** fold `project` into `user-management-service` (tenancy sits naturally next to identity/membership) rather than standing up a sixth service. `prompt-manager-service` gets a small `ProjectLookupClient` calling `GET /internal/projects/{id}` on user-management, used only during version-promotion config export — a low-volume, cacheable call, not a hot path.

### 3.4 Decoupling `usage` from `prompt` and `provider`

`usage` currently imports `dev.madmmas.aimanager.prompt.LlmProvider`/`LlmProviderConverter` (an enum: Anthropic/OpenAI/Azure OpenAI) and `dev.madmmas.aimanager.provider.CostRateRegistry` (reads `aiplane.cost-rates.rates` from `application.yml`, computes cost-on-ingest). Both must be resolved before `usage-service` can be extracted independently of `prompt-manager-service`:

- **`LlmProvider` enum** → move to a small shared kernel module (`common-contracts`, a plain Java/no-Spring jar both services depend on at compile time). It's industry vocabulary, not business logic — safe as a shared, rarely-changing compile-time dependency rather than a network call.
- **`CostRateRegistry`** → move *into* `usage-service` directly, along with the `aiplane.cost-rates.rates` config block. It's cost-computation logic that happens to live under `provider` today; it has exactly one caller (`UsageService`) and no reason to live anywhere else once separated.

After this, `usage-service` has zero runtime dependency on `prompt-manager-service` or a `provider` package — the remaining `provider` code (`LlmProviderFactory`, `SpringAiPromptPlaygroundRunner`, Spring AI `ChatClient` wiring) folds into `prompt-manager-service` as its own `provider` sub-package, since playground-run is its only caller.

### 3.5 Data ownership during the transition

Stay on the single Postgres instance used today, but move to **schema-per-service** as the first step of every extraction phase (`guardrail.*`, `usage.*`, `prompt.*`, `identity.*`), enforced by convention (no cross-schema SQL joins, ever — even while physically co-located) before any physical DB split. Physical separation (separate Postgres instances/clusters) is a later, lower-risk step once each service has proven stable on its own schema — see open decision in §10.

## 4. Strangler Fig Rollout

Seven phases. Each phase after Phase 0 ends with a working system where the extracted domain's traffic flows entirely through the new service and the equivalent code path in the legacy `api-server` can be deleted — that deletion is part of "done," not a follow-up.

**Phase 0 — Gateway passthrough + observability baseline (no behavior change).**
Stand up `gateway` on 8080, `api-server` moves to internal port 8090. Gateway's only route for now: `/** → api-server:8090`, pure reverse proxy, zero routing logic. Move JWT/API-key validation here in this phase (§3.2) since it's needed regardless of what's behind it. In the same phase, stand up the observability stack (§9) — `otel-collector`, `prometheus`, `jaeger`, `loki`, `promtail`, `grafana` — and instrument `gateway` + `api-server` first, so every later extraction is observable from the moment it starts routing real traffic, not retrofitted after the fact. Verify nothing changed for the UI or News Radar by re-running the existing test suite plus a new Playwright smoke pass (§6.4) against this passthrough setup — this is the baseline that every later phase is diffed against.

**Phase 1 — `guardrail-service` (strangler pilot).**
Chosen first because the import-graph analysis showed **zero coupling** to any other domain — lowest-risk proof of the whole pattern (gateway routing, OpenAPI, Testcontainers, Playwright, schema-per-service, tracing) before touching anything coupled. Move `guardrail.*` tables to their own schema, stand up the service on 8083 with the Clean Architecture layout (§2.3), gateway adds `/api/v1/guardrails/**` and `/api/v1/guardrail-sets/** → guardrail-service`, delete the equivalent controllers/services from `api-server`.

**Phase 2 — `usage-service` (reactive pilot).**
Do the decoupling in §3.4 first (as its own PR, before extraction — it's valuable even if extraction were cancelled). Then stand up on 8082 with WebFlux + R2DBC, `usage.*` schema, gateway routes `/api/v1/usage/**`. This is the phase most likely to surface reactive-stack surprises (R2DBC migration tooling, WebTestClient vs MockMvc in tests) — treat it as the spike that validates the mixed-mode reactive approach before `graphql-bff` follows the same pattern.

**Phase 2.5 — `graphql-bff`.**
Not an extraction from the monolith — a new aggregation service. Stand it up once guardrail and usage are both live behind the gateway, so there's a real cross-service view to aggregate (dashboard overview: prompt counts + usage KPIs + guardrail set status in one query). Can land in parallel with Phases 3–5 without blocking them; see §8 for scope.

**Phase 3 — `prompt-manager-service` (+ `provider`).**
Depends on user-management's project-slug lookup (§3.3), so should follow Phase 4 in strict dependency order — but since that dependency is a single low-volume cacheable call, it's fine to build `ProjectLookupClient` against a contract/mock first and extract prompt-manager in parallel with or just before user-management if that's operationally more convenient. Owns `prompts`, `prompt_versions`, folds in the Spring AI playground integration. Gateway routes `/api/v1/prompts/**`.

**Phase 4 — `user-management-service` (+ `project`).**
Owns `users`, `api_keys`, `project_memberships`, `projects`. Exposes the internal `verify-credentials` and `projects/{id}` endpoints used by Phases 3 and 5. Gateway routes `/api/v1/users/**`, `/api/v1/api-keys/**`, `/api/v1/projects/**`.

**Phase 5 — `authentication-service`.**
Last of the five extractions, and deliberately after user-management since it depends on it synchronously (§3.2). Owns `JwtTokenProvider`, login/refresh/logout, invite/accept-invite. Gateway routes `/auth/**` here instead of validating everything itself at this point — gateway keeps doing signature validation on already-issued tokens, but issuance/rotation moves fully to this service.

**Phase 6 — Decommission `api-server`.**
Once all five domains are cut over, `api-server` should have nothing left in it beyond `actuator/health` and whatever hasn't been decided about (§10). Remove it from `docker-compose.yml`, retire port 8090, gateway's default route disappears — every path now has an explicit owner. The "strangler cutover" Grafana dashboard from §9 is what confirms each phase is ready for this step.

## 5. OpenAPI-First Workflow

"OpenAPI-first" here means **generate-then-freeze**, not hand-authored-before-code: hand-maintaining a spec in parallel with Spring annotations is a drift magnet the moment two people touch the same endpoint in the same sprint.

- Each service uses `springdoc-openapi-starter-webmvc-ui` (blocking services) or `springdoc-openapi-starter-webflux-ui` (`usage-service`, `gateway`) to generate its spec from annotated controllers at build time.
- The generated spec is committed to `<service>/src/main/resources/openapi/<service>.yaml` as the frozen contract. CI fails the build if the freshly generated spec differs from the committed one and the PR doesn't include an explicit spec update — this is the "first" part: contract changes are a visible, reviewable diff, not a silent side effect of an annotation change.
- Gateway proxies each service's `/v3/api-docs` and aggregates them into one Swagger UI at `gateway:8080/swagger-ui.html` — a single discovery point, which matters directly for the "other projects reuse this" goal (News-Radar-style consumers get one URL instead of five). `graphql-bff` publishes its schema (SDL) alongside this for the frontend team, but is not part of the external OpenAPI catalog (see §8).
- Publish the committed specs under `docs/api/<service>.yaml` in this repo, mirroring the existing `docs/integrations/` convention, so external consumers have a stable doc location independent of any running instance.
- Frontend: introduce `openapi-typescript` (or `orval`) to generate request/response types and fetch functions from each service's spec into `packages/api-client`, keeping the existing hand-written React Query hook layer (`context.tsx`, `hooks/use-*.ts`) on top — reduces drift between `packages/types` and the real backend DTOs without discarding the current hook API frontend code already depends on. GraphQL queries get their own generated types via `graphql-codegen` once `graphql-bff` exists.

## 6. Testing Strategy

### 6.1 Pyramid (per service)

```
        /  E2E (Playwright)         \   few, slow, cross-service confidence
       /  Contract (OpenAPI schema)  \  some, per service-pair boundary
      /   Integration (Testcontainers) \ per service, HTTP + DB layer
     /       Unit (JUnit/Vitest)         \ many, fast — unchanged from today
```

Unit testing doesn't change — it's already in place per domain. The new layers are integration-per-service, contract, and Playwright e2e.

### 6.2 Integration testing

Reuse the existing `AbstractPostgresIntegrationTest` pattern (static Testcontainers Postgres, shared across a test class to avoid the container-restart issue already documented in DEVLOG for `guardrail`'s ITs) — one such base class per service, each spinning up only its own schema's Flyway migrations. `usage-service` needs the WebFlux equivalent (`WebTestClient` against a reactive Testcontainers Postgres via R2DBC) rather than `MockMvc`. `graphql-bff`'s integration tests mock the underlying REST services (WireMock) rather than standing up all five for every test run.

### 6.3 Contract testing

Start with a CI step per service that starts it, exercises its live endpoints, and validates responses against its own committed OpenAPI schema — catches "the code no longer matches the contract" without standing up separate contract-broker infrastructure. `graphql-bff`'s contract with the frontend is the GraphQL schema itself (SDL) — schema-diff checks in CI (e.g. `graphql-inspector`) serve the same role there. Spring Cloud Contract (already available via the imported `spring-cloud-dependencies` BOM) is the tool to reach for on the gateway↔service boundary specifically once a second independent consumer of a contract exists — see §10 for the exact trigger.

### 6.4 End-to-end and API testing with Playwright

New `tests/e2e` package at the repo root (Playwright config, not tied to any one `apps/*` MFE), running against the full `docker-compose.yml` stack (gateway + all services + UI):

- **UI e2e** — one spec per MFE's critical journey, browser-driven: create prompt → promote version → run playground (prompt-manager); build a guardrail set → evaluate (guardrail); invite user → accept invite → login (user-manager); view usage KPIs (usages-data). Plus one cross-MFE journey through the dashboard host — this is the one thing Vitest/jsdom structurally cannot catch, since Module Federation's runtime remote-loading only really executes in a real browser.
- **API e2e** — Playwright's `request` context hitting `gateway:8080` directly, no browser: login → create prompt → promote → run playground → evaluate against a guardrail set → ingest a usage event → read the summary. This single flow crosses all five services and becomes the primary regression gate before deleting any code path from `api-server` in §4 — run it before and after each phase's cutover and diff the results. Once `graphql-bff` exists, add one query-based variant of this same flow through `/graphql` to verify the aggregation layer matches the underlying REST responses.

Both suites run as their own CI job — slow, few tests, high confidence, per the testing-pyramid framing above — triggered on PRs touching `backend/**` or `docker-compose.yml`, plus nightly against `main`. They do not run on every commit; that's what unit/integration tests are for.

## 7. Risks & Mitigations

WebFlux/R2DBC is new to this codebase (everything else today is blocking JPA/JdbcTemplate) — mitigate by treating Phase 2 as a spike with a hard go/no-go checkpoint: if R2DBC's tooling gaps prove too costly, `usage-service` can fall back to blocking Spring MVC without changing its external contract, since nothing else depends on it being reactive.

Shared Postgres instance during the transition is a real coupling risk even with schema separation — mitigate by enforcing "no cross-schema SQL" as a lint/review rule from Phase 1 onward, not something to clean up "later."

Gateway becomes a single point of failure for every request — mitigate the same way `api-server` is handled today: health-checked in `docker-compose.yml`, kept stateless so it can run more than one instance without session affinity concerns.

JWT trust now spans two new services (gateway validates, authentication-service issues) instead of one process — mitigate by treating the signing key/JWKS exchange with the same explicitness the project already gives CORS (`aiplane.cors.allowed-origins`, never `*`): documented, environment-specific, never a wildcard trust.

Six new observability containers plus `graphql-bff` is real onboarding friction for local dev — mitigate by keeping `docker-compose.dev.yml` able to run a minimal subset (gateway + services + Postgres, no observability stack) for day-to-day feature work, with the full stack reserved for `make docker-up` / CI / anyone actively debugging a cross-service issue.

## 8. GraphQL — Selective BFF, Not a Wholesale Replacement

Worth being precise about what GraphQL actually buys here: its performance win is specifically **fewer round-trips for read-heavy views composed from multiple services**, not a general throughput or latency technology. Used carelessly (resolvers each making their own naive calls) it can be *slower* than REST via the classic N+1 problem — it earns its keep only paired with request-scoped batching.

**Where it helps in AIPlane:** the dashboard host's project-overview screen needs slices of prompt, usage, guardrail, and user data on one view — today that's several sequential/parallel REST calls from the browser to different services through the gateway. Similarly, `usages-data`'s analytics views currently hit four separate `usage-service` REST endpoints (summary, events, cost projection, provider breakdown) with fixed shapes; a flexible query lets the client ask for exactly the fields/date range/grouping it needs in one round trip.

**Implementation:** a new `graphql-bff` service (§2.1, port 8086), Spring for GraphQL on WebFlux, calling the five backend services via reactive `WebClient` with the `java-dataloader` library for per-request batching/deduplication — this is what prevents the N+1 trap. Reactive fits naturally here since a single BFF query can fan out to up to five backends in parallel.

**Scope boundary:** `graphql-bff` is consumed only by AIPlane's own frontend (dashboard, usages-data). External/other-project consumers (News-Radar-style) keep using each service's REST/OpenAPI contract from §5 — a stable, versioned per-service contract matters more for machine-to-machine integration than query flexibility. Write-heavy or fixed-shape paths — usage ingest (already a batched envelope), guardrail evaluation (single-service, latency-sensitive call from the playground), and all of authentication (security-sensitive) — stay on direct REST, not GraphQL.

Gateway routes `/graphql → graphql-bff:8086`; the same JWT/trusted-header auth from §3.2 applies before a request ever reaches the BFF.

## 9. Observability — OpenTelemetry + Prometheus + Jaeger + Loki + Grafana

**Why this can't wait until the end:** today, a request lives entirely inside one JVM, and a stack trace or log line tells the whole story. The moment Phase 1 ships, a single logical operation (e.g. "run playground" → gateway auth check → prompt-manager → cost lookup → usage-service ingest) can span three to five processes. Without distributed tracing, debugging a slow or failing request becomes guesswork across five sets of logs. This is why observability is scheduled in **Phase 0** (§4), not retrofitted after Phase 5 — it's a direct consequence of choosing to split the monolith.

**Instrumentation.** Use Micrometer — Spring Boot 3's native metrics/tracing facade — with `micrometer-tracing-bridge-otel` and `opentelemetry-exporter-otlp`, rather than the standalone OpenTelemetry Java agent. It's more idiomatic for Spring Boot 3.4, and context propagation across `RestClient`/`WebClient`/reactive contexts is already wired by Spring's auto-configuration. Add `micrometer-registry-prometheus` for the `/actuator/prometheus` scrape endpoint — trivial given `spring-boot-starter-actuator` is already a dependency everywhere. Applies to every application service, `gateway`, and `graphql-bff`.

**Pipeline.**

- **Traces**: each service exports OTLP → `otel-collector` → Jaeger (native OTLP ingestion, no extra agent needed). Trace context (W3C `traceparent`) propagates automatically across every hop, including the internal `authentication-service → user-management` call.
- **Metrics**: Prometheus scrapes each service's `/actuator/prometheus` directly, rather than routing metrics through the collector too — fewer moving parts. Track HTTP request rate/latency/error (RED metrics) per service by default, plus a few business metrics worth adding deliberately: guardrail evaluation count and block-rate, usage cost totals, playground call latency by provider.
- **Logs**: structured JSON logs — Spring Boot 3.4's built-in structured logging support (`logging.structured.format.console=ecs` or `logstash`) — with `trace_id`/`span_id` auto-included via Micrometer Tracing's MDC integration. Promtail tails container logs and ships to Loki. This `trace_id` field is what makes the three pillars pay off *together*: a slow request seen in a Grafana metrics panel → click through to its trace in Jaeger → click through to the exact log lines for that `trace_id` in Loki, across however many services it touched.
- **Grafana**: one instance, three datasources (Prometheus, Loki, Jaeger), Explore view wired for `trace_id` correlation. Beyond the generic JVM/RED dashboards, build one purpose-specific panel: a **strangler cutover dashboard** tracking request volume split between legacy `api-server:8090` and each new service, per domain. This turns the decommission trigger in §10 ("100% traffic on the new route for 7 days") from a manual check into a dashboard threshold.

**docker-compose additions**: `otel-collector`, `prometheus`, `jaeger`, `loki`, `promtail`, `grafana` — six new services in the dev stack, following the same healthcheck/`depends_on` pattern already used for `postgres`/`config-server`/`api-server`.

## 10. Open Decisions

| # | Question | Default | Confirm |
|---|---|---|---|
| 1 | JWT signing: shared secret or asymmetric (JWKS) between gateway and authentication-service? | Shared secret for v1 (simpler); JWKS if a second token-issuing service ever appears | ? |
| 2 | Contract testing escalation trigger: adopt Spring Cloud Contract once which condition is met? | Once a second independent consumer (internal service or external project) depends on a service's contract | ? |
| 3 | Physical DB split: per-service as each stabilizes, or all-at-once after all five are extracted? | Per-service, right after that service's Phase stabilizes in production | ? |
| 4 | Decommission trigger for each `api-server` code path | 100% of traffic on the new route for 7 days with the Playwright API-e2e suite green, then delete (tracked on the Grafana cutover dashboard, §9) | ? |
| 5 | `common-contracts` shared kernel (§3.4): separate Maven module in this repo, or its own published artifact for reuse by other projects too? | Separate module in this repo for now; extract to its own artifact only when a second repo needs `LlmProvider` | ? |
| 6 | GraphQL BFF library: Spring for GraphQL or Netflix DGS? | Spring for GraphQL (in-tree Spring Boot 3 support, less to bolt on) | ? |
| 7 | Observability backend for production: self-hosted (this stack) or managed (Grafana Cloud / hosted Jaeger)? | Self-hosted for now; revisit at production scale | ? |

---

*Extraction order: guardrail → usage → graphql-bff → prompt-manager → user-management → authentication → decommission. Observability stands up in Phase 0 and stays on for every subsequent phase. Each phase is a mergeable milestone on its own, following the same issue → branch → PR workflow as `docs/ISSUE_WORKFLOW.md`.*

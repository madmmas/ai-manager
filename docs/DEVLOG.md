# AIPlane — Development Log

A running journal of **engineering decisions, trade-offs, and dead ends**.

This is intentionally separate from [`CHANGELOG.md`](../CHANGELOG.md):

| | CHANGELOG | DEVLOG |
|---|---|---|
| Audience | Users / adopters | Contributors / future-you |
| Answers | *What* shipped (by version) | *Why* we chose it, and what we rejected |
| Tone | Concise, release-oriented | First-person narrative |

## Format

**One file:** this document (`docs/DEVLOG.md`), with reverse-chronological dated
entries (`## YYYY-MM-DD — title`). Newest entry at the top.

We chose a single file over `docs/devlog/YYYY-MM-DD-slug.md` because the project
is still early and a showcase benefits from one searchable narrative. If this
file grows past ~a few dozen entries or parallel authors start colliding, split
into dated files then — do not fork the format prematurely.

### When to add an entry

See [`CONTRIBUTING.md`](../CONTRIBUTING.md). Short version: non-trivial architecture
decisions, explicit trade-offs, and dead ends that someone would otherwise have to
reverse-engineer from git history.

---

## 2026-07-26 — Host federation: remotes serve remoteEntry in `pnpm dev` (#107)

Remotes worked standalone on plain Vite, but the dashboard hung on "Loading …"
because `@originjs/vite-plugin-federation` only emits `/assets/remoteEntry.js` on
**build**. Remote `dev` now runs initial `vite build` + `vite build --watch` +
`vite preview --strictPort`; host stays on Vite. Added `dev:standalone` for HMR-only
UI work. Host main/RemoteLoader flex layout so federated remotes fill the shell.

## 2026-07-26 — usages-data CSS dual-mode + Usage overview UI (#111)

Copied the #108–#110 pattern for `@repo/usages-data`: per-remote Tailwind/PostCSS +
`tokens.css`/`index.css` in `main.tsx`, dark `index.html` + fonts, dashboard `content`
scan. Usage page aligned to the mock (KPI row, daily-calls bars, top-prompts table,
Export CSV) with admin-dashboard-style metric chips and provider breakdown retained.

## 2026-07-26 — user-manager CSS dual-mode + Users/API Keys UI (#110)

Copied the #108/#109 pattern for `@repo/user-manager`: per-remote Tailwind/PostCSS +
`tokens.css`/`index.css` in `main.tsx`, dark `index.html` + fonts, dashboard `content`
scan. Users / API Keys tabs follow the mock headers and admin-dashboard CRM table
patterns (search, invite/create panels, avatar initials, role/status badges, show-once
secret, revoke).

## 2026-07-26 — guardrail CSS dual-mode + mock list UI (#109)

Copied the #108 pattern for `@repo/guardrail`: per-remote Tailwind/PostCSS +
`tokens.css` in `main.tsx`, dark `index.html` fonts, and dashboard `content` scan
for `../guardrail/src`. Restyled the rule list to the mock (search, icon rows,
action badges, enable toggles) while keeping sets + test panel below.

## 2026-07-26 — prompt-manager CSS dual-mode (#108)

Chose **per-remote Tailwind pipeline + host content scan** for MFE styles (option 1 in
[#107](https://github.com/madmmas/aiplane/issues/107)):

- Standalone: `apps/prompt-manager` gets `tailwind.config.ts` (preset `@repo/ui`),
  `postcss.config.js`, `src/index.css`, and `main.tsx` imports `@repo/ui/tokens.css` +
  `./index.css`. `index.html` uses `class="dark"` + Inter / JetBrains Mono like the host.
- Federated: do **not** import global CSS from the exposed `./App` (avoids double tokens /
  Tailwind when mounted in the dashboard). Instead extend dashboard `tailwind.config.ts`
  `content` with `../prompt-manager/src/**/*.{ts,tsx}` so the host stylesheet already
  contains remote utility classes.

Rejected shipping a remote CSS chunk from `./App` for this first remote — host already
loads tokens, and a second inject was the failure mode called out in the AC. Sibling remotes
(#109–#111) should copy this pattern and append their `content` globs on the host.

## 2026-07-26 — Track MFE CSS dual-mode (#107–#111)

Remotes load as standalone Vite apps and as federated remotes, but only the dashboard
host imports `@repo/ui/tokens.css` + Tailwind — remote UIs render unstyled in both modes.
Filed parent [#107](https://github.com/madmmas/aiplane/issues/107) and per-app sub-issues
[#108](https://github.com/madmmas/aiplane/issues/108)–[#111](https://github.com/madmmas/aiplane/issues/111)
(prompt-manager, guardrail, user-manager, usages-data). Spec §5 / §10 / §12 and
`ISSUE_WORKFLOW.md` now treat dual-mode CSS as current frontend hygiene ahead of Phase 6.

---

## 2026-07-25 — Docs sync after Phases 0–5

Aligned tracker/SPEC/READMEs with shipped code: Phase 0 issues #8–#13 marked Done,
SPEC §10 Phase 0 checked, auth/config API tables and refresh flow match cookies +
`/actuator/refresh` proxy, Flyway path includes V10, and `@repo/api-client` README no
longer documents localStorage JWTs as the primary pattern. Epic #17 closed via #97.

---

## 2026-07-24 — News Radar Config Server consumption demo (#66)

Docs + minimal Go example only — no new Spring services. Wrote
`docs/integrations/news-radar-config-server.md` covering promote →
`config_properties` → Config Server JDBC → client HTTP GET, with curl and
optional `POST /api/v1/config/refresh/{application}`. Runnable sample under
`examples/news-radar-config/` (`go.mod` + stdlib `main.go` + `demo.sh`) so
adopters can `go run .` without a Config SDK. Phase 5 checklist items #63–#66
are done; epic #17 was closed via docs PR #97 after the stacked feature PRs merged.

---

## 2026-07-24 — Config refresh proxy via API Server (#65)

Added `ConfigProxyController` + `ConfigServerClient` (RestClient) under
`dev.madmmas.aimanager.config`, pointed at `aiplane.config-server.base-url`
(`CONFIG_SERVER_URL`, default `http://localhost:8888`).

**Endpoints:** `POST /api/v1/config/refresh/{application}` → Config Server
`POST /actuator/refresh` (returns refreshed key list); convenience
`GET /api/v1/config/{application}/{profile}` → Config Server environment JSON.
The `{application}` path on refresh is API symmetry / future targeting — Actuator
refresh itself is server-wide (no Spring Cloud Bus in this PR).

**Auth:** scopes `config:refresh` / `config:read` on API keys, or JWT ADMIN/DEVELOPER
(same pattern as usage). Unreachable / failed upstream → **502** via
`ConfigServerUnreachableException`.

**Config Server:** already exposed `refresh` in management endpoints; explicitly set
`management.endpoint.refresh.enabled=true`. Stuck to `/actuator/refresh` per issue
(not `/actuator/busrefresh`). News Radar demo (#66) stays out of this PR.

---

## 2026-07-24 — PromptConfigExporter writes config_properties on promote (#64)

Replaced `NoOpPromptConfigExporter` with always-on `JdbcPromptConfigExporter`. The #51
promotion hook already called `onVersionActivated`; this PR makes that write real rows
into the shared Postgres `config_properties` table (same store Config Server JDBC reads
in #63).

**Key schema** (application = project slug via `ProjectRepository.findSlugById`, fallback
to project id; profile = `default`; label = `main`):

| Key | Value |
|---|---|
| `aiplane.prompts.{name}.system` | systemPrompt |
| `aiplane.prompts.{name}.user` | userPromptTemplate |
| `aiplane.prompts.{name}.model` | model |
| `aiplane.prompts.{name}.provider` | provider wire value |
| `aiplane.prompts.{name}.version` | version number |
| `aiplane.prompts.{name}.versionId` | version id |

Prompt names sanitize `/` → `.` (e.g. `news-radar/dedup` → `news-radar.dedup`). Upserts
use Postgres `ON CONFLICT (application, profile, label, "KEY") DO UPDATE` so re-promoting
or activating a newer version updates values without duplicating rows.

Skipped optional `@Profile` / `@ConditionalOnProperty` dual-bean setup — api-server always
has a datasource and V9, so one JDBC bean is enough. Refresh proxy (#65) and News Radar
demo (#66) stay out of this PR.

---

## 2026-07-24 — Config Server JDBC backend (#63)

Enabled `CONFIG_MODE=jdbc` (Spring profile `jdbc`) with `spring-boot-starter-jdbc` +
Postgres. SQL must quote V9's `"KEY"` column and select unquoted `value` as the second
column — `JdbcEnvironmentRepository` maps by position, not name. Set
`default-label: main` to match V9 (Spring's JDBC default is still `master`).

Native/git profiles exclude `DataSourceAutoConfiguration` so classpath JDBC does not
break local scaffold. Config Server does **not** run Flyway; ITs apply V9 DDL against
Testcontainers and assert `GET /{app}/{profile}` resolves the seeded property.

Compose already forwards `DATABASE_URL` / `DB_USERNAME` / `DB_PASSWORD` to
config-server — switch with `CONFIG_MODE=jdbc` after api-server has migrated.

## 2026-07-24 — User Manager invite + API key UI (#62)

Wired `apps/user-manager` like the other MFEs: QueryClient + ApiClientProvider
(`useMocks: true`), federation-shared react-query/api-client, and a single page
with Users (list + invite) and API keys (project filter, create with show-once
secret, revoke confirm). Hooks come from #61 (`useUsers` / `useInviteUser` /
`useApiKeys` / `useCreateApiKey` / `useRevokeApiKey`).

## 2026-07-24 — API keys hashed + filter before JWT (#61)

Flyway V7 `api_keys` already fit (TEXT[] scopes, `key_hash`, `prefix`, `expires_at`) —
no new migration. Keys are `aimg_` + 32-byte hex; we store SHA-256 hex of the full
secret and a 13-char visible prefix (`aimg_` + 8 hex). The raw key is returned only
on `POST /api/v1/api-keys` and never logged.

**Filter order:** `ApiKeyAuthenticationFilter` → `JwtAuthenticationFilter` →
`UsernamePasswordAuthenticationFilter`. Extraction prefers `X-API-Key: aimg_…`, and
also accepts `Authorization: Bearer aimg_…` so future JWT Bearer tokens won't collide.
Invalid/expired keys leave the SecurityContext empty (fall through to JWT or 401).
On success, authorities are raw scope strings (`usage:write`, …); `last_used_at` is
updated synchronously.

**Scope enforcement (MVP):** `@EnableMethodSecurity` + `@PreAuthorize` on usage
ingest/read — API keys need `usage:write` / `usage:read`; JWT users keep
`ROLE_ADMIN`/`ROLE_DEVELOPER` (and `ROLE_VIEWER` for reads) so existing
`@WithMockUser(roles="ADMIN")` ITs stay green. API key CRUD itself requires
`ROLE_ADMIN` (JWT cookie), not another API key.

User-manager UI remains #62; this PR adds api-client hooks/mocks only.

---

## 2026-07-24 — Invite flow + JWT httpOnly cookies (#60)

Phase 4 auth lands with invite → accept-invite → login/refresh/logout. Tokens are
**httpOnly cookies** (`aiplane_access` ~15m, `aiplane_refresh` ~7d), not JSON body
fields — this overrides SPEC §3's `accessToken`/`refreshToken` JSON example per
`.cursor/rules/security.mdc` (browser storage is an XSS footgun). Response bodies
are `{ user: { id, email, name, roles } }` only.

**CSRF:** disabled for MVP with `SameSite=Lax` on the auth cookies. A cookie-based
SPA can later add a double-submit CSRF token; we documented the trade-off rather
than blocking #60 on full CSRF. CORS uses explicit origins from
`aiplane.cors.allowed-origins` (never `*`) with `allowCredentials=true`.

**Existing controller ITs:** Spring Security would 401 unauthenticated MockMvc
calls. Strategy: `@WithMockUser(roles = "ADMIN")` on `UsageControllerIT` /
`GuardrailSetControllerIT`, and `JwtAuthenticationFilter` does **not** clear the
SecurityContext when no access cookie is present (so the mock user survives).
`spring-security-test` is on the test classpath. `/actuator/health` stays
`permitAll`.

API keys / `ApiKeyAuthenticationFilter` stay in #61; user-manager UI in #62.

---

## 2026-07-24 — Usage overview dashboard KPIs + Recharts (#59)

Built the `usages-data` MFE as a single-page overview (no router for MVP), mirroring
Guardrail/Prompt Manager providers and federation shared deps. KPIs come from
`useUsageSummary`; avg latency is computed client-side from `useUsageEvents`
(summary DTO has no `avgLatencyMs` — not worth a backend change for one mean).
Chart series groups those same events by UTC day. Extended api-client usage mocks
with multi-day seed fixtures so standalone `useMocks: true` shows real numbers.

---

## 2026-07-24 — Cost rates compute-on-ingest + summary APIs (#58)

Chose **compute-on-ingest** over a scheduled aggregation job: simpler MVP, cost is
queryable immediately, and clients can still override by sending `costUsd`
explicitly. When `costUsd` is null/absent, `UsageService` calls `CostRateRegistry`
(`(inputTokens/1000)*inputUsdPer1k + (outputTokens/1000)*outputUsdPer1k`, scale 8
to match `NUMERIC(16,8)`).

Rates live under `aiplane.cost-rates.rates` in `application.yml` (not Java switch
statements) — a few Anthropic/OpenAI defaults matching mock models. Unknown models
→ cost `0`; first sighting WARN, subsequent DEBUG.

Read APIs: `GET /usage/summary?period=` (`7d` / `30d` / `yyyy-MM`),
`GET /usage/events?from=&to=` (limit 500), and `GET /usage/costs/projection` —
formula is `(sum cost over last 7d) / 7 * 30`. Dashboard UI stays in #59; this PR
only adds api-client hooks/mocks.

---

## 2026-07-24 — Usage event ingest envelope + auth stub (#57)

`POST /api/v1/usage/events` accepts a forward-compatible envelope
`{ "events": [ ... ] }` (not a bare JSON array) so we can add batch-level
metadata later without a breaking change. Response is
`{ "accepted": N, "events": [ ... ] }` with server-generated `ue_*` ids when
clients omit `id`. Validation is all-or-nothing: any bad row rejects the whole
batch with `400` and an `errors: ["[i] …"]` list; nothing is persisted.

Auth is intentionally open for now — same as prompts/guardrails — until Phase 4
wires API-key auth (`ApiKeyAuthenticationFilter`). V8 `usage_events` already
matched the TypeScript `UsageEvent` shape; persistence follows the Prompt JPA
pattern (`@Entity` + Spring Data) rather than Guardrail's JdbcTemplate.

---

## 2026-07-24 — Prompt Manager MFE mirrors Guardrail patterns (#53)

`apps/prompt-manager` now follows the same federation + React Query + mockable
`@repo/api-client` shape as Guardrail (#56): shared QueryClient / ApiClientProvider,
mutable in-memory prompt/version fixtures with `resetPromptMocks()`, and a single-page
composition (library → timeline → editor → playground) instead of react-router for MVP.

Playground UI calls `POST .../playground/run` through `useRunPlayground`; promote uses
`POST .../versions/{vid}/promote` so the UI only needs one action for draft→testing→active.

## 2026-07-24 — Playground via mockable Spring AI port (#52)

`POST /api/v1/prompts/{id}/playground/run` loads a version (explicit `versionId` or
active), resolves `{{variable}}` placeholders, then calls `PromptPlaygroundRunner`.
The production `@Primary` bean (`SpringAiPromptPlaygroundRunner`) uses Spring AI
`ChatClient` against Anthropic/OpenAI `ChatModel`s from `LlmProviderFactory`.

**Optional keys:** we depend on `spring-ai-openai` / `spring-ai-anthropic` (model
libs, not Boot starters) and build models only when `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` are set — missing keys leave the app booting and return 503
"provider not configured" at call time. HTTP read/connect timeout is 30s
(`aiplane.playground.timeout`); timeouts → 504, other provider failures → 502.
Unit tests mock the runner/factory — no live API calls in CI.

---

## 2026-07-24 — Version promotion state machine + export hook stub (#51)

Promotion is a strict path (`draft → testing → active → archived`) on
`PromptVersionStatus.canTransitionTo` — no skipping Testing. Activating a version
archives any other active row for that prompt, sets `prompts.active_version_id`,
and calls `PromptConfigExporter.onVersionActivated`. Phase 5 (#64) replaced the NoOp stub
with `JdbcPromptConfigExporter` writing to `config_properties`.

Primary API is SPEC's `PATCH .../versions/{vid}/status`; `POST .../promote`
advances one step for convenience. Both share the same transition service path.

---

## 2026-07-24 — Adopted JPA for prompts (JdbcTemplate stays for project/guardrail)

#50 finally resolves the SPEC vs scaffold drift called out on 2026-07-22:
`api-server` now depends on `spring-boot-starter-data-jpa` with
`spring.jpa.hibernate.ddl-auto=validate` so Flyway remains the schema owner.

Prompts and prompt versions are real `@Entity` / Spring Data repositories over
V2/V3 tables (`TEXT[]` tags via `@JdbcTypeCode(SqlTypes.ARRAY)`, JSONB
parameters/metrics via `SqlTypes.JSON`). Version create always lands as `draft`
with an auto-incremented version number — promotion (#51) and playground (#52)
stay out of this PR.

**Deliberate hybrid:** project and guardrail keep JdbcTemplate. Rewriting working
JDBC repositories just to "unify" would bloat the Prompt CRUD PR and risk
regressions in Phase 2 surfaces. New domains that match SPEC's entity model
should prefer JPA; migrate older JDBC packages when they next need a substantial
change.

---

## 2026-07-24 — Guardrail UI: mock-first hooks + host Tailwind

#56 builds the guardrail remote on `@repo/api-client` hooks against the #55 REST
shape, with mock evaluation so the MFE works before flipping `useMocks: false`.
Shared `@tanstack/react-query` and `@repo/api-client` as Module Federation
singletons so the remote can reuse the dashboard's providers/context. Ordering
uses Up/Down buttons (not DnD) — enough for MVP and easier to test with RTL.

---

## 2026-07-24 — Guardrail sets: ordered JDBC membership + short-circuit flag

#55 adds CRUD for `guardrail_sets` / `guardrail_set_members` and
`POST /api/v1/guardrail-sets/:id/evaluate`. Evaluation order is the `position` column
(ascending). Short-circuit is a first-class column (`V10__guardrail_sets_short_circuit`)
defaulting to `true`, overridable per evaluate request — so a test panel can "run all
rules" without mutating the saved set.

Still on JdbcTemplate (same deliberate SPEC drift as the scaffold). Individual guardrail
CRUD shipped in the same PR because sets are useless without members; UI (#56) will call
both.

Also flipped Maven `parameters>true</parameters>` so Spring MVC can bind `@PathVariable` /
`@RequestParam` without repeating names everywhere. Hardened
`AbstractPostgresIntegrationTest` to start Postgres once in a static initializer — `@Container`
on a shared parent was stopping the DB between IT classes once we added more of them.

---

## 2026-07-24 — Guardrail evaluators as Spring AI CallAdvisor (before CRUD)

Phase 2 starts with pure evaluators (#54) before persistence/CRUD (#55) and UI (#56). I
wanted the rule engine usable from a playground-style `ChatClient` call without waiting on
guardrail set tables or REST.

**Choice:** implement `GuardrailEvaluator` strategies + `GuardrailCallAdvisor` implementing
Spring AI 1.0 `CallAdvisor`, and add only `spring-ai-client-chat` to `api-server` (advisor
API, no provider starter). Rules are an in-memory `GuardrailRule` list for now; #55 will
load ordered sets from Flyway V5 and construct the advisor per evaluate request.

**ReDoS:** user regex is an injection/DoS surface (security rule). `RegexPatternGuard` caps
pattern length (256), rejects nested/overlapping quantifier shapes, and
`RegexFilterEvaluator` matches with a 100ms wall-clock timeout on a daemon thread. Not a
formal safety proof — enough to refuse the obvious catastrophic patterns and bound match
time.

**Rejected:** shipping only a keyword list via Spring AI's built-in `SafeGuardAdvisor`. It
covers one of three MVP types and has no max-length / regex / stage / action model. Better
to own the advisor and keep SafeGuard as inspiration for failure-response shape.

---

## 2026-07-22 — JdbcTemplate first, JPA later (and living with the SPEC drift)

I scaffolded `api-server` with `spring-boot-starter-jdbc` and wrote the first
integration test against raw `JdbcTemplate` + Flyway + Testcontainers. That was
the fastest path to prove "Spring Boot boots, migrations apply, health is up."

`docs/SPEC.md` §1 still lists **Spring Data JPA** as the persistence story. I did
not resolve that contradiction in the scaffold PR on purpose: renaming the data
access approach mid-scaffold would have bloated an already large "get the modular
monolith compiling" change. The Cursor rule in
`.cursor/rules/spring-boot-backend.mdc` now calls the drift out so Phase 1 Prompt
CRUD cannot pretend it does not exist.

What I almost did and rejected: adding JPA entities with no repositories and no
endpoints "for later." Empty JPA on the classpath looks like progress and is
actually debt — Hibernate would idle next to an unused entity model while Flyway
owned the real schema. Prefer one honest stack until Prompt CRUD forces the
choice: either adopt JPA for real in that PR, or update the SPEC to say
JdbcTemplate / Spring JDBC is the deliberate approach.

Related: [#13](https://github.com/madmmas/aiplane/issues/13) / [PR #43](https://github.com/madmmas/aiplane/pull/43),
backend testing follow-up [#48](https://github.com/madmmas/aiplane/issues/48).

---

## 2026-07-16 — Rebranded the product, left the Java package as `aimanager`

The UI, docs, and Maven `groupId` became **AIPlane** / `dev.madmmas.aiplane`. The
Java package root is still `dev.madmmas.aimanager`. That is not an oversight I
forgot to finish in the same PR — it is a deliberate deferral.

A full package rename touches every `.java` file, logging config in
`application.yml`, both Dockerfiles, and any import path a future contributor
copy-pastes from the SPEC. Doing it inside the rebrand PR would have mixed a
marketing/docs change with a mechanical blast radius that is hard to review and
easy to get subtly wrong (one missed import, one stale log category). The SPEC
still documents `dev.madmmas.aimanager` as the package root for that reason.

The cost is cognitive: newcomers will wonder if "aimanager" means the product
was renamed incompletely. The answer lives here — use AIPlane everywhere
user-facing; treat the Java package rename as its own issue when we are ready to
land it as a focused chore, not as drive-by cleanup inside a feature PR.

Related: [#5](https://github.com/madmmas/aiplane/issues/5) / [PR #32](https://github.com/madmmas/aiplane/pull/32).

---

## 2026-07-22 — OSS standard setup as a mergeable baseline, not a wish list

Issue [#7](https://github.com/madmmas/aiplane/issues/7) asked for the usual open-source
floor: license, community docs, lint/format, CI, Dependabot, and branch protection.
I treated that as "make `main` safe to collaborate on," not "document what we hope
to do later."

What mattered in practice:

- **Biome over ESLint/Prettier** so the frontend monorepo has one formatter/linter
  story. Adding a second tool in the same role is how config drifts start.
- **Husky blocking direct commits to `main`** locally, matching GitHub branch
  protection that requires the `ci` job. Protection that only exists on GitHub
  still lets you push a broken main from a laptop that skipped the UI.
- Closing the loop in [PR #35](https://github.com/madmmas/aiplane/pull/35) after the
  earlier OSS PR, so the issue tracker and the repo state agreed.

What I did not bolt on in that pass (and should not pretend was done): CODEOWNERS,
CHANGELOG, DEVLOG, and real test execution in CI. Those became follow-up hygiene
issues so the foundation PR stayed reviewable. A showcase repo that claims
"contributions welcome" without a green required check and a documented workflow
is performative — the baseline had to be real first.

Related: [#7](https://github.com/madmmas/aiplane/issues/7) / [PR #35](https://github.com/madmmas/aiplane/pull/35),
workflow notes in [`ISSUE_WORKFLOW.md`](ISSUE_WORKFLOW.md).

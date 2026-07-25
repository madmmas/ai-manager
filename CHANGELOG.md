# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Config Server refresh/environment proxy: `POST /api/v1/config/refresh/{application}` → Config Server `/actuator/refresh`, optional `GET /api/v1/config/{application}/{profile}`; API key scopes `config:refresh` / `config:read` (JWT ADMIN/DEVELOPER allowed); unreachable Config Server → 502; MockWebServer client + auth ITs (#65)
- `JdbcPromptConfigExporter`: on version activation, upserts active prompt fields into shared `config_properties` (project slug / `default` / `main`); idempotent via UNIQUE + `ON CONFLICT`; NoOp stub removed (#64)
- Config Server JDBC backend (`CONFIG_MODE=jdbc` / Spring profile `jdbc`): reads Flyway V9 `config_properties` via quoted `"KEY"` SQL; native mode unchanged; Testcontainers IT asserts HTTP property resolution (#63)
- User Manager MFE: user list + invite form (project/role), API key list/create/revoke with show-once secret panel; wired to `@repo/api-client` user and API key hooks (#62)
- API key CRUD + `ApiKeyAuthenticationFilter`: `GET/POST/DELETE /api/v1/api-keys`, SHA-256 hashed `aimg_` keys, scope enforcement on usage ingest/read, and `@repo/api-client` `useApiKeys` / `useCreateApiKey` / `useRevokeApiKey` (+ user list/invite hooks) (#61)
- Invite flow + JWT auth: `POST /api/v1/users/invite`, `/auth/accept-invite`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, and `GET /api/v1/users`; access/refresh tokens delivered as httpOnly cookies (`aiplane_access` / `aiplane_refresh`) (#60)
- Prompt / PromptVersion CRUD REST API via Spring Data JPA over Flyway `prompts` / `prompt_versions` (#50)
- Prompt version promotion state machine (`draft` → `testing` → `active` → `archived`) with `PATCH .../status`, optional `POST .../promote`, single-active enforcement, and `PromptConfigExporter` hook on activation (#51)
- Prompt playground endpoint (`POST /api/v1/prompts/{id}/playground/run`) with Spring AI ChatClient for Anthropic + OpenAI, optional API keys, 30s timeout, and a mockable `PromptPlaygroundRunner` port (#52)
- Guardrail core evaluators: keyword blocklist, regex filter (ReDoS-bounded), and max-length, plus a Spring AI `CallAdvisor` that runs them against prompt/response text (#54)
- Guardrail set persistence (ordered members + configurable short-circuit), CRUD REST API, and evaluate endpoint (#55)
- Guardrail MFE rule builder + ordered set editor + test panel, with `@repo/api-client` hooks and mocks (#56)
- Prompt Manager MFE: library + create/edit, version timeline with promote, editor, and playground panel; `@repo/api-client` prompt/version/playground hooks and mocks (#53)
- Batched usage event ingest (`POST /api/v1/usage/events`) with all-or-nothing validation over Flyway V8 `usage_events`, plus `@repo/api-client` `useIngestUsageEvents` / mock helper (#57)
- Cost tracking: YAML `aiplane.cost-rates` + `CostRateRegistry`, compute-on-ingest when `costUsd` omitted, summary / events / projection read APIs, and `@repo/api-client` `useUsageSummary` / `useUsageEvents` / `useUsageCostProjection` hooks (#58)
- Usages-data MFE overview dashboard: KPI tiles, provider breakdown, Recharts time-series, project/period filters wired to summary + events hooks (#59)

### Changed

- `api-server` now includes `spring-boot-starter-data-jpa` (`ddl-auto=validate`); project and guardrail domains remain on JdbcTemplate for now (#50)

## [0.1.0] - 2026-07-22

Phase 0 foundation: monorepo shell, shared packages, backend scaffold, and local full-stack tooling.

### Added

- OSS baseline: MIT license, community docs, Biome/Husky, Dependabot, and required `ci` branch protection
- Product spec (`docs/SPEC.md`), UI mock reference, and AIPlane brand assets
- `packages/ui` design-system tokens and shadcn-based primitives
- `packages/types` shared DTOs and `packages/api-client` fetch + React Query hooks
- Dashboard host shell with Module Federation remotes, theme switcher, and project switcher
- Spring Boot modular monolith (`api-server`, `config-server`) with Actuator health endpoints
- Flyway migrations V1–V9 (projects through config_properties) plus local seed data
- Docker Compose full-stack dev environment (Postgres, config-server, api-server, nginx UI)
- Frontend Vitest + React Testing Library setup across apps and packages
- Backend JUnit 5 / Mockito unit tests, Testcontainers Postgres ITs, and JaCoCo coverage

### Changed

- Rebranded product naming from AI Manager to **AIPlane** across docs and UI

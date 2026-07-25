# AIPlane Backend

Spring Boot modular monolith for AIPlane (SPEC §3).

| Module | Port | Role |
|--------|------|------|
| `api-server` | 8080 | Main API (`/actuator/health`) |
| `config-server` | 8888 | Spring Cloud Config Server (`native` / `jdbc` / `git` via `CONFIG_MODE`) |

**Java:** 21 · **Spring Boot:** 3.4.x · **Spring Cloud:** 2024.0.x · **Spring AI BOM:** managed in parent POM

## Prerequisites

- **JDK 21** (recommended; JDK 25+ also works — Surefire sets `net.bytebuddy.experimental` for Mockito)
- Maven 3.9+
- PostgreSQL 16+ for running the API server locally (or use Docker Compose)
- Docker (required for Testcontainers during `make backend-test` / `mvn verify`)

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || echo /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home)
```

## Database (Flyway)

Migrations live on the API server classpath:

`api-server/src/main/resources/db/migration/` — V1–V9 (projects → config_properties)

Optional local seed (`classpath:db/seed`): demo projects + `admin@aiplane.local` / `changeme`.

Default datasource (override with env):

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/aimanager` |
| `DB_USERNAME` | `aimanager` |
| `DB_PASSWORD` | `changeme` |

Production: set `spring.flyway.locations=classpath:db/migration` to skip seed scripts.

## Docker

From the repo root (`make docker-up`) the API server runs against Compose Postgres using `DATABASE_URL=jdbc:postgresql://postgres:5432/aimanager`. See the root README **Running with Docker** section.

## Build

From the repo root:

```bash
make backend-build
# or
mvn -f backend/pom.xml -B verify
```

`verify` runs:

1. **Surefire** unit tests (`*Tests`) — JUnit 5 + Mockito, no Docker required  
2. **Failsafe** integration tests (`*IT`) — Testcontainers Postgres + real Flyway migrations (Docker required)  
3. **JaCoCo** HTML/XML reports under each module's `target/site/jacoco/`

```bash
make backend-test   # same as verify (unit + IT + coverage)
open backend/api-server/target/site/jacoco/index.html
```

## Run

API server (required for acceptance):

```bash
make backend-api
# → http://localhost:8080/actuator/health
```

Config server (optional for local scaffold; default `CONFIG_MODE=native`):

```bash
make backend-config
# → http://localhost:8888/actuator/health
# JDBC: CONFIG_MODE=jdbc with DATABASE_URL pointing at a DB that has V9 config_properties
```

## Package layout (`api-server`)

Domain packages match SPEC §3.3 (`prompt`, `guardrail`, `user`, `usage`, `provider`, `project`, `security`, `common`).

**`prompt/` (Phase 1):** Spring Data JPA entities/repositories for `prompts` and
`prompt_versions` (Flyway V2/V3). REST under `/api/v1/prompts` — CRUD, versions, promotion,
and `POST /{id}/playground/run`. New versions always land as `draft`. Hibernate
`ddl-auto=validate` — Flyway owns schema.

**`provider/`:** Spring AI Anthropic + OpenAI wiring for the playground (`LlmProviderFactory`,
`SpringAiPromptPlaygroundRunner`). API keys are optional (`OPENAI_API_KEY` /
`ANTHROPIC_API_KEY`); missing keys do not block startup.

**`guardrail/` (Phase 2):** core evaluators (`KeywordBlocklistEvaluator`, `RegexFilterEvaluator`,
`MaxLengthEvaluator`) plus `GuardrailCallAdvisor` (Spring AI `CallAdvisor`). Guardrail and
guardrail-set CRUD + ordered evaluate live under `/api/v1/guardrails` and
`/api/v1/guardrail-sets` (Flyway V4/V5 + V10 `short_circuit_on_block`), still on JdbcTemplate.
`api-server` depends on `spring-ai-client-chat` plus `spring-ai-openai` / `spring-ai-anthropic`.

**Persistence:** hybrid — JPA for prompts; JdbcTemplate for project + guardrail until those
packages are migrated.
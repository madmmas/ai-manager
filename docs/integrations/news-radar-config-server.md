# News Radar ↔ Config Server (reference integration)

How a **client application** (News Radar in Go) consumes active prompts from AIPlane
at runtime: promote in the API/UI → rows in `config_properties` → Spring Cloud Config
Server over plain HTTP. No SDK — stdlib `net/http` only.

Runnable example: [`examples/news-radar-config/`](../../examples/news-radar-config/).

Depends on Phase 5 building blocks: JDBC backend ([#63](https://github.com/madmmas/aiplane/issues/63)),
`PromptConfigExporter` on promote ([#64](https://github.com/madmmas/aiplane/issues/64)),
refresh proxy ([#65](https://github.com/madmmas/aiplane/issues/65)). Parent epic: [#17](https://github.com/madmmas/aiplane/issues/17).

---

## Architecture

```
┌─────────────────┐     promote / Active      ┌──────────────────┐
│  AIPlane UI /   │ ─────────────────────────▶│    api-server    │
│  REST API       │   PATCH .../status        │  PromptService   │
└─────────────────┘                           └────────┬─────────┘
                                                       │
                         JdbcPromptConfigExporter      │
                         upserts keys                  ▼
                                              ┌──────────────────┐
                                              │   PostgreSQL     │
                                              │ config_properties│
                                              └────────┬─────────┘
                                                       │ JDBC read
                                                       ▼
┌─────────────────┐   GET /{slug}/default     ┌──────────────────┐
│  News Radar     │ ◀─────────────────────────│  config-server   │
│  (Go HTTP)      │   Spring Environment JSON │  :8888           │
└─────────────────┘                           └──────────────────┘
```

| Step | Component | Role |
|------|-----------|------|
| 1 | api-server | On version → `active`, `JdbcPromptConfigExporter` upserts prompt fields |
| 2 | Postgres | Shared `config_properties` (Flyway V9; api-server owns migrations) |
| 3 | config-server | `CONFIG_MODE=jdbc` serves `GET /{application}/{profile}` |
| 4 | News Radar | HTTP GET Environment JSON; optional refresh via api-server proxy |

**Lookup coordinates** written by the exporter ([#64](https://github.com/madmmas/aiplane/issues/64)):

| Column | Value |
|--------|--------|
| `application` | Project slug (e.g. `news-radar`) |
| `profile` | `default` |
| `label` | `main` (`default-label` in JDBC mode) |

---

## Prerequisites

- Docker Compose stack with **Postgres**, **api-server**, and **config-server**
- `CONFIG_MODE=jdbc` (Spring profile `jdbc` on config-server)
- api-server has applied Flyway through **V9** (`config_properties`)

```bash
# From repo root — set JDBC mode, then bring the stack up
cp -n .env.example .env   # first time
# In .env:
#   CONFIG_MODE=jdbc

make docker-up
# or: CONFIG_MODE=jdbc docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Confirm:

```bash
curl -fsS http://localhost:8888/actuator/health   # config-server
curl -fsS http://localhost:8080/actuator/health   # api-server
```

`docker-compose.dev.yml` currently pins `CONFIG_MODE: native` on config-server for local
defaults — override with env/`CONFIG_MODE=jdbc` when running this demo so properties come
from Postgres, not classpath native files.

---

## Round-trip demo

### 1. Ensure JDBC mode

Config Server must be on the `jdbc` profile so it runs the V9 SQL against shared Postgres
(see `backend/config-server/src/main/resources/application-jdbc.yml`). After switching
`CONFIG_MODE`, restart config-server (or the whole Compose stack).

### 2. Promote a prompt to Active

Use the Prompt Manager UI (`/prompts/...`) or the API (version promotion from [#51](https://github.com/madmmas/aiplane/issues/51);
exporter wired in [#64](https://github.com/madmmas/aiplane/issues/64)):

```bash
# JWT cookie or API key with prompts:write — adjust host/ids for your env
curl -X PATCH "http://localhost:8080/api/v1/prompts/{promptId}/versions/{versionId}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-or-api-key>" \
  -d '{"status":"active"}'
```

That upserts six keys per prompt into `config_properties` for the project slug.

### 3. Fetch from Config Server

```bash
# application = project slug, profile = default (label defaults to main)
curl -fsS "http://localhost:8888/news-radar/default" | jq .

# Explicit label (same data with jdbc default-label: main)
curl -fsS "http://localhost:8888/news-radar/default/main" | jq .
```

Or run the Go sample:

```bash
cd examples/news-radar-config
go run . -url http://localhost:8888 -app news-radar -profile default
```

### 4. Optional: refresh via API Server

Clients that cache Environment locally can ask api-server to hit Config Server
`/actuator/refresh` ([#65](https://github.com/madmmas/aiplane/issues/65)):

```bash
curl -X POST "http://localhost:8080/api/v1/config/refresh/news-radar" \
  -H "Authorization: Bearer <api-key-with-config:refresh>"
```

Auth: API key scope `config:refresh`, or JWT `ADMIN` / `DEVELOPER`. Unreachable Config
Server → **502**.

Convenience read (scope `config:read`):

```bash
curl -fsS "http://localhost:8080/api/v1/config/news-radar/default" \
  -H "Authorization: Bearer <api-key-with-config:read>"
```

News Radar itself should prefer **direct** Config Server GETs in production (no API key
needed for the public Config protocol). Use the proxy when you want auth-gated access or
a single API base URL.

---

## Expected Environment JSON shape

Spring Cloud Config returns an **Environment** document. Shape (abbreviated):

```json
{
  "name": "news-radar",
  "profiles": ["default"],
  "label": "main",
  "version": null,
  "state": null,
  "propertySources": [
    {
      "name": "jdbc:news-radar-default-main",
      "source": {
        "aiplane.prompts.dedup-judge.system": "You are a deduplication judge.",
        "aiplane.prompts.dedup-judge.user": "Compare {{a}} and {{b}}",
        "aiplane.prompts.dedup-judge.model": "claude-haiku-4-5",
        "aiplane.prompts.dedup-judge.provider": "anthropic",
        "aiplane.prompts.dedup-judge.version": "7",
        "aiplane.prompts.dedup-judge.versionId": "ver_…"
      }
    }
  ]
}
```

- Flattened keys live under `propertySources[].source` (not nested YAML objects).
- Property source `name` may vary by Spring Cloud Config version; assert on `source` keys.
- Empty `propertySources` / missing keys usually means wrong slug/profile, or promote never
  ran against that project.

---

## Key naming (`PromptConfigExporter`)

Prefix: `aiplane.prompts.{promptName}.…`  
Prompt names with `/` are sanitized to `.` (e.g. `news-radar/dedup` → `news-radar.dedup`).

| Key | Source field |
|-----|----------------|
| `aiplane.prompts.{name}.system` | `systemPrompt` |
| `aiplane.prompts.{name}.user` | `userPromptTemplate` |
| `aiplane.prompts.{name}.model` | `model` |
| `aiplane.prompts.{name}.provider` | provider wire value |
| `aiplane.prompts.{name}.version` | version number (string) |
| `aiplane.prompts.{name}.versionId` | version id |

---

## Related docs

- Product architecture & Phase 5 checklist: [`docs/SPEC.md`](../SPEC.md)
- Issue tracker: [`docs/ISSUE_WORKFLOW.md`](../ISSUE_WORKFLOW.md)
- Backend modules: [`backend/README.md`](../../backend/README.md)
- Runnable Go + curl script: [`examples/news-radar-config/`](../../examples/news-radar-config/)

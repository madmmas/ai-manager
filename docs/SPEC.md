# AIPlane — SPEC.md

> **Version:** 0.2  
> **Repo:** https://github.com/madmmas/aiplane  
> **Author:** madmmas  
> **Purpose:** Open-source, self-hostable AI control plane. Showcase project for Java + Spring ecosystem.

---

## 1. Vision & Goals

**AIPlane** is an open-source control plane for AI-powered applications. It gives engineering teams a single UI to manage everything that sits between their application code and an LLM: prompts, guardrails, users, and usage telemetry.

It is designed to be dropped into any project — starting with **News Radar** and **Ackloop** — as a management layer, not a replacement for the application itself.

### Why Java + Spring

This project is a deliberate showcase of the modern Java/Spring ecosystem applied to AI infrastructure:

- **Spring Boot 3.x** as the application backbone
- **Spring AI** as the LLM integration layer (playground execution, embeddings)
- **Spring Cloud Config Server** as the runtime config delivery mechanism
- **Spring Security** for JWT-based auth and API key validation
- **Spring Data JPA** for clean repository-pattern persistence
- **Spring Actuator + Micrometer** for production-grade observability

Client applications (News Radar in Go, Ackloop in Go) consume the Config Server endpoint to fetch active prompts and guardrail rules at runtime — no SDK required, just HTTP.

### Core Principles

| Principle | What it means in practice |
|---|---|
| **Self-hostable** | `docker compose up`. No cloud account required. |
| **Micro-frontend** | Each domain (prompts, guardrails, users, usage) is an independent deployable MFE. |
| **Provider-agnostic** | Works with Anthropic, OpenAI, Azure OpenAI, Ollama, Bedrock via Spring AI abstraction. |
| **Developer-first** | Every UI action is also available via REST API. CI/CD can push prompt versions programmatically. |
| **Enterprise-legible** | Modular monolith architecture, Maven build, Spring idioms throughout — readable by any enterprise Java team. |

---

## 2. Architecture Overview

### Repository Structure

```
aiplane/
├── apps/                          # Micro-frontend apps (pnpm + Turborepo)
│   ├── dashboard/                 # Host shell       (port 5173)
│   ├── prompt-manager/            # Prompt MFE        (port 5174)
│   ├── guardrail/                 # Guardrail MFE     (port 5175)
│   ├── user-manager/              # User MFE          (port 5176)
│   └── usages-data/               # Usage MFE         (port 5177)
├── packages/                      # Shared frontend packages
│   ├── ui/                        # Design system (shadcn/ui + tokens)
│   ├── types/                     # Shared TypeScript interfaces
│   └── api-client/                # React Query hooks + fetch client
├── backend/                       # Spring Boot modular monolith (Maven)
│   ├── pom.xml                    # Parent POM
│   ├── config-server/             # Spring Cloud Config Server (port 8888)
│   │   └── pom.xml
│   ├── api-server/                # Main Spring Boot app (port 8080)
│   │   ├── pom.xml
│   │   └── src/main/java/dev/madmmas/aimanager/
│   │       ├── AiManagerApplication.java
│   │       ├── prompt/            # Prompt module
│   │       ├── guardrail/         # Guardrail module
│   │       ├── user/              # User + API key module
│   │       ├── usage/             # Usage telemetry module
│   │       ├── provider/          # LLM provider abstraction (Spring AI)
│   │       ├── security/          # JWT + API key filter
│   │       └── common/            # Shared: exceptions, DTOs, config
│   └── db/
│       └── migration/             # Flyway SQL migrations
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── Makefile
└── SPEC.md
```

### System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser                                   │
│  Dashboard MFE (5173) ─ loads ─► Prompt MFE  (5174)         │
│                                ─ loads ─► Guardrail (5175)  │
│                                ─ loads ─► Users    (5176)   │
│                                ─ loads ─► Usage    (5177)   │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST (JSON)
          ┌─────────────▼─────────────┐
          │  API Server  :8080        │  ← Spring Boot modular monolith
          │  (prompt / guardrail /    │
          │   user / usage modules)   │
          └──────┬────────────────────┘
                 │
        ┌────────▼────────┐    ┌──────────────────────┐
        │   PostgreSQL    │    │  Config Server :8888  │  ← Spring Cloud Config
        │   :5432         │    │  (Git or DB backend)  │
        └─────────────────┘    └──────────┬────────────┘
                                          │ HTTP (Spring Cloud Config protocol)
                               ┌──────────▼────────────┐
                               │  Client Apps          │
                               │  (News Radar / Ackloop│
                               │   / any HTTP client)  │
                               └───────────────────────┘
```

### Module Federation (Frontend)

```
Dashboard (Host :5173)
  ├── mounts → PromptApp    from :5174/assets/remoteEntry.js
  ├── mounts → GuardrailApp from :5175/assets/remoteEntry.js
  ├── mounts → UserApp      from :5176/assets/remoteEntry.js
  └── mounts → UsagesApp    from :5177/assets/remoteEntry.js
```

Each remote exposes `./App` and owns its own route namespace. The dashboard shell owns global navigation, auth context, and theme.

---

## 3. Backend — Spring Boot Modular Monolith

### 3.1 Maven Project Structure

```
backend/
├── pom.xml                        # Parent POM (dependency management)
├── config-server/                 # Module 1: Spring Cloud Config Server
│   └── pom.xml
└── api-server/                    # Module 2: Main application
    └── pom.xml
```

**Parent POM responsibilities:**
- Spring Boot 3.x BOM import
- Spring Cloud BOM import (for Config Server)
- Spring AI BOM import
- Common plugin config: Checkstyle, Surefire, Failsafe
- Shared dependency versions: Flyway, Lombok, MapStruct, Testcontainers

### 3.2 Config Server Module (`config-server/`)

A standalone Spring Boot application. Its sole job is to serve property files to clients over HTTP using the Spring Cloud Config protocol.

**Port:** 8888  
**Dependency:** `spring-cloud-config-server`

**Configuration modes (choose one via `SPRING_PROFILES_ACTIVE`):**

| Mode | Backend | Use case |
|---|---|---|
| `git` | Remote Git repo | Production — prompts versioned in Git |
| `native` | Local filesystem | Development — configs as local files |
| `jdbc` | PostgreSQL (shared DB) | When you want DB as single source of truth |

**`application.yml` (config-server):**
```yaml
server:
  port: 8888

spring:
  application:
    name: aiplane-config-server
  cloud:
    config:
      server:
        git:
          uri: ${CONFIG_GIT_URI:https://github.com/madmmas/aiplane-config}
          default-label: main
          search-paths: '{application}'
        jdbc:
          sql: SELECT KEY, VALUE FROM CONFIG_PROPERTIES WHERE APPLICATION=? AND PROFILE=? AND LABEL=?
          order: 1
  datasource:
    url: ${DATABASE_URL}

management:
  endpoints:
    web:
      exposure:
        include: health,info,refresh
```

**What gets served via Config Server:**

Each project in AIPlane corresponds to a Spring Cloud Config `application`. A client fetching `/{application}/{profile}` receives:

```yaml
# Example: GET /news-radar/production
aiplane:
  prompts:
    dedup-judge:
      active-version: 7
      model: claude-haiku-4-5
      temperature: 0.1
      max-tokens: 512
  guardrails:
    active-set: news-radar-production
    rules:
      - id: gr_01
        type: keyword-blocklist
        stage: output
        action: block
```

Client apps (News Radar, Ackloop) call this endpoint on startup and on `POST /actuator/refresh` (triggered by AIPlane after a version promotion). No SDK needed — pure HTTP.

### 3.3 API Server Module (`api-server/`)

**Port:** 8080  
**Package root:** `dev.madmmas.aimanager`

#### Package Layout (Modular Monolith by Domain)

```
src/main/java/dev/madmmas/aimanager/
├── AiManagerApplication.java
│
├── common/
│   ├── config/           AppConfig, SecurityConfig, WebMvcConfig, OpenApiConfig
│   ├── exception/        GlobalExceptionHandler, ApiException, ErrorResponse
│   ├── dto/              PageRequest, PageResponse
│   └── util/             SlugUtil, CryptoUtil, CostCalculator
│
├── security/
│   ├── JwtTokenProvider.java
│   ├── JwtAuthenticationFilter.java
│   ├── ApiKeyAuthenticationFilter.java
│   ├── UserDetailsServiceImpl.java
│   └── SecurityConfig.java
│
├── prompt/
│   ├── PromptController.java
│   ├── PromptService.java
│   ├── PromptRepository.java
│   ├── PromptVersionRepository.java
│   ├── PlaygroundService.java        ← Spring AI integration
│   ├── PromptConfigExporter.java     ← writes to Config Server backend
│   ├── domain/
│   │   ├── Prompt.java               (@Entity)
│   │   └── PromptVersion.java        (@Entity)
│   └── dto/
│       ├── PromptRequest.java
│       ├── PromptResponse.java
│       ├── VersionRequest.java
│       ├── VersionResponse.java
│       └── PlaygroundRequest.java / PlaygroundResponse.java
│
├── guardrail/
│   ├── GuardrailController.java
│   ├── GuardrailService.java
│   ├── GuardrailRepository.java
│   ├── GuardrailSetRepository.java
│   ├── GuardrailEvaluator.java       ← rule engine
│   ├── evaluator/
│   │   ├── KeywordBlocklistEvaluator.java
│   │   ├── RegexFilterEvaluator.java
│   │   ├── MaxLengthEvaluator.java
│   │   ├── PIIDetectionEvaluator.java
│   │   └── LLMJudgeEvaluator.java    ← Spring AI integration
│   ├── domain/
│   │   ├── Guardrail.java
│   │   └── GuardrailSet.java
│   └── dto/  ...
│
├── user/
│   ├── UserController.java
│   ├── UserService.java
│   ├── ApiKeyService.java
│   ├── UserRepository.java
│   ├── ApiKeyRepository.java
│   ├── domain/
│   │   ├── User.java
│   │   ├── ProjectMembership.java
│   │   └── ApiKey.java
│   └── dto/  ...
│
├── usage/
│   ├── UsageController.java
│   ├── UsageService.java
│   ├── UsageRepository.java
│   ├── UsageSummaryService.java
│   ├── domain/
│   │   └── UsageEvent.java
│   └── dto/  ...
│
├── provider/
│   ├── LLMProviderFactory.java       ← selects ChatModel by provider
│   ├── ProviderConfig.java           ← @ConfigurationProperties
│   └── CostRateRegistry.java         ← token cost per model
│
└── project/
    ├── ProjectController.java
    ├── ProjectService.java
    ├── ProjectRepository.java
    └── domain/
        └── Project.java
```

#### Key Spring AI Integration Points

**1. Playground execution (`PlaygroundService.java`)**
```java
@Service
public class PlaygroundService {

    private final LLMProviderFactory providerFactory;
    private final UsageService usageService;

    public PlaygroundResponse run(PlaygroundRequest request) {
        ChatModel chatModel = providerFactory.getModel(request.provider(), request.model());

        String resolvedSystem = resolveTemplate(request.systemPrompt(), request.variables());
        String resolvedUser   = resolveTemplate(request.userPromptTemplate(), request.variables());

        Prompt prompt = new Prompt(List.of(
            new SystemMessage(resolvedSystem),
            new UserMessage(resolvedUser)
        ), ChatOptionsBuilder.builder()
            .withTemperature(request.temperature())
            .withMaxTokens(request.maxTokens())
            .build());

        long start = System.currentTimeMillis();
        ChatResponse response = chatModel.call(prompt);
        long latencyMs = System.currentTimeMillis() - start;

        // Record usage
        usageService.record(UsageEvent.from(request, response, latencyMs));

        return PlaygroundResponse.from(response, latencyMs);
    }
}
```

**2. Provider factory (`LLMProviderFactory.java`)**
```java
@Component
public class LLMProviderFactory {

    // Spring AI auto-configures these if API keys are present
    @Autowired(required = false) private AnthropicChatModel anthropicModel;
    @Autowired(required = false) private OpenAiChatModel    openAiModel;
    @Autowired(required = false) private OllamaChatModel    ollamaModel;
    @Autowired(required = false) private BedrockChatModel   bedrockModel;

    public ChatModel getModel(LLMProvider provider, String modelId) {
        return switch (provider) {
            case ANTHROPIC -> anthropicModel;
            case OPENAI    -> openAiModel;
            case OLLAMA    -> ollamaModel;
            case BEDROCK   -> bedrockModel;
        };
    }
}
```

**3. LLM Judge guardrail (`LLMJudgeEvaluator.java`)**
```java
@Component
public class LLMJudgeEvaluator implements GuardrailEvaluatorStrategy {

    private final PlaygroundService playgroundService;
    private final PromptService promptService;

    @Override
    public EvaluationResult evaluate(String text, GuardrailConfig config) {
        PromptVersion judgePrompt = promptService.getActiveVersion(config.judgePromptId());

        PlaygroundRequest req = PlaygroundRequest.builder()
            .systemPrompt(judgePrompt.systemPrompt())
            .userPromptTemplate(judgePrompt.userPromptTemplate())
            .variables(Map.of("input", text))
            .model(judgePrompt.model())
            .provider(judgePrompt.provider())
            .temperature(0.0f)
            .maxTokens(256)
            .build();

        PlaygroundResponse response = playgroundService.run(req);
        JudgeResult result = objectMapper.readValue(response.content(), JudgeResult.class);
        // JudgeResult: { pass: boolean, reason: string }

        return result.pass()
            ? EvaluationResult.pass()
            : EvaluationResult.fail(result.reason(), config.action());
    }
}
```

#### Spring Security Setup

Two parallel auth mechanisms:

**1. JWT (for UI users)**
- `POST /auth/login` and `POST /auth/accept-invite` issue short-lived access + refresh JWTs via **httpOnly cookies** (`aiplane_access`, `aiplane_refresh`) — tokens are **not** returned in the JSON body (see `.cursor/rules/security.mdc`; SPEC originally showed JSON tokens)
- `JwtAuthenticationFilter` validates the access cookie on every request
- Roles: `ROLE_ADMIN`, `ROLE_DEVELOPER`, `ROLE_VIEWER` — per project via `ProjectMembership`

**2. API Key (for programmatic clients)**
- Keys stored as SHA-256 hash in DB, prefix `aimg_` for scanner detection
- `ApiKeyAuthenticationFilter` runs before JWT filter
- Scopes checked per endpoint: `prompts:read`, `guardrails:evaluate`, etc.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter,    UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**", "/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/prompts/**").hasAnyAuthority("prompts:read", "ROLE_DEVELOPER")
                .requestMatchers("/api/v1/**").authenticated()
            )
            .build();
    }
}
```

#### Database Migrations (Flyway)

```
db/migration/
├── V1__create_projects.sql
├── V2__create_prompts.sql
├── V3__create_prompt_versions.sql
├── V4__create_guardrails.sql
├── V5__create_guardrail_sets.sql
├── V6__create_users.sql
├── V7__create_api_keys.sql
├── V8__create_usage_events.sql
└── V9__create_config_properties.sql   ← if using JDBC backend for Config Server
```

#### REST API Reference

**Auth**
```
POST   /auth/login                    → { user } + Set-Cookie (httpOnly access/refresh)
POST   /auth/accept-invite            → { user } + Set-Cookie
POST   /auth/refresh                  → { user } + Set-Cookie (rotated)
POST   /auth/logout                   → clears cookies
GET    /auth/me                       → { id, email, name, roles }
```

**Projects**
```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
```

**Prompts**
```
GET    /api/v1/prompts?projectId=
POST   /api/v1/prompts
GET    /api/v1/prompts/:id
PATCH  /api/v1/prompts/:id                     { name?, description?, tags? }
DELETE /api/v1/prompts/:id
GET    /api/v1/prompts/:id/versions
POST   /api/v1/prompts/:id/versions
GET    /api/v1/prompts/:id/versions/:vid
PATCH  /api/v1/prompts/:id/versions/:vid/status   { status: "active" }
POST   /api/v1/prompts/:id/playground/run
POST   /api/v1/prompts/:id/playground/compare     { versionIds: [a, b], variables: {} }
```

**Guardrails**
```
GET    /api/v1/guardrails?projectId=
POST   /api/v1/guardrails
GET    /api/v1/guardrails/:id
PATCH  /api/v1/guardrails/:id
DELETE /api/v1/guardrails/:id
POST   /api/v1/guardrails/:id/test                { text: "..." }
GET    /api/v1/guardrail-sets?projectId=
POST   /api/v1/guardrail-sets
POST   /api/v1/guardrail-sets/:id/evaluate        { input: "...", output: "..." }
```

**Users & API Keys**
```
GET    /api/v1/users
POST   /api/v1/users/invite
PATCH  /api/v1/users/:id
GET    /api/v1/api-keys?projectId=
POST   /api/v1/api-keys                           → returns full key once
DELETE /api/v1/api-keys/:id
```

**Usage**
```
POST   /api/v1/usage/events                       ← client app SDK write
GET    /api/v1/usage/summary?projectId=&period=
GET    /api/v1/usage/events?projectId=&from=&to=
GET    /api/v1/usage/costs/projection?projectId=
```

**Config Server passthrough (convenience)**
```
GET    /api/v1/config/:application/:profile       ← proxies Config Server response
POST   /api/v1/config/refresh/:application        ← triggers Config Server refresh
```

---

## 4. Config Server — Runtime Config Delivery

This is how **client applications consume AIPlane at runtime** without a full SDK.

### How a Client App Fetches Config

```bash
# News Radar (Go) on startup:
GET http://aiplane-config:8888/news-radar/production

# Response (Spring Cloud Config format):
{
  "name": "news-radar",
  "profiles": ["production"],
  "propertySources": [{
    "name": "aiplane/news-radar/production",
    "source": {
      "aiplane.prompts.dedup-judge.active-version": "7",
      "aiplane.prompts.dedup-judge.model": "claude-haiku-4-5",
      "aiplane.guardrails.active-set": "news-radar-production"
    }
  }]
}
```

### Config Refresh Flow (when a prompt is promoted)

```
User promotes version 7 → active in AIPlane UI
        ↓
PromptService.promoteVersion() runs
        ↓
PromptConfigExporter.export(projectSlug) writes new config to backend
(Git commit or DB upsert depending on Config Server mode)
        ↓
POST /monitor on Config Server (Spring Cloud Bus, or direct HTTP)
        ↓
Config Server notifies registered clients via /actuator/refresh
        ↓
News Radar reloads prompt config — no redeploy needed
```

### JDBC Backend Config (simplest for self-hosting)

When using `JDBC` mode, Config Server reads from a table in the shared PostgreSQL instance:

```sql
CREATE TABLE config_properties (
    id          BIGSERIAL PRIMARY KEY,
    application VARCHAR(100) NOT NULL,   -- project slug, e.g. 'news-radar'
    profile     VARCHAR(50)  NOT NULL,   -- 'production', 'development'
    label       VARCHAR(50)  NOT NULL DEFAULT 'main',
    key         VARCHAR(200) NOT NULL,
    value       TEXT,
    updated_at  TIMESTAMPTZ  DEFAULT now()
);
```

`PromptConfigExporter` writes to this table whenever a version is promoted or a guardrail set is updated. Config Server reads from it. One database, no Git dependency for the self-hosted path.

---

## 5. Frontend — Micro-Frontend Apps

### 5.1 Dashboard (Host Shell) — Port 5173

**Responsibility:** Layout, auth, global navigation, project switching, remote error boundaries.

**Routes**
```
/                 → redirect to /prompts
/prompts/*        → mounts Prompt Manager MFE
/guardrails/*     → mounts Guardrail MFE
/users/*          → mounts User Manager MFE
/usage/*          → mounts Usage MFE
/settings         → host-owned settings (provider API keys, project config)
```

**Global State (Zustand)**
```typescript
interface AppStore {
  currentProject: Project;
  currentUser:    AuthUser;
  projects:       Project[];
  accessToken:    string;
  theme:          'dark' | 'light';
}
```

**Key Components**
- `Shell` — top bar (48px) + collapsible left sidebar (160px / 48px icon-only)
- `ProjectSwitcher` — dropdown; switching project re-fetches all MFE data
- `RemoteLoader` — Suspense + ErrorBoundary wrapper for each MFE
- `CommandPalette` — `Cmd+K` global search: navigate pages, find prompts by name
- `SettingsPage` — provider API key entry (masked input, stored encrypted server-side)

---

### 5.2 Prompt Manager — Port 5174

**Routes**
```
/prompts                      → Library (card/table toggle)
/prompts/new                  → Create prompt
/prompts/:id                  → Detail: version timeline + active version
/prompts/:id/versions/:vid    → Version editor
/prompts/:id/playground       → Test playground
```

**Key UI: Version Timeline**

The signature component of the product. A horizontal scrollable lane showing every version as a node connected by a line — like a git log. The active version node is filled in accent blue. Clicking any node loads that version in the editor panel below.

```
  v1 ── v2 ── v3 ── [v4] ── v5 ── ●v6(active)
                     ↑
                 (selected)
```

Each node shows: version number, model badge, status chip, created date on hover.

**Version Editor**
- Split pane: Monaco editor (left, syntax highlight for `{{variable}}`) + variables panel (right)
- Model picker: provider logo + model name + context window size shown
- Parameter controls: temperature slider, max tokens input
- "Fork" button: creates new draft version copying current version's content
- "Diff" button: opens two-pane diff between any two versions
- Status flow: `Draft → Testing → Active` (only one Active per prompt)
- Auto-save draft to localStorage every 30s

**Playground**
- Variable form (right panel): fill `{{variable}}` placeholders
- "Run" button (`Cmd+Enter`): calls `POST /api/v1/prompts/:id/playground/run`
- Response panel: output text, input tokens, output tokens, latency, estimated cost
- "Compare" mode: run same variables against two versions side-by-side
- "Save as test case": saves the run for future regression testing

---

### 5.3 Guardrail — Port 5175

**Routes**
```
/guardrails                   → List
/guardrails/new               → Create wizard (4 steps)
/guardrails/:id               → Detail + edit
/guardrails/:id/test          → Test panel
/guardrails/sets              → Guardrail sets list
/guardrails/sets/:id          → Set detail + member management
```

**Guardrail Types**

| Type | Config Fields |
|---|---|
| `keyword-blocklist` | keywords: string[] |
| `regex-filter` | patterns: string[] |
| `pii-detection` | entities: (EMAIL, PHONE, NI_NUMBER, etc.) |
| `topic-restriction` | allowedTopics: string[] |
| `max-length` | maxChars: number |
| `language-filter` | allowedLanguages: string[] (ISO 639-1) |
| `custom-llm-judge` | judgePromptId: string (references Prompt Manager) |

**Actions:** `block` · `warn` · `redact` · `log-only`

**Guardrail Sets**
- Named bundle of ordered guardrails assigned to a project
- Drag to reorder (order matters — evaluated top-down)
- Enable/disable individual rules within a set without removing them
- Test panel: paste input + output text, see which rules trigger and what action fires

---

### 5.4 User Manager — Port 5176

**Routes**
```
/users                → User list
/users/invite         → Invite by email
/users/:id            → User detail + project memberships
/api-keys             → API key list
/api-keys/new         → Create API key
```

**API Key Creation Flow**
1. Name + project + permission scopes + optional expiry date
2. Key generated server-side, returned once in a `copy-to-clipboard` modal
3. Only prefix (`aimg_****`) stored + shown thereafter
4. Revoke = immediate, no soft delete

**Permission Scopes**
```
prompts:read         view prompts and versions
prompts:write        create / edit / promote versions
guardrails:read      view guardrails
guardrails:evaluate  call the runtime evaluate endpoint
usage:read           view usage telemetry
```

---

### 5.5 Usages Data — Port 5177

**Routes**
```
/usage                → Overview dashboard
/usage/prompts        → Per-prompt breakdown
/usage/models         → Per-model breakdown
/usage/costs          → Cost trend + projection
/usage/logs           → Raw event log
```

**Overview Dashboard KPIs**
- Total calls (period) with Δ vs prior period
- Total cost (USD) with Δ
- Avg latency (ms) with Δ
- Success rate (%) with Δ

**Charts** (all via Recharts)
- Time-series line: daily calls + cost (switchable 7d / 30d / 90d)
- Donut: call distribution by model
- Stacked bar: daily cost by model (Cost page)
- Projection line: linear extrapolation to month end with budget threshold marker

**Raw Log**
- Sortable, filterable table with date range, project, prompt, model, status
- Expandable rows (no prompt content exposed for privacy)
- CSV export

---

## 6. Shared Frontend Packages

### `packages/ui` — Design System

**Design Tokens**
```css
--background:     #0f1117;   /* near-black, blue-tinted */
--surface:        #1a1d27;   /* cards, panels */
--surface-raised: #22263a;   /* hover, code blocks */
--border:         #2e3248;
--text-primary:   #e8eaf0;
--text-secondary: #8b90a8;
--accent:         #6c8ef5;   /* electric blue — primary action, active states */
--accent-hover:   #8aa3f7;
--success:        #34d399;
--warning:        #fbbf24;
--error:          #f87171;
--code-bg:        #12151f;
```

**Typography**
```
Display / Code:  JetBrains Mono  (signals engineering tool)
Body / UI:       Inter
Scale:           12 / 13 / 14 / 16 / 20 / 28px
```

**Exported Components**
`Button` · `IconButton` · `Input` · `Textarea` · `Select` · `Switch` · `Slider`  
`Table` · `DataTable` · `Card` · `Badge` · `Tooltip` · `Dialog` · `Sheet` · `Popover`  
`CodeEditor` (Monaco) · `DiffViewer` · `Skeleton` · `Spinner`  
`KPICard` (metric + delta arrow) · `ProviderBadge` (Anthropic / OpenAI / Bedrock / Ollama logos)  
`VersionTimeline` (the signature component)

### `packages/types`

All shared TypeScript interfaces matching backend DTOs exactly:
`Project` · `Prompt` · `PromptVersion` · `ModelParameters` · `Guardrail` · `GuardrailSet`  
`User` · `APIKey` · `UsageEvent` · `UsageSummary` · `LLMProvider` · `PageResponse<T>`

### `packages/api-client`

React Query hooks wrapping all backend endpoints. Base URL injected from shell context.

```typescript
// Any MFE:
import { usePrompts, usePromptVersions, useRunPlayground } from '@repo/api-client';

const { data, isLoading } = usePrompts({ projectId });
const mutation = useRunPlayground();
```

---

## 7. Data Models

### Core Entities

```typescript
// Canonical types — backend Java @Entity mirrors these exactly

interface Project {
  id: string; slug: string; name: string; createdAt: Date;
}

interface Prompt {
  id: string; projectId: string;
  name: string;          // format: "project/slug" e.g. "news-radar/dedup-judge"
  description?: string;
  tags: string[];
  activeVersionId?: string;
  createdAt: Date; updatedAt: Date;
}

interface PromptVersion {
  id: string; promptId: string;
  version: number;       // auto-increment, never recycles
  label?: string;        // optional alias e.g. "haiku-optimised"
  model: string;
  provider: LLMProvider;
  systemPrompt: string;
  userPromptTemplate: string;  // supports {{variable}} syntax
  parameters: ModelParameters;
  status: 'draft' | 'testing' | 'active' | 'archived';
  createdBy: string; createdAt: Date;
  metrics?: VersionMetrics;    // populated from usage data
}

interface ModelParameters {
  temperature: number; maxTokens: number;
  topP?: number; stopSequences?: string[];
}

interface Guardrail {
  id: string; projectId: string; name: string;
  type: GuardrailType; stage: 'input' | 'output' | 'both';
  config: GuardrailConfig; enabled: boolean;
  action: 'block' | 'warn' | 'redact' | 'log-only';
  blockMessage?: string;
  createdAt: Date;
}

interface UsageEvent {
  id: string; projectId: string;
  promptId?: string; promptVersionId?: string; apiKeyId?: string;
  provider: LLMProvider; model: string;
  inputTokens: number; outputTokens: number;
  latencyMs: number; costUsd: number;
  status: 'success' | 'error' | 'guardrail-blocked';
  timestamp: Date;
}

type LLMProvider = 'anthropic' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama' | 'gemini';
```

---

## 8. Infrastructure

### Docker Compose (full stack)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       aimanager
      POSTGRES_USER:     aimanager
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aimanager"]

  config-server:
    build: ./backend/config-server
    ports: ["8888:8888"]
    environment:
      DATABASE_URL: jdbc:postgresql://postgres:5432/aimanager
      DB_USERNAME:  aimanager
      DB_PASSWORD:  ${DB_PASSWORD}
      CONFIG_MODE:  jdbc           # or 'git' or 'native'
    depends_on:
      postgres: { condition: service_healthy }

  api-server:
    build: ./backend/api-server
    ports: ["8080:8080"]
    environment:
      DATABASE_URL:         jdbc:postgresql://postgres:5432/aimanager
      DB_USERNAME:          aimanager
      DB_PASSWORD:          ${DB_PASSWORD}
      CONFIG_SERVER_URL:    http://config-server:8888
      JWT_SECRET:           ${JWT_SECRET}
      SECRET_KEY:           ${SECRET_KEY}
      # LLM providers (optional — can also be set per-project in UI)
      ANTHROPIC_API_KEY:    ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY:       ${OPENAI_API_KEY:-}
    depends_on:
      postgres:      { condition: service_healthy }
      config-server: { condition: service_started }

  ui:
    build: .            # builds all MFEs, serves via nginx
    ports: ["5173:80"]
    environment:
      VITE_API_URL:    http://localhost:8080
      VITE_APP_ENV:    production
    depends_on: [api-server]

volumes:
  pgdata:
```

### Environment Variables

```bash
# .env.example

# Database
DB_PASSWORD=changeme

# Security
JWT_SECRET=change-me-min-32-chars
SECRET_KEY=change-me-for-encrypting-provider-keys

# Config Server mode: jdbc | git | native
CONFIG_MODE=jdbc

# Git mode only
CONFIG_GIT_URI=https://github.com/your-org/aiplane-config

# LLM Providers (optional — can be configured per-project in UI)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
```

---

## 9. UX Interaction Patterns

**Layout**
```
┌──────────────────────────────────────────────────────┐
│  [≡]  AIPlane       [Project ▼]       [user] [⚙]  │  48px top bar
├──────────┬───────────────────────────────────────────┤
│  Prompts │                                            │
│  Guards  │          Active MFE                        │
│  Users   │                                            │
│  Usage   │                                            │
│  ──────  │                                            │
│  Docs ↗  │                                            │
└──────────┴───────────────────────────────────────────┘
  160px / 48px collapsed
```

**Keyboard Shortcuts**
| Shortcut | Action |
|---|---|
| `Cmd+K` | Command palette |
| `Cmd+Enter` | Run playground |
| `Cmd+S` | Save draft |
| `G P` | Go to Prompts |
| `G G` | Go to Guardrails |
| `G U` | Go to Users |
| `G A` | Go to Usage (Analytics) |

**Feedback Patterns**
- Toasts for async results — auto-dismiss 4s
- Skeleton screens (not spinners) for loading
- Optimistic updates on toggles (revert on API error)
- Confirmation dialogs only for destructive actions (archive, delete, revoke)
- Empty states are always actionable ("Create your first prompt →")

---

## 10. Roadmap

### Phase 0 — Foundation ✅ (scaffolding exists)
- [x] pnpm + Turborepo monorepo
- [x] Vite Module Federation skeleton (5 apps)
- [ ] `packages/ui` with design tokens
- [ ] `packages/types` + `packages/api-client`
- [ ] Maven parent POM + two modules (config-server, api-server)
- [ ] Flyway migrations (V1–V9)
- [ ] Docker Compose full stack
- [ ] Dashboard shell: sidebar, project switcher, auth flow

### Phase 1 — Prompt Manager MVP

Complete via epic [#18](https://github.com/madmmas/aiplane/issues/18) (sub-issues [#50](https://github.com/madmmas/aiplane/issues/50)–[#53](https://github.com/madmmas/aiplane/issues/53)).

- [x] Prompt CRUD (Spring Data JPA)
- [x] Version history + promotion flow
- [x] Playground (Spring AI — Anthropic + OpenAI)
- [x] Version timeline component (+ library, editor, playground UI in Prompt Manager MFE)
- [ ] Config Server export on version promotion
  _(interface hooked on Active in #51; real write is Phase 5)_

### Phase 2 — Guardrail MVP

Complete via epic [#14](https://github.com/madmmas/aiplane/issues/14) (sub-issues [#54](https://github.com/madmmas/aiplane/issues/54)–[#56](https://github.com/madmmas/aiplane/issues/56)).

- [x] Keyword blocklist + regex filter + max-length evaluators (#54)
- [x] Guardrail sets with ordering (#55)
- [x] Test panel UI (#56)

### Phase 3 — Usage Telemetry

Complete via epic [#15](https://github.com/madmmas/aiplane/issues/15) (sub-issues [#57](https://github.com/madmmas/aiplane/issues/57)–[#59](https://github.com/madmmas/aiplane/issues/59)).

- [x] Usage event ingest (write endpoint for client apps) (#57)
- [x] Overview dashboard (KPIs + Recharts) (#59)
- [x] Cost tracking with provider rate config (#58)

### Phase 4 — User Management + API Keys
- [x] Invite flow + JWT auth (#60)
- [x] API key CRUD + permission scopes (#61)
- [x] `ApiKeyAuthenticationFilter` (#61)
- [x] User + API key management UI (#62)

### Phase 5 — Config Server Integration
- [ ] JDBC backend for Config Server
- [ ] `PromptConfigExporter` writing on version promotion
- [ ] Refresh endpoint proxied via API Server
- [ ] News Radar integration demo (Go client consuming Config Server)

### Phase 6 — Advanced
- [ ] PII detection guardrail
- [ ] Custom LLM Judge guardrail (Spring AI)
- [ ] Prompt compare (side-by-side playground)
- [ ] CSV export for usage logs
- [ ] GitHub Action: CI prompt deployment via API

---

## 11. Outstanding Decisions

| # | Question | Default | Confirm |
|---|---|---|---|
| 1 | Config Server backend: JDBC (shared DB) or Git for v1? | JDBC — simpler, no extra repo | ✅ |
| 2 | Spring Cloud Bus for refresh propagation or simple direct HTTP? | Direct HTTP (less ops overhead) | ? |
| 3 | Auth for v1: local JWT only or add OAuth2 (GitHub / Google)? | Local JWT — OAuth2 as Phase 6 | ? |
| 4 | Maven or Gradle for backend? | **Maven** | ✅ |
| 5 | Monolith or modular monolith? | **Modular monolith** | ✅ |
| 6 | Dark mode only or toggle? | Dark default, light available | ? |
| 7 | Spring AI version: lock to stable GA or track milestones? | Stable GA | ? |

---

*Cursor: start with Phase 0. Build `packages/ui` tokens and `backend/` Maven structure first — everything else depends on these two foundations.*

---

## 12. Frontend Tech Stack & UX Implementation

### Per-App Tech Stack

Every MFE (`dashboard`, `prompt-manager`, `guardrail`, `user-manager`, `usages-data`) uses the same stack:

| Layer | Library | Version |
|---|---|---|
| Framework | React 18 | 18.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Components | shadcn/ui | latest |
| Icons | Tabler Icons React | 3.x |
| State | Zustand | 4.x |
| Server state | TanStack Query (React Query) | 5.x |
| Forms | React Hook Form + Zod | 7.x / 3.x |
| Code editor | Monaco Editor React | 4.x |
| Charts | Recharts | 2.x |
| Drag & drop | @dnd-kit/core | 6.x |
| Notifications | Sonner (toasts) | 1.x |
| Date | date-fns | 3.x |
| Build | Vite + @originjs/vite-plugin-federation | — |

### Tailwind Configuration

Custom tokens extend the default Tailwind palette. All MFEs share the same `tailwind.config.ts` via `packages/ui`:

```typescript
// packages/ui/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['../../apps/*/src/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode default surface system
        surface: {
          base:    '#0f1117',   // page background
          card:    '#1a1d27',   // card / panel
          raised:  '#22263a',   // hover, code blocks
        },
        border: {
          subtle:  '#2e3248',
          default: '#3d4166',
        },
        accent: {
          DEFAULT: '#6c8ef5',
          hover:   '#8aa3f7',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['11px', '16px'],
        sm:    ['12px', '18px'],
        base:  ['13px', '20px'],
        md:    ['14px', '22px'],
        lg:    ['16px', '24px'],
        xl:    ['20px', '28px'],
        '2xl': ['28px', '36px'],
      },
    },
  },
} satisfies Config;
```

### shadcn/ui Component Usage

`packages/ui` re-exports shadcn primitives with AIPlane styling applied:

```
Button          → primary / ghost / destructive variants
Input           → with optional left icon slot
Textarea        → auto-resize variant for prompt editor
Select          → model picker, provider picker
Switch          → guardrail enable/disable toggles
Slider          → temperature, top-p parameters
Badge           → version status (draft/testing/active/archived)
Card            → prompt cards, guardrail cards
Dialog          → confirmation dialogs, key creation
Sheet           → side panels (version diff, test panel)
Tooltip         → parameter descriptions, truncated text
Table           → usage logs, user list, API key list
Command         → Cmd+K palette (shadcn/cmdk)
Separator       → sidebar dividers
```

Custom components built on top (not in shadcn):

```
VersionTimeline   → horizontal scrollable version history lane
CodeEditor        → Monaco + JetBrains Mono + syntax for {{variable}}
DiffViewer        → two-pane diff between prompt versions
KPICard           → metric + delta arrow (usage dashboard)
ProviderBadge     → Anthropic / OpenAI / Bedrock / Ollama logo + name
ModelPicker       → dropdown with context window size shown
PlaygroundPanel   → variable form + run button + response + metrics
GuardrailWizard   → 4-step creation flow (type → config → action → test)
```

### Design System Summary

**Colour palette (dark mode default, light mode toggle available):**

| Token | Hex | Usage |
|---|---|---|
| `surface-base` | `#0f1117` | Page background |
| `surface-card` | `#1a1d27` | Cards, sidebar |
| `surface-raised` | `#22263a` | Hover, code bg |
| `border-subtle` | `#2e3248` | Default borders |
| `text-primary` | `#e8eaf0` | Body text |
| `text-muted` | `#8b90a8` | Labels, secondary |
| `accent` | `#6c8ef5` | CTA, active states |
| `success` | `#34d399` | Active badge, success |
| `warning` | `#fbbf24` | Testing badge, warn |
| `error` | `#f87171` | Error, danger |
| `code-bg` | `#12151f` | Monaco editor bg |

**Typography:**
- Display / code / slugs: JetBrains Mono (signals engineering tool)
- All body text: Inter

**Signature component — Version Timeline:**

A horizontal scrollable lane showing every version as a circular node connected by a line — visual git log. The active version node is filled in `accent` blue. Selected (editing) version gets a ring. Clicking any node loads that version into the editor panel below.

```
  ○──○──○──[○]──○──●
  v1 v2 v3  v4  v5 v6(active)
               ↑ selected
```

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Global command palette |
| `Cmd+Enter` | Run playground |
| `Cmd+S` | Save draft |
| `Cmd+D` | Open diff view |
| `G P` | Go to Prompts |
| `G G` | Go to Guardrails |
| `G U` | Go to Users |
| `G A` | Go to Usage |

### Responsive Breakpoints

| Breakpoint | Sidebar | Playground | Layout |
|---|---|---|---|
| `≥ 1280px` | 180px fixed | Side-by-side compare | Full |
| `1024–1279px` | 48px icon-only | Single column | Compact |
| `< 1024px` | Overlay drawer | Single column | Mobile-first |
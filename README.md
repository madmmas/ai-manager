# AIPlane

[![CI](https://github.com/madmmas/aiplane/actions/workflows/ci.yml/badge.svg)](https://github.com/madmmas/aiplane/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A **micro-frontend** monorepo for AI management tooling. The project uses a host/remote architecture with **Module Federation** (Vite Plugin Federation), so the dashboard loads and runs multiple independent apps as federated modules.

For product intent, architecture, and roadmap, see [`docs/SPEC.md`](docs/SPEC.md).  
For the issue → branch → PR workflow, see [`docs/ISSUE_WORKFLOW.md`](docs/ISSUE_WORKFLOW.md).  
User-facing changes are tracked in [`CHANGELOG.md`](CHANGELOG.md).  
For engineering decisions and trade-offs, see [`docs/DEVLOG.md`](docs/DEVLOG.md).  
Client apps consuming Config Server (News Radar–style Go HTTP): see
[`docs/integrations/news-radar-config-server.md`](docs/integrations/news-radar-config-server.md)
and [`examples/news-radar-config/`](examples/news-radar-config/).

Static UI reference mockups live under [`mock/`](mock/) (including brand icons in `mock/icons/`). These files are **reference-only** — not part of the runtime app — and are excluded from Biome lint.

## Tech Stack

- **Monorepo**: pnpm workspaces + [Turborepo](https://turbo.build/)
- **Build**: [Vite](https://vitejs.dev/) + [@originjs/vite-plugin-federation](https://github.com/originjs/vite-plugin-federation)
- **UI**: React 19, TypeScript
- **Backend**: Java 21, Spring Boot 3.4, Spring Cloud Config, Spring AI (BOM)
- **Lint/Format**: [Biome](https://biomejs.dev/) (frontend)
- **CI**: GitHub Actions (`ci` — lint/typecheck/test/build; `backend` — Maven verify + JaCoCo)

## Apps

| App              | Port | Description                    |
|------------------|------|--------------------------------|
| **Dashboard**    | 5173 | Host app; loads other remotes  |
| **Prompt Manager** | 5174 | Prompt management              |
| **Guardrail**    | 5175 | Guardrail configuration        |
| **User Manager** | 5176 | User management                |
| **Usages Data**  | 5177 | Usage analytics / data         |

Each remote is meant to work **standalone** (its own Vite port) and as a **federated module** inside the dashboard. CSS strategy: per-remote Tailwind/`@repo/ui` pipeline in `main.tsx` + dashboard `content` scan for federated utility classes (see `.cursor/rules/module-federation.mdc`). **prompt-manager** is wired ([#108](https://github.com/madmmas/aiplane/issues/108)); other remotes still tracked in [#107](https://github.com/madmmas/aiplane/issues/107) ([#109](https://github.com/madmmas/aiplane/issues/109)–[#111](https://github.com/madmmas/aiplane/issues/111)).

## Prerequisites

- **Node.js** ≥ 18 (see [`.nvmrc`](.nvmrc) for recommended version)
- **pnpm** 9.x (recommended; project uses `packageManager: "pnpm@9.14.2"`)
- **JDK 21** + **Maven 3.9+** (for `backend/`)

Install pnpm if needed:

```bash
npm install -g pnpm@9
```

## Setup

```bash
# Install dependencies (from repo root)
pnpm install
```

## Running the project

### Running with Docker

Full stack (Postgres, config-server, api-server, nginx UI) per SPEC §8:

```bash
cp .env.example .env   # first time only — edit secrets as needed
make docker-up         # builds images and starts services
```

Then open:

- **UI**: http://localhost:5173  
- **API health**: http://localhost:8080/actuator/health  
- **Config health**: http://localhost:8888/actuator/health  
- **Postgres**: `localhost:5433` by default (`POSTGRES_PORT` in `.env`; user/db `aimanager`)

Useful commands:

```bash
make docker-ps       # service status
make docker-logs     # follow logs
make docker-down     # stop and remove containers
make docker-config   # validate compose files
```

Compose files: `docker-compose.yml` (base stack) + `docker-compose.dev.yml` (local ports / seed defaults).  
`CONFIG_MODE` defaults to `native` (classpath config). Set `CONFIG_MODE=jdbc` to serve properties from shared Postgres `config_properties` (Flyway V9; Compose already passes `DATABASE_URL`). Git mode uses `CONFIG_GIT_URI` ([#17](https://github.com/madmmas/aiplane/issues/17) / [#63](https://github.com/madmmas/aiplane/issues/63)).

### Development (all apps)

Starts every app in dev mode. The dashboard (host) and remotes must all be running for federation to work.

```bash
pnpm dev
```

Then open:

- **Dashboard (host)**: http://localhost:5173  
- Prompt Manager: http://localhost:5174  
- Guardrail: http://localhost:5175  
- User Manager: http://localhost:5176  
- Usages Data: http://localhost:5177  

### Build

Build all apps (respects Turborepo dependency order and caching):

```bash
pnpm build
```

Outputs go to each app's `dist/` folder.

### Preview (production build locally)

Build first, then run preview for all apps:

```bash
pnpm build
pnpm preview
```

Same ports as dev (e.g. dashboard at http://localhost:5173).

## Quality checks

```bash
pnpm lint        # Biome lint and format check
pnpm lint:fix    # Auto-fix lint and format issues
pnpm typecheck   # TypeScript type checking
pnpm test        # Vitest unit/component tests (all apps + packages)
pnpm build       # Production build
```

### Frontend testing

- **Runner:** [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) + `@testing-library/jest-dom`
- **HTTP mocks:** Prefer [MSW](https://mswjs.io/) for `packages/api-client` network calls (see `packages/api-client/src/test/msw/`) instead of stubbing `fetch` by hand
- **Layout:** Colocate tests next to source as `*.test.ts` / `*.test.tsx` (no parallel `__tests__/` tree)
- **Config:** Shared base in `vitest.shared.ts` / `vitest.setup.ts`; each app/package has its own `vitest.config.ts`
- **Watch mode:** `pnpm turbo test:watch --filter=@repo/<name>` or `pnpm test:watch` inside a package

Example:

```bash
pnpm test                              # all packages via Turbo
pnpm test:coverage                     # same + V8 coverage reports under each package's coverage/
pnpm turbo test --filter=@repo/ui      # one package
```

CI runs `pnpm test:coverage` inside the required `ci` job (so a failing suite blocks merges) and uploads HTML/LCOV artifacts. Backend coverage comes from JaCoCo on `mvn verify` in the `backend` job.

## Running a single app

From repo root, use Turbo's filter:

```bash
# Only dashboard
pnpm turbo dev --filter=@repo/dashboard

# Only prompt-manager
pnpm turbo dev --filter=@repo/prompt-manager
```

Or from the app directory:

```bash
cd apps/dashboard && pnpm dev
```

Note: For full micro-frontend behavior, run `pnpm dev` at the root so host and remotes are all up. Single-app filters are useful for standalone remote work once CSS dual-mode (#107–#111) is in place.

## Project structure

```
aiplane/
├── apps/
│   ├── dashboard/      # Host app (port 5173)
│   ├── guardrail/      # Remote (port 5175)
│   ├── prompt-manager/ # Remote (port 5174)
│   ├── user-manager/   # Remote (port 5176)
│   └── usages-data/    # Remote (port 5177)
├── packages/
│   ├── ui/               # Shared design system (tokens + shadcn)
│   ├── types/            # Shared TypeScript DTOs
│   └── api-client/       # Fetch client + React Query hooks
├── backend/
│   ├── api-server/       # Spring Boot API (:8080)
│   └── config-server/    # Spring Cloud Config (:8888)
├── docker/
│   ├── nginx.conf        # UI reverse paths for federated remotes
│   └── ui.Dockerfile     # pnpm build + nginx image
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── docs/
│   ├── SPEC.md           # Product spec and architecture
│   ├── ISSUE_WORKFLOW.md # Issue / branch / PR workflow
│   ├── DEVLOG.md         # Engineering decisions and trade-offs
│   └── integrations/     # Reference client integrations (Config Server, …)
├── examples/
│   └── news-radar-config/ # Minimal Go HTTP client for Config Server
├── mock/                 # UI mock + brand icons (reference only)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── Makefile              # Common commands (make help)
```

## Backend (Java)

See [`backend/README.md`](backend/README.md). Quick start:

```bash
make backend-build
make backend-api   # http://localhost:8080/actuator/health
```

## Makefile

Common tasks are available via `make` (see `make help`):

- `make install` – install dependencies  
- `make dev` – run all apps in dev  
- `make build` – build all apps  
- `make preview` – preview production build  
- `make lint` – run Biome lint/format check  
- `make typecheck` – run TypeScript type checking  
- `make test` – run Vitest unit/component tests  
- `make backend-build` / `make backend-api` – Maven verify / run API server  
- `make docker-up` / `make docker-down` – full Docker Compose stack  
- `make clean` – remove build artifacts and caches  

Run `make help` for the full list.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and pull request guidelines.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Security

To report a security vulnerability, please follow the process in [SECURITY.md](SECURITY.md). Do not open public issues for security concerns.

## License

This project is licensed under the [MIT License](LICENSE).

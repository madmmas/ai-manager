# AI Manager

A **micro-frontend** monorepo for AI management tooling. The project uses a host/remote architecture with **Module Federation** (Vite Plugin Federation), so the dashboard loads and runs multiple independent apps as federated modules.

## Tech Stack

- **Monorepo**: pnpm workspaces + [Turborepo](https://turbo.build/)
- **Build**: [Vite](https://vitejs.dev/) + [@originjs/vite-plugin-federation](https://github.com/originjs/vite-plugin-federation)
- **UI**: React 18, TypeScript

## Apps

| App              | Port | Description                    |
|------------------|------|--------------------------------|
| **Dashboard**    | 5173 | Host app; loads other remotes  |
| **Prompt Manager** | 5174 | Prompt management              |
| **Guardrail**    | 5175 | Guardrail configuration        |
| **User Manager** | 5176 | User management                |
| **Usages Data**  | 5177 | Usage analytics / data         |

## Prerequisites

- **Node.js** ≥ 18  
- **pnpm** 9.x (recommended; project uses `packageManager: "pnpm@9.14.2"`)

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

Outputs go to each app’s `dist/` folder.

### Preview (production build locally)

Build first, then run preview for all apps:

```bash
pnpm build
pnpm preview
```

Same ports as dev (e.g. dashboard at http://localhost:5173).

## Running a single app

From repo root, use Turbo’s filter:

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

Note: For full micro-frontend behavior, run `pnpm dev` at the root so host and remotes are all up.

## Project structure

```
ai-manager/
├── apps/
│   ├── dashboard/      # Host app (port 5173)
│   ├── guardrail/      # Remote (port 5175)
│   ├── prompt-manager/ # Remote (port 5174)
│   ├── user-manager/   # Remote (port 5176)
│   └── usages-data/    # Remote (port 5177)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── Makefile            # Common commands (make help)
```

## Makefile

Common tasks are available via `make` (see `make help`):

- `make install` – install dependencies  
- `make dev` – run all apps in dev  
- `make build` – build all apps  
- `make preview` – preview production build  
- `make clean` – remove build artifacts and caches  

Run `make help` for the full list.

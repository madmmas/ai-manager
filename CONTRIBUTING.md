# Contributing to AIPlane

Thank you for your interest in contributing to AIPlane! This document outlines how to get started.

## Prerequisites

- **Node.js** ≥ 18 (see [`.nvmrc`](.nvmrc) for the recommended version)
- **pnpm** 9.x
- **JDK 21** + **Maven 3.9+** for backend work (`backend/`; see [`backend/README.md`](backend/README.md))
- **Docker** for Compose / Testcontainers integration tests

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

3. Start all apps in development mode:

   ```bash
   pnpm dev
   ```

   The dashboard (host) runs at http://localhost:5173. All remotes must be running for Module Federation to work.

## Development workflow

Before submitting a pull request, run:

```bash
pnpm lint        # Check formatting and lint rules
pnpm typecheck   # TypeScript type checking
pnpm test        # Vitest unit/component tests
pnpm build       # Production build
```

You can also use `make lint`, `make typecheck`, `make test`, and `make build` as shortcuts.

### Frontend tests

Colocate tests next to the file under test (`Button.tsx` → `Button.test.tsx`). Use React Testing Library queries (`getByRole`, `getByLabelText`) and MSW for HTTP mocks in `packages/api-client`. See the **Frontend testing** section in [`README.md`](README.md).

To auto-fix lint and format issues:

```bash
pnpm lint:fix
```

## Architecture

For product intent, architecture decisions, and the full roadmap, see [`docs/SPEC.md`](docs/SPEC.md).

Engineering decisions and trade-offs that are not user-facing live in
[`docs/DEVLOG.md`](docs/DEVLOG.md) (process-facing journal). User-facing shipped
changes belong in [`CHANGELOG.md`](CHANGELOG.md) — do not put "why we chose X" into
the changelog or "what shipped in 0.1.0" into the DEVLOG.

### When to write a DEVLOG entry

Add a reverse-chronological entry to `docs/DEVLOG.md` in the **same PR** when you:

- Make a non-trivial architecture decision (persistence style, auth model, federation boundary)
- Accept an explicit trade-off or leave known drift (e.g. SPEC says one thing, code does another for now)
- Hit a dead end worth warning the next person about

Skip a DEVLOG entry for routine features, renames, dependency bumps, and docs typos —
those are covered by the PR description and, when user-facing, the CHANGELOG.

## Pull requests

1. Create a feature branch from `main` (direct commits to `main` are blocked locally by Husky and on GitHub by branch protection).
2. Make your changes with clear, focused commits. Link the issue (`Closes #N` in the PR body).
3. Fill out the pull request template completely.
4. Ensure the required `ci` check passes (lint → typecheck → test → build). Merges to `main` require a green `ci` status. The `backend` job also runs `mvn verify` (unit + Testcontainers + JaCoCo); keep it green even when it is not a required check.
5. For **user-facing** changes (features, fixes, breaking behavior), add an entry under
   `[Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md) in the same PR — Keep a Changelog
   categories (`Added` / `Changed` / `Fixed` / `Removed` / `Deprecated` / `Security`).
   Pure chores, internal refactors, and docs-only PRs do not need a CHANGELOG line unless
   they affect how users or downstream apps consume the project.

Code owners listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) are auto-requested for review
on matching paths.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Questions

Open a [GitHub issue](https://github.com/madmmas/aiplane/issues) for bugs, feature requests, or questions.

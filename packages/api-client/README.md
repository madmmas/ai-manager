# `@repo/api-client`

Typed fetch wrapper + React Query hooks shared by every AIPlane MFE.

## Install

Workspace packages are already listed in `pnpm-workspace.yaml`. From an app:

```bash
pnpm add @repo/api-client @tanstack/react-query --filter @repo/dashboard
```

## Setup

Wrap the shell (or each MFE) with React Query + the API client:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientProvider, useProjects, usePrompts } from "@repo/api-client";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider
        config={{
          baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
          // UI auth uses httpOnly cookies (aiplane_access / aiplane_refresh).
          // Prefer same-origin or CORS credentials once the host leaves mock mode.
          // Optional: getAccessToken for Bearer tokens (e.g. transitional clients).
          useMocks: true, // set false to hit the live Spring API
        }}
      >
        {children}
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
```

## Hooks

```tsx
const { data: projects, isLoading } = useProjects();
const { data: prompts } = usePrompts({ projectId: projects?.[0]?.id });
```

Domain hooks cover prompts, versions, playground, guardrails, usage, users, and API keys.
`useProjects` still uses fixtures until a projects REST API exists.

## Low-level client

```ts
import { createApiClient } from "@repo/api-client";

const api = createApiClient({
  baseUrl: "http://localhost:8080",
  useMocks: false,
  // Optional Bearer helper (API keys / tooling). UI sessions use cookies instead.
  // getAccessToken: () => null,
});

const prompts = await api.apiFetch("/api/v1/prompts", {
  query: { projectId: "proj_news_radar" },
});
```

**Auth**

- **Browser UI (Phase 4):** JWTs are httpOnly cookies — do not put access tokens in
  `localStorage` / `sessionStorage`. Cookie auth requires CORS `allowCredentials` and
  fetch credentials when calling a cross-origin API.
- **Optional Bearer:** when `getAccessToken` returns a value, requests (unless
  `skipAuth: true`) get `Authorization: Bearer <token>` (useful for API keys /
  non-browser clients).
- **Programmatic clients:** prefer `X-API-Key: aimg_…` (or Bearer `aimg_…`) with scopes.

# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# Same-origin remote paths served by nginx (see docker/nginx.conf)
ENV VITE_REMOTE_PROMPT_MANAGER=/remotes/prompt-manager/assets/remoteEntry.js \
    VITE_REMOTE_GUARDRAIL=/remotes/guardrail/assets/remoteEntry.js \
    VITE_REMOTE_USER_MANAGER=/remotes/user-manager/assets/remoteEntry.js \
    VITE_REMOTE_USAGES_DATA=/remotes/usages-data/assets/remoteEntry.js

RUN VITE_BASE=/remotes/prompt-manager/ pnpm --filter @repo/prompt-manager build \
 && VITE_BASE=/remotes/guardrail/ pnpm --filter @repo/guardrail build \
 && VITE_BASE=/remotes/user-manager/ pnpm --filter @repo/user-manager build \
 && VITE_BASE=/remotes/usages-data/ pnpm --filter @repo/usages-data build \
 && pnpm --filter @repo/dashboard build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html/dashboard
COPY --from=build /app/apps/prompt-manager/dist /usr/share/nginx/html/remotes/prompt-manager
COPY --from=build /app/apps/guardrail/dist /usr/share/nginx/html/remotes/guardrail
COPY --from=build /app/apps/user-manager/dist /usr/share/nginx/html/remotes/user-manager
COPY --from=build /app/apps/usages-data/dist /usr/share/nginx/html/remotes/usages-data

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

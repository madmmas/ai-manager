# AIPlane micro-frontend — common commands
# Usage: make [target]; run 'make help' for list

.PHONY: help install dev build preview lint typecheck test clean \
	dev-dashboard dev-prompt dev-guardrail dev-user dev-usages \
	backend-build backend-api backend-config backend-test openapi \
	docker-up docker-down docker-logs docker-ps docker-config

COMPOSE = docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env

# Default target
help:
	@echo "AIPlane — available targets:"
	@echo ""
	@echo "  make install      Install dependencies (pnpm install)"
	@echo "  make dev          Run all apps in development mode"
	@echo "  make build        Build all apps for production"
	@echo "  make preview      Preview production build (run after make build)"
	@echo "  make lint         Run Biome lint and format check"
	@echo "  make typecheck    Run TypeScript type checking"
	@echo "  make test         Run Vitest unit/component tests"
	@echo "  make clean        Remove dist/ and .turbo caches"
	@echo ""
	@echo "  make dev-dashboard    Run only dashboard (port 5173)"
	@echo "  make dev-prompt      Run only prompt-manager (port 5174)"
	@echo "  make dev-guardrail   Run only guardrail (port 5175)"
	@echo "  make dev-user        Run only user-manager (port 5176)"
	@echo "  make dev-usages      Run only usages-data (port 5177)"
	@echo ""
	@echo "  make backend-build   Maven verify for backend modules (unit + IT + JaCoCo)"
	@echo "  make backend-test    Alias for backend-build (runs Failsafe Testcontainers)"
	@echo "  make backend-api     Run api-server on :8080"
	@echo "  make backend-config  Run config-server on :8888"
	@echo "  make openapi         Regenerate frozen OpenAPI YAML under docs/api/ (Docker)"
	@echo ""
	@echo "  make docker-up       Start full stack (compose + .env)"
	@echo "  make docker-down     Stop stack and remove containers"
	@echo "  make docker-logs     Tail compose logs"
	@echo "  make docker-ps       Show compose service status"
	@echo "  make docker-config   Validate compose files"
	@echo ""

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

preview:
	pnpm preview

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

clean:
	rm -rf apps/*/dist apps/*/.turbo .turbo backend/**/target

# Single-app dev (for when you only need one app)
dev-dashboard:
	pnpm turbo dev --filter=@repo/dashboard

dev-prompt:
	pnpm turbo dev --filter=@repo/prompt-manager

dev-guardrail:
	pnpm turbo dev --filter=@repo/guardrail

dev-user:
	pnpm turbo dev --filter=@repo/user-manager

dev-usages:
	pnpm turbo dev --filter=@repo/usages-data

# Backend (Java 21 + Maven)
backend-build:
	mvn -f backend/pom.xml -B verify

backend-test:
	mvn -f backend/pom.xml -B verify

backend-api:
	mvn -f backend/api-server/pom.xml spring-boot:run

backend-config:
	mvn -f backend/config-server/pom.xml spring-boot:run

openapi:
	./backend/scripts/generate-openapi.sh

# Docker Compose full stack (SPEC §8)
docker-up:
	@test -f .env || cp .env.example .env
	$(COMPOSE) up --build -d

docker-down:
	@test -f .env || cp .env.example .env
	$(COMPOSE) down

docker-logs:
	@test -f .env || cp .env.example .env
	$(COMPOSE) logs -f --tail=200

docker-ps:
	@test -f .env || cp .env.example .env
	$(COMPOSE) ps

docker-config:
	@test -f .env || cp .env.example .env
	$(COMPOSE) config >/dev/null
	@echo "docker compose config OK"

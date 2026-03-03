# AI Manager micro-frontend — common commands
# Usage: make [target]; run 'make help' for list

.PHONY: help install dev build preview clean dev-dashboard dev-prompt dev-guardrail dev-user dev-usages

# Default target
help:
	@echo "AI Manager — available targets:"
	@echo ""
	@echo "  make install      Install dependencies (pnpm install)"
	@echo "  make dev          Run all apps in development mode"
	@echo "  make build        Build all apps for production"
	@echo "  make preview      Preview production build (run after make build)"
	@echo "  make clean        Remove dist/ and .turbo caches"
	@echo ""
	@echo "  make dev-dashboard    Run only dashboard (port 5173)"
	@echo "  make dev-prompt      Run only prompt-manager (port 5174)"
	@echo "  make dev-guardrail   Run only guardrail (port 5175)"
	@echo "  make dev-user        Run only user-manager (port 5176)"
	@echo "  make dev-usages      Run only usages-data (port 5177)"
	@echo ""

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

preview:
	pnpm preview

clean:
	rm -rf apps/*/dist apps/*/.turbo .turbo

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

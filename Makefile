# Makefile for OpenCode Agent Manager
# Desktop manager for OpenCode agents (Tauri + React + TypeScript + Rust)

# Configuration
.PHONY: help install install-oc dev tauri-dev tauri-build executable build check fmt lint test clean reset

help:
	@echo "Available commands:"
	@echo "  make install      Install npm dependencies and Rust crates"
	@echo "  make install-oc   Install OpenCode workflows loader"
	@echo "  make dev          Start the standalone Vite frontend"
	@echo "  make tauri-dev    Start the Tauri app in development mode"
	@echo "  make build        Build the frontend"
	@echo "  make tauri-build  Build the Tauri desktop binary"
	@echo "  make executable   Create ./bin/opencode-agent-manager"
	@echo "  make check        Check TypeScript types and Rust metadata"
	@echo "  make fmt          Format Rust and TypeScript code when available"
	@echo "  make lint         Run basic lint checks"
	@echo "  make test         Run available tests"
	@echo "  make clean        Remove node_modules, dist, and target"
	@echo "  make reset        Clean everything and reinstall"

install:
	@echo "==> Installing npm dependencies..."
	npm install
	@echo "==> Installing Rust crates..."
	cd src-tauri && cargo fetch

install-oc:
	@echo "==> Installing OpenCode workflows loader..."
	node scripts/install-opencode-workflows-loader.mjs

dev:
	@echo "==> Starting Vite dev server..."
	npm run dev

tauri-dev:
	@echo "==> Starting Tauri in development mode..."
	npm run tauri dev

build:
	@echo "==> Building frontend..."
	npm run build

tauri-build:
	@echo "==> Building Tauri binary..."
	npm run tauri -- build

executable:
	@echo "==> Creating executable at ./bin/opencode-agent-manager..."
	npm run tauri -- build --no-bundle
	mkdir -p bin
	cp src-tauri/target/release/opencode-agent-manager bin/opencode-agent-manager-bin
	printf '%s\n' '#!/usr/bin/env sh' 'set -eu' '' 'APP_DIR=$$(CDPATH= cd -- "$$(dirname -- "$$0")" && pwd)' 'export WEBKIT_DISABLE_DMABUF_RENDERER="$${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"' 'exec "$$APP_DIR/opencode-agent-manager-bin" "$$@"' > bin/opencode-agent-manager
	chmod +x bin/opencode-agent-manager bin/opencode-agent-manager-bin

check:
	@echo "==> Checking TypeScript..."
	npx tsc --noEmit
	@echo "==> Checking Rust metadata..."
	cd src-tauri && cargo metadata --no-deps --format-version 1 > /dev/null

fmt:
	@echo "==> Formatting Rust..."
	cd src-tauri && cargo fmt || true
	@echo "==> Formatting TypeScript..."
	npx prettier --write "src/**/*.{ts,tsx}" "shared/**/*.{ts,tsx}" || true

lint:
	@echo "==> Running TypeScript lint..."
	npx tsc --noEmit

clean:
	@echo "==> Removing build artifacts..."
	rm -rf node_modules dist src-tauri/target

test:
	@echo "==> Running Rust tests..."
	cd src-tauri && cargo test

reset: clean install
	@echo "==> Environment reset."

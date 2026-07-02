# Makefile para OpenCode Agent Manager
# Gestor desktop de agentes OpenCode (Tauri + React + TypeScript + Rust)

# Configuração
.PHONY: help install dev tauri-dev tauri-build executable build check fmt lint test clean reset

help:
	@echo "Comandos disponíveis:"
	@echo "  make install      Instala dependências npm e crates"
	@echo "  make dev          Inicia o frontend Vite standalone"
	@echo "  make tauri-dev    Inicia a aplicação Tauri em modo desenvolvimento"
	@echo "  make build        Compila o frontend"
	@echo "  make tauri-build  Compila o binário desktop Tauri"
	@echo "  make executable   Cria ./bin/opencode-agent-manager"
	@echo "  make check        Verifica tipos TypeScript e metadados Rust"
	@echo "  make fmt          Formata código Rust e TypeScript (se disponível)"
	@echo "  make lint         Executa lint básico"
	@echo "  make test         Executa testes disponíveis"
	@echo "  make clean        Remove node_modules, dist e target"
	@echo "  make reset        Limpa tudo e reinstala"

install:
	@echo "==> A instalar dependências npm..."
	npm install
	@echo "==> A instalar crates Rust..."
	cd src-tauri && cargo fetch

dev:
	@echo "==> A iniciar Vite dev server..."
	npm run dev

tauri-dev:
	@echo "==> A iniciar Tauri em modo desenvolvimento..."
	npm run tauri dev

build:
	@echo "==> A compilar frontend..."
	npm run build

tauri-build:
	@echo "==> A compilar binário Tauri..."
	npm run tauri build

executable: build
	@echo "==> A criar executável em ./bin/opencode-agent-manager..."
	cd src-tauri && cargo build --release
	mkdir -p bin
	cp src-tauri/target/release/opencode-agent-manager bin/opencode-agent-manager
	chmod +x bin/opencode-agent-manager

check:
	@echo "==> A verificar TypeScript..."
	npx tsc --noEmit
	@echo "==> A verificar metadados Rust..."
	cd src-tauri && cargo metadata --no-deps --format-version 1 > /dev/null

fmt:
	@echo "==> A formatar Rust..."
	cd src-tauri && cargo fmt || true
	@echo "==> A formatar TypeScript..."
	npx prettier --write "src/**/*.{ts,tsx}" "shared/**/*.{ts,tsx}" || true

lint:
	@echo "==> A executar lint TypeScript..."
	npx tsc --noEmit

clean:
	@echo "==> A remover artefactos de build..."
	rm -rf node_modules dist src-tauri/target

test:
	@echo "==> A executar testes Rust..."
	cd src-tauri && cargo test

reset: clean install
	@echo "==> Ambiente reposto."

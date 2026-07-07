# Architecture

## Goal

Keep the codebase easy to navigate, with clear boundaries between UI, domain, services, and infrastructure.

## Frontend: `src/`

- `app/`: application bootstrap.
- `layouts/`: high-level visual composition.
- `pages/`: pages that connect features.
- `features/agents/`: everything specific to agents.
- `components/ui/`: reusable visual primitives.
- `components/common/`: shared semantic components.
- `styles/`: global theme.

Rule: generic components must not import features.

## Backend: `src-tauri/src/`

- `commands/`: thin Tauri layer, no business logic.
- `domain/`: core types and concepts.
- `services/`: use cases and orchestration.
- `infrastructure/`: filesystem, parsing, OpenCode config discovery.
- `errors/`: unified error type for the frontend.
- `config/`: application configuration.
- `utils/`: small pure helpers.

Dependency rule:

```txt
commands -> services -> domain
services -> infrastructure
domain -> nothing external
```

## Scan Flow

```txt
UI -> agentsApi.scanAgents -> Tauri command -> ScanService -> ConfigDiscovery/FsRepository/JsoncParser/MarkdownAgentParser/ConfigParser -> ScanResult
```

The backend only returns real data found on the filesystem. The mock is restricted to the frontend when running in browser/Vite mode.

## ScanResult

The scanner returns:

- `agents`: normalized agents.
- `permissionProfiles`: profiles derived from the real OpenCode model (`permission`, overrides, legacy `tools`, and effective permissions).
- `instructionSources`: prompts, `{file:...}` references, `instructions`, and markdown bodies.
- `configFiles`: discovered files with raw config and counters.

Discovery is broad and recursive across `json/jsonc/md`, but the result is filtered. Random files are only read as candidates and do not appear in the UI unless they contain an OpenCode agent/config structure.

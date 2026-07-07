# MVP

## Sprint 1: Navigable Base

- Tauri + React + TypeScript skeleton.
- Premium dark layout with sidebar, main panel, and status panel.
- Mocked agent list.
- Type filters.
- Agent selection.
- Model, source, permissions, instructions, and risk display.
- Rust backend already split into layers with the `scan_agents` command.

## Sprint 2: Real Scanner

- Discover `.opencode/`, `opencode.json`, `opencode.jsonc`, `$XDG_CONFIG_HOME/opencode`, and `~/.config/opencode/`.
- Accept `projectRoot` in the `scan_agents` Tauri command so the UI can choose the project root.
- Recursively read `.json`, `.jsonc`, and `.md` files up to 8 levels deep, ignoring obvious folders such as `node_modules`, `target`, `dist`, `.git`, caches, logs, state, and sessions.
- Keep only files with real OpenCode agent/config signals to avoid confusing random JSON/Markdown with agents.
- Do not automatically treat every `docs/agents/*.md` file as an agent. Markdown needs frontmatter or agent signals.
- Parse JSON/JSONC with MVP support for comments and trailing commas.
- Normalize configs with `agent`, `agents`, or individual files under `agents/` into `AgentDto`.
- Calculate basic risk from permissions/tools.
- Show invalid configs as `unknown` agents with validation errors.

Status: implemented. The mock fallback only exists in the frontend when the app runs outside the Tauri runtime.

## Sprint 3: Safe Editing

A full-visibility sprint was added before editing:

- `scan_agents` returns `ScanResult` instead of only `Agent[]`.
- `ScanResult` includes agents, derived permission profiles, instruction sources, and config files.
- UI has tabs: `Agents`, `Permissions`, `Instructions`, `Config Files`, `Raw`.
- `Permission Profiles` are derived from `permission`, agent overrides, legacy `tools`, and effective permissions.
- Markdown agents in `agents/*.md` are supported by the MVP scanner.

- Edit model, description, and instructions.
- Validate before saving.
- Create automatic backups.
- Detect conflicts via `lastModified` or hash.

## Sprint 4: Permissions And Raw Editor

- Visual permission editor.
- Improved risk classification.
- Raw JSON/JSONC editor.

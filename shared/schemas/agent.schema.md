# Agent DTO Schema

Manual MVP contract between the frontend and backend.

- `id`: stable unique identifier.
- `name`: visible agent name.
- `type`: `primary`, `subagent`, or `unknown`.
- `source`: `project` or `global`.
- `sourcePath`: source file path.
- `model`: model used by the agent.
- `instructions`: instructions/system prompt.
- `permissions`: normalized permissions with calculated risk.
- `rawConfig`: original configuration.
- `risk`: aggregated risk.
- `validationErrors`: errors that block or warn before saving.
- `lastModified`: timestamp used to detect conflicts.

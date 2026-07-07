# Agent DTO Schema

Contrato manual do MVP entre frontend e backend.

- `id`: stable unique identifier.
- `name`: visible agent name.
- `type`: `primary`, `subagent` ou `unknown`.
- `source`: `project` ou `global`.
- `sourcePath`: source file path.
- `model`: model used by the agent.
- `instructions`: instructions/system prompt.
- `permissions`: normalized permissions with calculated risk.
- `rawConfig`: original configuration.
- `risk`: risco agregado.
- `validationErrors`: erros que bloqueiam ou avisam antes de guardar.
- `lastModified`: timestamp usado para detectar conflitos.

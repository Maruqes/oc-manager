# Agent DTO Schema

Contrato manual do MVP entre frontend e backend.

- `id`: identificador único estável.
- `name`: nome visível do agente.
- `type`: `primary`, `subagent` ou `unknown`.
- `source`: `project` ou `global`.
- `sourcePath`: caminho do ficheiro de origem.
- `model`: modelo usado pelo agente.
- `instructions`: instruções/system prompt.
- `permissions`: permissões normalizadas com risco calculado.
- `rawConfig`: configuração original.
- `risk`: risco agregado.
- `validationErrors`: erros que bloqueiam ou avisam antes de guardar.
- `lastModified`: timestamp usado para detectar conflitos.

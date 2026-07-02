# Formato de Configuração OpenCode

Documento de trabalho para mapear formatos reais encontrados em configs OpenCode.

## Candidatos iniciais

- ficheiros `.json`, `.jsonc` e `.md` encontrados recursivamente no projeto atual
- ficheiros `.json`, `.jsonc` e `.md` encontrados recursivamente em `~/.config/opencode/`
- pastas óbvias de build/cache/dependências são ignoradas
- ficheiros candidatos não-OpenCode muito grandes são ignorados para evitar custo excessivo de leitura/parsing

O scanner lê candidatos de forma ampla, mas só adiciona ao resultado ficheiros que tenham sinais de OpenCode/agente:

- mapa `agent` ou `agents`
- ficheiro em pasta `agents/` ou `agent/`
- `opencode.json` ou `opencode.jsonc`
- frontmatter Markdown com campos de agente
- `permission`/`instructions` em caminho provável de OpenCode

Para evitar falsos positivos, Markdown sem frontmatter não vira agente apenas por estar numa pasta chamada `agents`. JSON/Markdown fora de caminhos prováveis precisa de sinais explícitos de agente, como `mode`, `model`, `permission`, `tools` ou limites de execução.

## Campos normalizados no MVP

- `name`
- `type`
- `description`
- `model`
- `instructions`
- `permissions`

## Estruturas reconhecidas

### Mapa `agent`

```jsonc
{
  "agent": {
    "reviewer": {
      "mode": "subagent",
      "description": "Revisor de código",
      "model": "provider/model",
      "prompt": "Instruções...",
      "tools": {
        "read": true,
        "write": false
      }
    }
  }
}
```

### Mapa `agents`

Também é aceite para compatibilidade.

### Ficheiros individuais em `agents/`

Um ficheiro JSON/JSONC dentro de uma pasta chamada `agents` é tratado como subagent.

## Heurísticas atuais

- `mode/type/agentType = primary|main|default` => primary agent.
- `mode/type/agentType = subagent|sub-agent|sub` => subagent.
- ficheiros dentro de `agents/` => subagent.
- configs top-level com `model`, `prompt`, `instructions`, `system`, `tools` ou `permissions` => agente individual.
- permissões com `write`, `edit`, `delete`, `bash`, `shell`, `command` ou `exec` => alto risco se ativas.
- permissões com `network`, `web`, `http` ou `fetch` => risco médio.

O scanner real deve preservar `rawConfig` para evitar perda de dados ao guardar.

## Modelo real de permissões OpenCode

O schema oficial não define uma entidade chamada `permissionProfiles`. A aplicação usa esse nome apenas como visualização derivada de:

- `permission` global.
- `agent.<name>.permission` como override por agente.
- `tools` legado, marcado como deprecated.
- permissões efetivas calculadas para cada agente.

As ações válidas são:

- `allow`
- `ask`
- `deny`

Regras granulares podem usar padrões:

```jsonc
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny"
    },
    "task": {
      "*": "deny",
      "reviewer": "allow"
    }
  }
}
```

## Agentes Markdown

Também são reconhecidos ficheiros `*.md` em diretórios `agents/`. O parser MVP lê frontmatter simples e trata o corpo markdown como prompt do agente.

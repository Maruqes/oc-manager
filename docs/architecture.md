# Arquitetura

## Objetivo

Manter uma codebase fácil de navegar, com fronteiras claras entre UI, domínio, serviços e infraestrutura.

## Frontend: `src/`

- `app/`: inicialização da aplicação.
- `layouts/`: composição visual macro.
- `pages/`: páginas que ligam features.
- `features/agents/`: tudo que é específico de agentes.
- `components/ui/`: primitivos visuais reutilizáveis.
- `components/common/`: componentes comuns com alguma semântica.
- `styles/`: tema global.

Regra: componentes genéricos não importam features.

## Backend: `src-tauri/src/`

- `commands/`: camada fina Tauri, sem regra de negócio.
- `domain/`: tipos e conceitos centrais.
- `services/`: casos de uso e orquestração.
- `infrastructure/`: filesystem, parsing, descoberta de configs OpenCode.
- `errors/`: erro unificado para frontend.
- `config/`: configuração da aplicação.
- `utils/`: helpers pequenos e puros.

Regra de dependência:

```txt
commands -> services -> domain
services -> infrastructure
domain -> nada externo
```

## Fluxo scan

```txt
UI -> agentsApi.scanAgents -> Tauri command -> ScanService -> ConfigDiscovery/FsRepository/JsoncParser/MarkdownAgentParser/ConfigParser -> ScanResult
```

O backend retorna apenas dados reais encontrados no filesystem. O mock é restrito ao frontend em modo browser/Vite.

## ScanResult

O scanner retorna:

- `agents`: agentes normalizados.
- `permissionProfiles`: perfis derivados do modelo real do OpenCode (`permission`, overrides, `tools` legado e effective permissions).
- `instructionSources`: prompts, referências `{file:...}`, `instructions` e markdown bodies.
- `configFiles`: ficheiros descobertos com raw config e contadores.

O discovery é amplo (`json/jsonc/md` recursivo), mas o resultado é filtrado: ficheiros aleatórios só são lidos como candidatos e não aparecem na UI se não tiverem estrutura de agente/config OpenCode.

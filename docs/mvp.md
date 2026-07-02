# MVP

## Sprint 1: base navegável

- Skeleton Tauri + React + TypeScript.
- Layout dark premium com sidebar, painel principal e painel de estado.
- Lista de agentes mockados.
- Filtros por tipo.
- Seleção de agente.
- Visualização de modelo, origem, permissões, instruções e risco.
- Backend Rust já separado por camadas e command `scan_agents`.

## Sprint 2: scanner real

- Descobrir `.opencode/`, `opencode.json`, `opencode.jsonc`, `$XDG_CONFIG_HOME/opencode` e `~/.config/opencode/`.
- Aceitar `projectRoot` no command Tauri `scan_agents` para permitir selecionar a raiz do projeto pela UI.
- Ler recursivamente ficheiros `.json`, `.jsonc` e `.md` até 8 níveis de profundidade, ignorando pastas óbvias como `node_modules`, `target`, `dist`, `.git`, caches, logs e estado/sessões.
- Manter no resultado apenas ficheiros com sinais reais de agente/config OpenCode para evitar confundir JSON/Markdown aleatório com agentes.
- Não tratar qualquer `docs/agents/*.md` como agente automaticamente; Markdown precisa de frontmatter/sinais de agente.
- Parsear JSON/JSONC com suporte MVP a comentários e vírgulas finais.
- Normalizar configs com `agent`, `agents` ou ficheiros individuais dentro de `agents/` para `AgentDto`.
- Calcular risco básico a partir de permissões/ferramentas.
- Mostrar configs inválidas como agentes `unknown` com erro de validação.

Estado: implementado. O fallback mock existe apenas no frontend quando a app corre fora do runtime Tauri.

## Sprint 3: edição segura

Antes da edição, foi adicionado um sprint de visualização completa:

- `scan_agents` retorna `ScanResult` em vez de apenas `Agent[]`.
- `ScanResult` inclui agentes, permission profiles derivados, fontes de instruções e ficheiros de config.
- UI tem abas: `Agents`, `Permissions`, `Instructions`, `Config Files`, `Raw`.
- `Permission Profiles` são derivados de `permission`, overrides por agente, `tools` legado e permissões efetivas.
- Agentes Markdown em `agents/*.md` são suportados no scanner MVP.

- Editar modelo, descrição e instruções.
- Validar antes de guardar.
- Criar backup automático.
- Detectar conflitos por `lastModified` ou hash.

## Sprint 4: permissões e raw editor

- Editor visual de permissões.
- Classificação de risco melhorada.
- Editor raw JSON/JSONC.

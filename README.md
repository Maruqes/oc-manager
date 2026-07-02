# OpenCode Agent Manager

Aplicação desktop para gerir visualmente agentes do OpenCode.

## Stack

- Tauri v2
- React + TypeScript + Vite
- Zustand
- CSS modular simples no MVP, preparado para migrar/adicionar Tailwind + shadcn/ui

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

## Estrutura

- `src/`: frontend
- `src-tauri/`: backend Rust/Tauri
- `shared/`: contratos/tipos documentados
- `docs/`: documentação de arquitetura e MVP

# OpenCode Agent Manager

Desktop application for visually managing OpenCode agents.

## Stack

- Tauri v2
- React + TypeScript + Vite
- Zustand
- CSS modular simples no MVP, preparado para migrar/adicionar Tailwind + shadcn/ui

## Development

```bash
npm install
npm run tauri dev
```

## Structure

- `src/`: frontend
- `src-tauri/`: backend Rust/Tauri
- `shared/`: contratos/tipos documentados
- `docs/`: architecture and MVP documentation

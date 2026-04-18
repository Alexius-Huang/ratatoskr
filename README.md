# Ratatoskr

Local-first, file-based, AI-native task management app for the ai-workspace.

## What it is

Ratatoskr auto-detects projects under `projects/*/` and visualizes their tasks as a Scrum board (Epics / Tickets / Board / Archive). Tickets are markdown files living in each project's gitignored `.meta/ratatoskr/` folder — the filesystem is the database. Named after the Nordic squirrel who shuttles messages along Yggdrasil.

## Quickstart

```bash
pnpm install
pnpm dev
```

Opens on `http://localhost:5173/` (or the next free port).

## Stack

- Vite 8 + React 19 + TypeScript 6
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- pnpm

Planned, not yet implemented: Zustand (client state), TanStack Query (server state / caching), Hono (backend), Tauri (desktop packaging).

## Docs

- `docs/onboard.md` — full project context for AI agents and new contributors
- `../../scratch/20260418_ratatoskr-draft.md` — design spec (working draft)

## Status

**active** — scaffold complete, feature work pending. See `docs/onboard.md` for current implementation state.

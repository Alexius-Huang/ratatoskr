# Ratatoskr

## Purpose

A local-first, file-based, AI-native task management app for the `ai-workspace`. Auto-detects projects under `projects/*/` and visualizes their tasks as a Scrum board with Epics, Tickets, an Archive view, and per-project search. Tickets are markdown files (filename = primary key) living in each project's gitignored `.meta/ratatoskr/` folder. Named after the Nordic squirrel that shuttles messages along Yggdrasil — fitting for an app that ferries tasks between states and between human and AI.

## Status

**active** — as of 2026-04-18. Zero-feature scaffold complete (Vite + React + TS + Tailwind app opens in the browser). All product features pending.

## Stack

- Language / runtime: **TypeScript 6** on Node 22
- Framework: **Vite 8 + React 19**
- Styling: **Tailwind CSS v4** (via `@tailwindcss/vite` — no `postcss.config.js` / `tailwind.config.js`)
- Planned client state: **Zustand**
- Planned server-state / caching: **TanStack Query (React Query)** — for optimistic UI on drag/state transitions
- Planned backend: **Hono** (runs alongside Vite dev server; migrates cleanly to Tauri later)
- Planned drag/drop: TBD at implementation — `@atlaskit/pragmatic-drag-and-drop` (powers Jira) or `@dnd-kit/core`
- Packaging (future): **Tauri** (deferred; MVP runs in browser)
- Package manager: **pnpm**
- Run dev: `pnpm dev` → `http://localhost:5173/` (or next free port)
- Build: `pnpm build`
- Lint: `pnpm lint`

## Structure

Standard Vite React-TS layout currently:

- `src/` — React app (presently default template)
- `public/` — static assets
- `dist/` — build output (gitignored)
- `.meta/` — gitignored; reserved for Ratatoskr's own dogfooded ticket data (`.meta/ratatoskr/`)

Monorepo split (`web/` + `server/`) is deferred until the Hono backend is added.

## Key context for AI

- **Spec is the source of truth for design**: `scratch/20260418_ratatoskr-draft.md`. Read before proposing features or changing the data model.
- **Tickets are markdown files**. Filename = ticket number (e.g., `1.md`). No `number` field in frontmatter. Display ID is derived at runtime as `{prefix}-{number}` from each project's `.meta/ratatoskr/config.json`.
- **`.meta/` is gitignored** in every project — operational state must not pollute project git history. Backup is via Dropbox-synced workspace.
- **No per-project `CLAUDE.md`** — workspace convention. All workspace rules + project registry live in `ai-workspace/CLAUDE.md`.
- **Tailwind v4 setup**: `src/index.css` is a single `@import "tailwindcss";` line — the template's custom CSS was stripped. The default page therefore currently looks unstyled; proper UI is rebuilt with Tailwind utilities as real tickets are implemented.
- **Git**: repo is initialized but has no commits. Git operations are handled by a separate (future) git-related skill.

## Related docs

- Spec / draft: `ai-workspace/scratch/20260418_ratatoskr-draft.md`
- Workspace rules: `ai-workspace/CLAUDE.md`
- Onboarding skill (used to generate this doc): `ai-workspace/.claude/skills/ai-onboard-project/SKILL.md`

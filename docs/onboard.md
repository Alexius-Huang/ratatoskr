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

## Desktop packaging

Ratatoskr can be packaged as a native macOS `.app` via Tauri v2. The app bundles the Hono backend as a Bun-compiled sidecar binary, so no terminal is needed to run it.

### Required toolchain

In addition to Node + pnpm, you need:

```sh
# Rust (one-time install)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Bun (one-time install — used to compile the server sidecar)
curl -fsSL https://bun.sh/install | bash
# or: brew install bun
```

Verify:
```sh
rustc --version    # expect 1.77+
cargo --version
bun --version      # expect 1.1+
pnpm tauri --version
```

### Dev mode (native window + Vite HMR)

```sh
pnpm tauri:dev
```

Opens a native macOS window backed by the Vite dev server. Hot-module reload works as normal; no sidecar is spawned.

### Production build

```sh
pnpm tauri:build
```

This runs (in order):
1. `pnpm build` — TypeScript + Vite build → `dist/`
2. `pnpm build:server` — Bun compile → `src-tauri/binaries/ratatoskr-server-aarch64-apple-darwin`
3. `tauri build` — bundles everything into `src-tauri/target/release/bundle/macos/`

Output:
- `Ratatoskr.app` — double-click to launch from anywhere
- `Ratatoskr_<version>_aarch64.dmg` — drag-to-install disk image

### First launch (Gatekeeper bypass)

The app is **ad-hoc signed** (no Apple Developer cert). macOS will block the first open. Workaround:

1. Right-click `Ratatoskr.app` → **Open**
2. Click **Open** in the dialog

This is a one-time step per machine. Subsequent launches via Dock / Spotlight work normally.

### Architecture

- **Rust host**: Tauri main process. Spawns the Hono sidecar on startup; kills it when the app quits.
- **Hono sidecar** (`ratatoskr-server-aarch64-apple-darwin`): serves the React frontend (`dist/`) and all `/api/*` endpoints on `http://localhost:17653`.
- **WebView**: loads `http://localhost:17653`. Remains hidden until the sidecar prints "listening", then becomes visible.
- **Config persistence**: workspace root is stored at `~/.config/ratatoskr/config.json` (from RAT-24). The `.app` reads this on launch; if missing, the SetupScreen appears.

### Signing / notarization (future)

To distribute without the Gatekeeper prompt, you need an Apple Developer ID certificate. Once available:

```sh
# In tauri.conf.json, add:
# "macOS": { "signingIdentity": "Developer ID Application: Your Name (TEAMID)", "notarization": { ... } }
pnpm tauri:build
```

See the [Tauri code signing docs](https://tauri.app/distribute/sign/macos/) for the full workflow.

## Related docs

- Spec / draft: `ai-workspace/scratch/20260418_ratatoskr-draft.md`
- Workspace rules: `ai-workspace/CLAUDE.md`
- Onboarding skill (used to generate this doc): `ai-workspace/.claude/skills/ai-onboard-project/SKILL.md`

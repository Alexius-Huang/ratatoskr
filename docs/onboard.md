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

### Release workflow

Releases require a **minisign keypair** for Tauri's updater. This is a one-time setup; the private key must live outside the repo.

#### One-time keypair setup

```sh
mkdir -p ~/.tauri
cd projects/ratatoskr
pnpm tauri signer generate -w ~/.tauri/ratatoskr.key
# Press Enter twice when prompted for a password (no password).
```

This prints a public key and writes two files:

- `~/.tauri/ratatoskr.key` — **private key** (keep safe; losing it bricks auto-update for all installed copies).
- `~/.tauri/ratatoskr.key.pub` — public key.

After generating, paste the public key (the long base64 line printed to stdout, or `cat ~/.tauri/ratatoskr.key.pub`) into `src-tauri/tauri.conf.json` at `plugins.updater.pubkey`, replacing the placeholder `"REPLACE_WITH_PUBKEY_FROM_ratatoskr.key.pub"`. Commit that change.

#### GitHub Secrets setup (one-time)

Add the signing key and password as repository secrets so the CI workflow can sign updater artifacts:

```sh
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/ratatoskr.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

(You'll be prompted to paste the password interactively.)

#### GitHub Actions (recommended)

Releases are built and published by `.github/workflows/release.yml` on every `v*` tag push. CI runs on `macos-14` (arm64), installs the full toolchain, signs the updater artifact, and attaches `.dmg`, `.app.tar.gz`, `.sig`, and `latest.json` to a published GitHub Release.

Per-release steps:

1. Run `/rat-new-release vX.Y.Z` — bumps the version in `src-tauri/tauri.conf.json`, commits, pushes, and pushes the tag.
2. CI picks up from the tag push (~10–20 min to build and publish).
3. Watch progress: `gh run watch --repo Alexius-Huang/ratatoskr`
4. Fill in release notes after CI publishes: `gh release edit vX.Y.Z --repo Alexius-Huang/ratatoskr --notes "..."`

On the next launch, installed copies will detect the new version and show an Install/Skip dialog automatically.

### Signing / notarization (future)

To distribute without the Gatekeeper prompt, you need an Apple Developer ID certificate. Once available:

```sh
# In tauri.conf.json, add:
# "macOS": { "signingIdentity": "Developer ID Application: Your Name (TEAMID)", "notarization": { ... } }
pnpm tauri:build
```

See the [Tauri code signing docs](https://tauri.app/distribute/sign/macos/) for the full workflow.

## MCP server

Ratatoskr exposes a Model Context Protocol (MCP) server over stdio that Claude Code can use directly — no Vite dev server or Tauri app required. The six tools (`list_projects`, `list_tickets`, `get_ticket`, `create_ticket`, `patch_ticket`, `archive_ticket`) delegate to the same Hono handlers as the HTTP API.

### Dev loop

```sh
pnpm mcp:dev   # bun server/mcp.ts — runs the server over stdio
```

Connect an MCP client (e.g., the Claude Code CLI) to test interactively. Logs go to stderr; JSON goes over stdio.

### Production build

```sh
pnpm build:mcp
```

Produces `src-tauri/binaries/ratatoskr-mcp-aarch64-apple-darwin` (ad-hoc signed). This binary is referenced by `.mcp.json` at the workspace root.

### Wiring with Claude Code

`.mcp.json` at `ai-workspace/` root registers the binary:

```json
{
  "mcpServers": {
    "ratatoskr": {
      "command": "./projects/ratatoskr/src-tauri/binaries/ratatoskr-mcp-aarch64-apple-darwin"
    }
  }
}
```

On the first session after adding `.mcp.json`, Claude Code prompts to approve the new `ratatoskr` server. After approval, tools appear as `mcp__ratatoskr__*` in every Claude Code session opened in this workspace.

### Claude sessions should prefer MCP tools

For any project using Ratatoskr, Claude sessions should use these MCP tools (`mcp__ratatoskr__create_ticket`, `mcp__ratatoskr__patch_ticket`, etc.) for all ticket operations rather than editing `.meta/ratatoskr/tasks/` files directly. Direct file edits are a fallback only when the MCP is unavailable.

### Troubleshooting

- **Tools not appearing**: restart Claude Code — MCP servers are loaded at session start.
- **Binary blocked by Gatekeeper**: run `pnpm build:mcp` again (it re-applies the adhoc codesign). Verify with `codesign -dv src-tauri/binaries/ratatoskr-mcp-aarch64-apple-darwin`.

## Related docs

- Spec / draft: `ai-workspace/scratch/20260418_ratatoskr-draft.md`
- Workspace rules: `ai-workspace/CLAUDE.md`
- Onboarding skill (used to generate this doc): `ai-workspace/.claude/skills/ai-onboard-project/SKILL.md`

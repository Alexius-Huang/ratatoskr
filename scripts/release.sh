#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh "Release notes"
#
# Requirements: jq, gh (GitHub CLI), pnpm, Rust toolchain, Bun
# Signing key:  ~/.tauri/ratatoskr.key  (generated once via `pnpm tauri signer generate`)

NOTES="${1:-}"
if [[ -z "$NOTES" ]]; then
  echo "Usage: $0 \"Release notes\"" >&2
  exit 1
fi

# Ensure Rust toolchain is on PATH
[[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"

# Check required tools
for cmd in jq gh pnpm cargo; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is not installed" >&2
    exit 1
  fi
done

KEY_PATH="$HOME/.tauri/ratatoskr.key"
if [[ ! -f "$KEY_PATH" ]]; then
  echo "Error: signing key not found at $KEY_PATH" >&2
  echo "Run: pnpm tauri signer generate -w ~/.tauri/ratatoskr.key" >&2
  exit 1
fi

VERSION=$(jq -r '.version' src-tauri/tauri.conf.json)
TAG="v$VERSION"

# Guard: abort if this tag already exists on the remote
if gh release view "$TAG" &>/dev/null; then
  echo "Error: release $TAG already exists on GitHub. Bump the version in src-tauri/tauri.conf.json first." >&2
  exit 1
fi

echo "Building $TAG..."

export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

pnpm tauri:build

BUNDLE_DIR="src-tauri/target/release/bundle/macos"
DMG="src-tauri/target/release/bundle/dmg/Ratatoskr_${VERSION}_aarch64.dmg"
TARBALL="$BUNDLE_DIR/Ratatoskr.app.tar.gz"
SIG_FILE="$BUNDLE_DIR/Ratatoskr.app.tar.gz.sig"

for f in "$DMG" "$TARBALL" "$SIG_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: expected artifact not found: $f" >&2
    exit 1
  fi
done

echo "Generating latest.json..."

jq -n \
  --arg version "$VERSION" \
  --arg notes "$NOTES" \
  --arg pub_date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg signature "$(cat "$SIG_FILE")" \
  --arg url "https://github.com/Alexius-Huang/ratatoskr/releases/download/$TAG/Ratatoskr.app.tar.gz" \
  '{
    version: $version,
    notes: $notes,
    pub_date: $pub_date,
    platforms: {
      "darwin-aarch64": {
        signature: $signature,
        url: $url
      }
    }
  }' > latest.json

echo "Publishing $TAG to GitHub Releases..."

gh release create "$TAG" \
  --title "$TAG" \
  --notes "$NOTES" \
  "$DMG" \
  "$TARBALL" \
  "$SIG_FILE" \
  latest.json

rm latest.json

echo ""
echo "Done. $TAG is live."
echo "Installed copies will detect the update on next launch."

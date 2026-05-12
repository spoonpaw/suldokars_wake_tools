#!/usr/bin/env bash
# release-mac.sh — build, sign, and assemble a macOS release bundle for the
# Tauri auto-updater.
#
# Usage:
#   ./scripts/release-mac.sh
#
# Reads the version from backend/tauri.conf.json. Builds Mac aarch64 + x86_64
# universal bundle, signs it with the private updater key in .tauri/, and
# writes a `latest.json` manifest in dist/<version>/.
#
# Then upload BOTH:
#   - dist/<version>/SuldokarsWakeTools_<version>_universal.dmg
#   - dist/<version>/SuldokarsWakeTools_<version>_universal.app.tar.gz
#   - dist/<version>/SuldokarsWakeTools_<version>_universal.app.tar.gz.sig
#   - dist/<version>/latest.json
# to a GitHub release tagged `v<version>` so the updater endpoint can find them.
#
# Requires: cargo, cargo-tauri, jq, .tauri/sw_tools.key (do NOT commit).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION=$(jq -r .version backend/tauri.conf.json)
KEY_PATH=".tauri/sw_tools.key"
PUBKEY_PATH=".tauri/sw_tools.key.pub"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "ERROR: $KEY_PATH missing. Generate one with:"
  echo "  cargo tauri signer generate -w $KEY_PATH"
  exit 1
fi

OUT="dist/$VERSION"
mkdir -p "$OUT"

echo "==> Building universal Mac bundle for v$VERSION (signed)…"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
( cd backend && cargo tauri build --bundles app,dmg,updater --target universal-apple-darwin )

BUNDLE_DIR="backend/target/universal-apple-darwin/release/bundle"
DMG=$(ls "$BUNDLE_DIR/dmg/"*.dmg | head -1)
APP_TARBALL=$(ls "$BUNDLE_DIR/macos/"*.app.tar.gz | head -1)
APP_SIG=$(ls "$BUNDLE_DIR/macos/"*.app.tar.gz.sig | head -1)

# Rename to clean ASCII filenames — Tauri's defaults include the spaces +
# apostrophe from productName, which break URLs in the JSON manifest.
DMG_NAME="SuldokarsWakeTools_${VERSION}_universal.dmg"
TARBALL_NAME="SuldokarsWakeTools_${VERSION}_universal.app.tar.gz"
SIG_NAME="${TARBALL_NAME}.sig"
cp "$DMG"         "$OUT/$DMG_NAME"
cp "$APP_TARBALL" "$OUT/$TARBALL_NAME"
cp "$APP_SIG"     "$OUT/$SIG_NAME"

SIG_CONTENT=$(cat "$OUT/$SIG_NAME")
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$OUT/latest.json" <<EOF
{
  "version": "$VERSION",
  "notes": "See https://github.com/spoonpaw/suldokars_wake_tools/releases/tag/v$VERSION for changes.",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIG_CONTENT",
      "url": "https://github.com/spoonpaw/suldokars_wake_tools/releases/download/v$VERSION/$TARBALL_NAME"
    },
    "darwin-x86_64": {
      "signature": "$SIG_CONTENT",
      "url": "https://github.com/spoonpaw/suldokars_wake_tools/releases/download/v$VERSION/$TARBALL_NAME"
    }
  }
}
EOF

echo
echo "==> Done. Files in $OUT/:"
ls -1 "$OUT/"
echo
echo "Next: create a GitHub release tagged v$VERSION and upload everything in $OUT/"
echo "  gh release create v$VERSION $OUT/* --title \"v$VERSION\" --notes-file <(printf 'Release notes here.')"

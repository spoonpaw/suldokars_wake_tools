# Releasing Suldokar's Wake Tools

Desktop builds (Mac / Win / Linux) auto-update via Tauri's updater plugin.
Mobile builds (iOS / Android) update through the App Store / Play Store.

This doc covers the **desktop** release flow. Mobile is store-managed and not yet wired here.

---

## One-time setup

### 1. The signing keypair

Tauri's updater requires every release bundle to be cryptographically signed with a private key. The matching public key is baked into the app at build time and verifies downloaded updates before they're applied. Without this, malicious updates couldn't be rejected.

A keypair already exists at `.tauri/sw_tools.key` (private) and `.tauri/sw_tools.key.pub` (public). The pubkey is committed in `backend/tauri.conf.json` under `plugins.updater.pubkey`.

**The private key is gitignored — do NOT commit it.** Back it up somewhere safe (1Password, etc.). If you lose it, you can never publish a working update again — users would have to manually reinstall a new build with a new pubkey.

### 2. The update endpoint

Configured in `backend/tauri.conf.json`:
```json
"endpoints": [
  "https://github.com/spoonpaw/suldokars_wake_tools/releases/latest/download/latest.json"
]
```
The app pings this URL on startup. GitHub Releases serves whatever you upload to the latest release, so as long as you tag releases and upload `latest.json` plus the bundles, users get updates automatically.

---

## Per-release flow (Mac)

1. **Bump the version** in two places:
   - `backend/tauri.conf.json` → `"version"`
   - `backend/Cargo.toml` → `version = "x.y.z"`

2. **Run the release script** from the repo root:
   ```bash
   ./scripts/release-mac.sh
   ```
   This builds a universal Mac bundle (.dmg + .app.tar.gz), signs it, and writes a `latest.json` manifest in `dist/<version>/`.

3. **Create the GitHub release** and upload everything:
   ```bash
   gh release create v0.1.0 dist/0.1.0/* \
     --title "v0.1.0" \
     --notes "Release notes here."
   ```
   Or use the GitHub UI: tag `v0.1.0`, upload all four files.

4. **Done.** Existing users will see "Update available — Update / Later" prompt next launch.

---

## Adding Windows / Linux

The wiring is identical — same plugin, same pubkey, same endpoint. You just need to **build on the target OS** (or use GitHub Actions for cross-platform CI builds).

### Windows
On a Windows machine:
1. Pull the repo.
2. Copy `.tauri/sw_tools.key` from your Mac into `.tauri/` on Windows (the same private key signs all platforms).
3. Run `cargo tauri build` with the env var:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .tauri/sw_tools.key -Raw
   cd backend; cargo tauri build
   ```
4. Bundle ends up at `backend/target/release/bundle/msi/*.msi` plus `*.msi.zip` and `*.msi.zip.sig`.
5. Add the windows entry to the existing `latest.json` (or rebuild it):
   ```json
   "windows-x86_64": {
     "signature": "<contents of *.msi.zip.sig>",
     "url": "https://github.com/spoonpaw/suldokars_wake_tools/releases/download/v0.1.0/<msi.zip filename>"
   }
   ```
6. Upload the `.msi`, `.msi.zip`, `.msi.zip.sig` to the same GitHub release and re-upload the merged `latest.json`.

### Linux
Same pattern. AppImage bundle:
- Build: `cargo tauri build` on Linux → produces `*.AppImage`, `*.AppImage.tar.gz`, `*.AppImage.tar.gz.sig`.
- Add to `latest.json`:
  ```json
  "linux-x86_64": {
    "signature": "<contents of *.AppImage.tar.gz.sig>",
    "url": "https://.../v0.1.0/<AppImage.tar.gz filename>"
  }
  ```

### GitHub Actions (recommended once you have multiple platforms)
A `.github/workflows/release.yml` triggered on `v*` tag push can build all three platforms in parallel and upload to the same release. Out of scope for now — set up when you actually want push-button releases.

---

## How the updater works at runtime

1. App boots → `frontend/src/lib/utils/updater.ts` calls `check()`.
2. Plugin GETs the manifest endpoint, looks for the entry matching the user's platform (e.g. `darwin-aarch64`).
3. If that entry's `version` is greater than the installed version, the app shows an "Update available" prompt.
4. On accept: download the bundle, verify signature against the embedded pubkey, swap binary, relaunch.
5. User data (SQLite db in OS app-data dir) is untouched — only the binary is replaced.

Schema migrations: when you change the SWCharacter shape, add a normalization step in `frontend/src/lib/models/SWCharacter.ts` `normalizeCharacter()` so old saves stay readable.

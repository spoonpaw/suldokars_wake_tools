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
2. Copy `.tauri/sw_tools.key` from your Mac into `.tauri/` on Windows (same private key signs all platforms — never regenerate).
3. From the repo root: `npm install` (creates the same root lockfile the build helper uses).
4. Build a signed MSI (NSIS bundle currently broken — `nsis-tauri-utils` plugin/makensis incompat. MSI alone is enough for the updater):
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .tauri/sw_tools.key -Raw
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
   cd backend
   cargo tauri build --bundles msi
   ```
5. Bundle ends up at `backend/target/release/bundle/msi/*.msi` plus `*.msi.sig`. With `bundle.createUpdaterArtifacts: true`, Tauri 2 produces a bare `.msi` + `.msi.sig` — there is no `.msi.zip` wrapper. The updater downloads the `.msi` directly.
6. Rename to clean ASCII (avoid spaces/apostrophe in URLs): `SuldokarsWakeTools_<version>_x64-setup.msi` + `.sig`.
7. Add the windows entry to the existing `latest.json`:
   ```json
   "windows-x86_64": {
     "signature": "<contents of *.msi.sig>",
     "url": "https://github.com/spoonpaw/suldokars_wake_tools/releases/download/v<version>/SuldokarsWakeTools_<version>_x64-setup.msi"
   }
   ```
8. Upload the `.msi`, `.msi.sig`, and merged `latest.json` to the same GitHub release with `gh release upload v<version> <files...> --clobber`.

### Linux
On an Ubuntu (or compatible) machine:
1. Pull the repo.
2. Copy `.tauri/sw_tools.key` from your Mac into `.tauri/` on Linux (same private key signs all platforms — never regenerate).
3. Install apt prereqs (Tauri 2 needs the WebKitGTK 4.1 stack + AppImage tooling):
   ```bash
   sudo apt update
   sudo apt install -y build-essential curl wget file libssl-dev \
     libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
     libwebkit2gtk-4.1-dev libsoup-3.0-dev pkg-config libfuse2 \
     libgdk-pixbuf2.0-bin
   ```
   `libgdk-pixbuf2.0-bin` is the easy-to-miss one — `linuxdeploy-plugin-gtk` calls `gdk-pixbuf-query-loaders` and silently fails the AppImage step if it's absent.
4. If `appimagelauncher` is installed, **uninstall it** (`sudo apt remove appimagelauncher`). It registers itself in `binfmt_misc` as the interpreter for the AppImage magic bytes, which makes `linuxdeploy` fail mid-build with `subprocess exit code 127 / Failed to open squashfs image`. Temporary fix per session: `sudo sh -c 'echo 0 > /proc/sys/fs/binfmt_misc/appimage-type1; echo 0 > /proc/sys/fs/binfmt_misc/appimage-type2'` (resets on reboot).
5. From repo root: `npm install` (root build helper).
6. Build:
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri/sw_tools.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
   cd backend
   cargo tauri build --bundles deb,appimage
   ```
7. Outputs (Tauri 2 with `bundle.createUpdaterArtifacts: true` produces a **bare** `.AppImage` + `.AppImage.sig` — NOT `.AppImage.tar.gz`. Same convention as Windows `.msi`. The Mac path tarballs the bundle only because `.app` is a folder):
   - `backend/target/release/bundle/appimage/*.AppImage`
   - `backend/target/release/bundle/appimage/*.AppImage.sig`
   - `backend/target/release/bundle/deb/*.deb` (separate Debian installer; not used by the updater)
8. Rename to clean ASCII (avoid spaces/apostrophe in URLs): `SuldokarsWakeTools_<version>_amd64.AppImage` + `.sig` + `.deb`.
9. Merge a `linux-x86_64` entry into `latest.json`:
   ```json
   "linux-x86_64": {
     "signature": "<contents of *.AppImage.sig>",
     "url": "https://github.com/spoonpaw/suldokars_wake_tools/releases/download/v<version>/SuldokarsWakeTools_<version>_amd64.AppImage"
   }
   ```
10. Upload everything: `gh release upload v<version> SuldokarsWakeTools_<version>_amd64.AppImage SuldokarsWakeTools_<version>_amd64.AppImage.sig SuldokarsWakeTools_<version>_amd64.deb latest.json --clobber`.

If a future `tauri-cli` version misbehaves with the cached AppImage tooling, delete `~/.cache/tauri/linuxdeploy-x86_64.AppImage` and let Tauri re-download a fresh one.

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

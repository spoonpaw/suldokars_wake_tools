# Mobile setup (iOS + Android)

Suldokar's Wake Tools targets **macOS, Windows, Linux, iOS, Android** from a
single Tauri 2 + SvelteKit codebase. This document covers the mobile build
prerequisites and the project-init flow.

## Build status

Mobile project scaffolding exists. The final public release requires App Store
and Google Play submission; track that process in `MOBILE_RELEASE.md`.

## Android

Prereqs (one-time):

1. **Android Studio** + default SDK
2. **NDK 28** — `Settings > Languages & Frameworks > Android SDK > SDK Tools`
   → check **NDK (Side by side)** → Apply
3. **Java 17** (bundled with Android Studio's JBR)

Environment (`~/.zshrc`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/28.1.13356709"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Init + commands (run from `backend/`):

```bash
cargo tauri android init           # one-time, creates backend/gen/android/
cargo tauri android dev            # device or emulator, hot reload
cargo tauri android build --apk    # universal .apk (unsigned)
cargo tauri android build --aab    # .aab for Play Store
```

## iOS

Prereqs (one-time):

1. **Xcode** (latest, App Store)
2. **Xcode CLT** — `xcode-select --install`
3. **CocoaPods** — `brew install cocoapods` (no sudo needed)
4. **Apple Developer account** for real-device + App Store

Already configured in `tauri.conf.json`:

```json
"bundle": {
  "iOS": { "developmentTeam": "Y4ZK5B3854" }
}
```

Init + commands (run from `backend/`):

```bash
cargo tauri ios init                            # one-time, creates Xcode project
cargo tauri ios dev                             # default simulator
cargo tauri ios dev --target aarch64-sim        # Apple Silicon sim
cargo tauri ios build --target aarch64-sim      # simulator .app
cargo tauri ios build --target aarch64          # device .app (signing required)
cargo tauri ios build                           # universal archive
```

## Capabilities

Mobile and desktop have separate permission files because path semantics differ:

- `backend/capabilities/desktop.json` — `platforms: ["macOS","linux","windows"]`
  — full fs (`$APPDATA`, `$DOWNLOAD`, `$DESKTOP`, `$DOCUMENT`), shell plugin
- `backend/capabilities/mobile.json` — `platforms: ["iOS","android"]` —
  sandboxed fs (`$APPDATA`, `$DOCUMENT` only), no shell plugin

## SQLite storage paths

`tauri-plugin-sql` writes the SQLite DB into the platform-appropriate app data dir:

- macOS: `~/Library/Application Support/com.netartisancollective.suldokarswaketools/sw-tools.db`
- Windows: `%APPDATA%\com.netartisancollective.suldokarswaketools\sw-tools.db`
- Linux: `~/.local/share/com.netartisancollective.suldokarswaketools/sw-tools.db`
- Android: `/data/data/com.netartisancollective.suldokarswaketools/databases/sw-tools.db`
- iOS: `<app sandbox>/Library/Application Support/sw-tools.db`

## Known gotchas

- **First mobile build is slow** — Rust compiles for 3+ ABIs from scratch.
- **Bundle identifier change requires re-init** — change `tauri.conf.json
  identifier` → run `rm -rf backend/gen/android backend/gen/apple` → re-run
  both `cargo tauri android init` and `cargo tauri ios init`.
- **WebView quirks** — iOS WKWebView and Android WebView differ on CSS,
  scrolling, file dialogs. Always test on a real device.
- **iOS bundle identifier** can't end in `.app` (collides with macOS app
  bundle extension). Currently `com.netartisancollective.suldokarswaketools`.

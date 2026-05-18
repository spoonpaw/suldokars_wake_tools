# Changelog

## Unreleased

Release-prep polish for the first public release.

- README now describes the current character-management app instead of earlier
  broader tool-suite plans.
- README now includes desktop install notes and mobile store distribution notes.
- Added release planning checklist for the first public release.
- Added MIT license and Suldokar's Wake attribution/permission notice.
- Updated Rust package metadata.
- Added Prettier config/ignore rules and fixed the frontend lint/test gates.
- Updated frontend lockfile to clear high/moderate npm audit advisories.
- Fixed `build.sh` so local desktop builds load the updater signing key and do
  not fail on an empty macOS signing identity.
- Added a mobile release checklist for App Store and Google Play submission.
- Fixed packaged/mobile client-side routing so non-home pages resolve through
  the app shell instead of returning a 500.
- Added canonical party import/export regression coverage for stack composition
  round trips.
- Refined the stack composition panel in view and edit modes with full
  contribution labels, compact mobile rows, and quick stack descriptions.
- Added explicit carried/equipped/stashed equipment states plus configurable
  equipped-container slot bonuses in view, edit, import, and starter gear flows.
- Added construction kits to equipment pickers, included vehicle/drone/bot stock
  in starter equipment, and filled the missing Wet Suit gear entry.
- Split RAW currency denominations (`P`, `p`, `E`, `e`) into on-hand and
  stashed amounts, with on-hand money contributing carried slots per the
  currency slot rules.
- Reset the public character/export schema marker to version 1 for the first
  release.
- Renamed pre-release harm badge states to rules-facing language and fixed
  nanite-only harm so it no longer displays as unharmed.
- Added manual harm status selection and status notes for roll outcomes,
  injuries, aid, bleeding, and GM rulings that are not purely meter-derived.

## v0.1.0 — first public release (planned)

Initial public release target for Suldokar's Wake Tools.

### Character Management

- Create, edit, import, export, and delete Suldokar's Wake characters.
- Supports Apt, Core, and Prime characters.
- Supports Blood, Palp Alien, Amphibious Alien, Tank Born, Droid, and Holid
  life-forms.
- Includes the from-scratch character creation wizard.
- Tracks primary stacks, Close, Ranged, life-form bonuses, background bonuses,
  keywords, languages, spaces/formulae, implants, identity, artistic
  modification, hooks, purse, special coins, and debts.
- Manages weapons, armor, gear, vehicles, pets, ammo, and equipment slots.
- Tracks character advancement graphs, including graph library and custom graph
  tools.
- Tracks physical and nanite harm.

### App

- Offline SQLite persistence via `tauri-plugin-sql`.
- JSON import/export via Tauri dialogs, with browser fallbacks for dev builds.
- Dark and light themes.
- Settings/About page with update preferences and attribution.
- Desktop update checks via `tauri-plugin-updater`.

### Distribution

- macOS, Windows, and Linux desktop builds are supported through Tauri.
- iOS and Android project configuration exists; App Store and Google Play
  submission are part of the final public release process.

### Known Limitations

- This is a character manager, not a replacement for the published game.
- PDF character-sheet export is not included.
- Mobile builds still need real-device release validation and store submission.

## v0.0.2 — updater test build (2026-05-13)

- Internal auto-updater test build.
- Added Settings/About page with desktop update preferences.
- Uploaded macOS, Windows, and Linux test artifacts.

## v0.0.1 — updater test build (2026-05-10)

- Initial Tauri 2 + SvelteKit 2 + Svelte 5 + TypeScript + Tailwind scaffold.
- Established the character data model, SQLite storage, import/export path, and
  first desktop build flow.

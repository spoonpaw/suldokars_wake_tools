# Suldokar's Wake Tools

Cross-platform character management app for **Suldokar's Wake** (SW), the
Zira-Kaan science-fiction tabletop RPG. Built with Tauri 2 + SvelteKit 2 +
Svelte 5 + TypeScript.

## Status

Working desktop app with offline character storage, JSON import/export, and
release builds for macOS. The codebase is also configured for Windows, Linux,
iOS, and Android through Tauri 2.

## Features

- Create, edit, export, import, and delete SW characters
- Apt, Core, and Prime character support
- Full life-form support: Blood, Palp Alien, Amphibious Alien, Tank Born,
  Droid, Holid
- Creation Wizard for the from-scratch character procedure
- Stack tracking for the six primary stacks plus Close and Ranged
- Life-form and background bonus handling
- Keyword, language, space/formula, implant, identity, artistic modification,
  and hook tracking
- Equipment management for weapons, armor, gear, vehicles, pets, ammo, slots,
  purse, special coins, and debts
- Character advancement graph tracking, including graph library and custom
  graph tools
- Physical and nanite harm tracking
- SQLite persistence and JSON import/export for fully offline use

This focuses on character management and is not a replacement for the book.

## Stack

- Tauri 2.x (Rust backend, WebView frontend)
- SvelteKit 2 + Svelte 5 (TypeScript)
- Tailwind CSS 3
- SQLite via `tauri-plugin-sql`
- `tauri-plugin-fs`, `tauri-plugin-dialog` for import/export
- `tauri-plugin-updater` for desktop update checks

## Project structure

```
suldokars_wake_tools/
├── frontend/                SvelteKit app
│   ├── src/
│   │   ├── routes/          Pages (home, character/new, character/[id], settings)
│   │   ├── lib/
│   │   │   ├── components/  UI primitives + character UI
│   │   │   ├── models/      SW types (SWCharacter, Enums)
│   │   │   ├── stores/      Reactive state + SQLite layer
│   │   │   ├── utils/       Derived stats, import/export, updater, zoom
│   │   │   └── data/        Character options and equipment data
│   │   ├── app.html / app.css
├── backend/                 Tauri / Rust
│   ├── src/main.rs          Entry + commands
│   ├── capabilities/        Tauri permissions (desktop + mobile)
│   ├── icons/               App icons
│   └── tauri.conf.json      Tauri config
└── dev.sh / build.sh        Dev + build scripts (mac/linux)
    dev.bat / build.ps1      Windows variants
```

## Development

```bash
./setup.sh    # one-time
./dev.sh      # start dev server
./build.sh    # production build
```

Or, manually:

```bash
cd frontend && npm install
cd ../backend && cargo check
cd .. && cd backend && cargo tauri dev
```

## License

App code: MIT.

Suldokar's Wake, its names, and its game content are © Christian Mehrstam. This
is an unofficial fan tool released with permission, and you need the published
game to use it.

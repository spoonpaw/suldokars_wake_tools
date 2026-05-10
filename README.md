# Suldokar's Wake Tools

Cross-platform character manager for **Suldokar's Wake** (SW), the Zira-Kaan
science-fiction tabletop RPG. Built with Tauri 2 + SvelteKit 2 + Svelte 5 +
TypeScript. Targets macOS, Windows, Linux, iOS and Android from a single
codebase.

## Status

Early scaffold. App builds, character data model is complete and round-trips
all three published PC sheets without loss.

## Features (planned)

- Create / edit / delete SW characters (Apt, Core, Prime)
- Full life-form support: Blood, Palp Alien, Amphibious Alien, Tank Born,
  Droid, Holid
- 8 backgrounds with bonuses + keyword tables (rules/19)
- 13-step Creation Wizard following the from-scratch procedure (rules/16)
- Stack tracker (6 primary + Close + Ranged), keyword tracker, language picker
- Type-graph reference (Apt / Core / Prime advancement nodes)
- Equipment with slots, ammo, currency (P / e / E), Gunta coins
- Implants (head / body / limbs) with cost multipliers
- Formulae (basic + subspace), Core spaces, Apt spaces, Prime bested-enemy
- Identity, hooks, Artistic Modification
- Inverted-action dice roller (clean / double / half / exploding / Odyn)
- Reference browser (backgrounds, weapons, armor, formulae, type graphs, …)
- SQLite persistence + JSON import / export — fully offline

## Stack

- Tauri 2.x (Rust backend, WebView frontend)
- SvelteKit 2 + Svelte 5 (TypeScript)
- Tailwind CSS 3
- SQLite via `tauri-plugin-sql`
- `tauri-plugin-fs`, `tauri-plugin-dialog` for import/export

## Project structure

```
suldokars_wake_tools/
├── frontend/                SvelteKit app
│   ├── src/
│   │   ├── routes/          Pages (home, character/*, dice, reference)
│   │   ├── lib/
│   │   │   ├── components/  UI primitives + character UI
│   │   │   ├── models/      SW types (SWCharacter, Enums)
│   │   │   ├── stores/      Reactive state + SQLite layer
│   │   │   ├── utils/       Derived stats, dice, import/export
│   │   │   └── data/        Backgrounds, life-forms, weapons, armor, …
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

App code: MIT. Suldokar's Wake rules content is © Christian Mehrstam and is
not redistributed in this repository.

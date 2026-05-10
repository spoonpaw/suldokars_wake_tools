# Changelog

## v0.0.1 — initial scaffold (2026-05-10)

First commit. Tauri 2 + SvelteKit 2 + Svelte 5 + TypeScript 5 + Tailwind 3.
SQLite via `tauri-plugin-sql`.

### Domain coverage

- **Character types:** Apt, Core, Prime — with origo values from rules/18 body
- **Life-forms:** Blood, Palp Alien, Amphibious Alien, Tank Born, Droid, Holid
- **Backgrounds:** all 8 (Enforcer, Diplomat, Entertainer, Cultist, Fixer,
  Outrider, Archivist, Worker) with bonuses + 6-keyword tables + d20
  tangentials
- **Stacks:** 6 primary (Archive, Bulk, Ghost, Morph, Speed, Tech) + Close +
  Ranged
- **Languages:** 19 from rules/20 with mandatory-by-life-form auto-pick
- **Type graphs:** Apt / Core / Prime advancement nodes (origo at (0,0))
- **Weapons:** full rules/29 table (21 entries)
- **Armor:** full rules/29 table (12 entries) with Apt/Core/Prime gating
- **Adventuring gear:** full rules/26 table (50+ entries)
- **Vehicles & drones:** full rules/27 table (17 entries)
- **Pets & mounts:** full rules/28 table (7 entries)
- **Implants:** all body-part variants from rules/24 with cost multipliers
- **Basic formulae:** full three-mode listing from rules/21 (25 entries)
- **Subspace formulae:** all subspace formulae from rules/22 (16 entries)
- **Construction kits:** full rules/24 table

### Mechanics

- Inverted-action roll resolver (regular ≤ stack, special > DN, fumble = 13
  when DN ≥ 13, crit on 20 / Apt also on 19)
- Clean / double / half / exploding d20 / Odyn rollers
- Encumbrance check (slot total vs Bulk-vs-overflow)
- Implant cost calculator (×1 blood / ×1 construct / ×1.5 tank-born / ×2 alien;
  each +1 increment doubles)
- Starter Parts (d6 by life-form)

### UI

- Home: card list with delete + import + export
- New character: 14-step Creation Wizard (Name → Type → Stack rolls →
  Life-form → Background → Keywords → Languages → Spaces → Equipment →
  Implants → Identity → Artistic Mod → Hooks → Review)
- Character sheet view with 10 tabs (Overview, Stacks, Keywords,
  Languages, Space, Equipment, Implants, Identity, Hooks, Trackers)
- Character edit (single-page editor)
- Dice roller page
- Reference browser (12 topics with search/filter)
- Theme toggle (dark default, light optional)

### Persistence

- SQLite via `tauri-plugin-sql` (cross-platform; same schema desktop + mobile)
- JSON import / export with schema versioning + Tauri dialog or browser
  download fallback

### Verified

- `npm install` + `npm run check` clean
- `cargo check` clean

### Not yet

- Mobile build (iOS + Android) — config in place, not exercised
- Combat tracker (placeholder; carry-over from OSE template removed)
- PDF character-sheet export
- Real-device touch UX validation

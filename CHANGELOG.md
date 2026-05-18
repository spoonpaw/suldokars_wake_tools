# Changelog

## v1.0.0 — first public release (2026-05-19)

Initial public release of Suldokar's Wake Tools.

### Character Management

- Create, edit, import, export, and delete Suldokar's Wake characters.
- Supports Apt, Core, and Prime characters.
- Supports Blood, Palp Alien, Amphibious Alien, Tank Born, Droid, and Holid
  life-forms.
- From-scratch character creation wizard covering all 14 steps (name, type,
  stack rolls, life-form, bonus distribution, background, keywords, languages,
  spaces, equipment, identity, artistic mod, hooks, review).
- Life-form sub-systems (rules/18) including alien resistance / vulnerability /
  feature tables, Tank Born corresponding-appearance trait, Droid Construct
  Inspiration (use / optimization / since-creation history), and Holid
  Construct Inspiration (original purpose / transformation effect).
- Core deep-bond mechanics (HoloH / Nanite Cloud / Subspace) surfaced in the
  type info panel and identity card with active-bond highlighting.
- Custom formula creator for Core characters (homebrew / GM-given formulae)
  with lock-step add/remove/set-active between character.formulae and
  character.spaces.
- Tracks primary stacks, Close, Ranged, life-form bonuses, background bonuses,
  keywords, languages, spaces/formulae, implants, identity, artistic
  modification, hooks, purse, special coins, and debts.
- Manages weapons, armor, gear, vehicles, pets, ammo, and equipment slots —
  with carried / equipped / stashed states and configurable container slot
  bonuses.
- Construction kits in equipment pickers; vehicle/drone/bot stock in starter
  equipment.
- Split RAW currency denominations (`P`, `p`, `E`, `e`) into on-hand and
  stashed amounts, with on-hand money contributing carried slots per the
  currency slot rules.
- Tracks character advancement graphs with graph library and custom graph
  tools.
- Slot-machine cycling animation on every randomly-rolled value, plus manual
  number entry for every rolled value (third-party / physical dice support).
- Physical and nanite harm tracking with rules-facing status states
  (unharmed / harmed / end-roll-pending / suspended / injured / dying /
  comatose / dead), manual status overrides, and status notes.

### Rules Correctness

- Sticky-spaces and revisit-re-applies-bonuses rules pinned in pure helpers +
  tests per Christian Mehrstam clarification (2026-05-18).
- Tank Born cap-stack mutual exclusivity (cap pick auto-strips overlap with
  +2/+1 lists).
- Advancement rollback restores position, shadow/gunta, stack composition,
  added spaces/keywords, bond + notes, and promoted-session label/degree/notes.
- Intermediate type-graph cells do not bump shadow / gunta (rules/52).

### App

- Offline SQLite persistence via `tauri-plugin-sql`.
- JSON import/export via Tauri dialogs, with browser fallbacks for dev builds.
- Canonical-party fixture round-trip regression coverage.
- Dark and light themes with light-mode polish (white cards, white inputs,
  badge contrast fixes, cyan button shade consistency).
- Pinch-zoom blockers + non-selectable text for native-app feel.
- Scroll-to-top on tab/route navigation.
- Settings/About page with desktop update preferences and Christian Mehrstam
  attribution.
- Desktop auto-update via `tauri-plugin-updater` with GitHub Releases manifest.
- Schema-version field on every character with `normalizeCharacter` migration
  layer for forward-compatible save formats.

### Test Coverage

- 229 tests across 13 test files. 85.7 % statements / 73.7 % branches /
  89.1 % functions on the tested logic layer (models + utils + data).
- Pure helpers extracted from `AdvancementModal` and `AdvancementPanel` into
  `utils/advancement.ts` so the apply + rollback state machine is
  unit-testable.

### Distribution

- macOS (universal), Windows (MSI), and Linux (AppImage) desktop builds.
- iOS and Android project configuration ready for App Store and Google Play
  submission (mobile builds are not distributed through GitHub Releases).

### Known Limitations

- Character manager, not a replacement for the published game.
- PDF character-sheet export is not included.
- Cross-platform desktop CI (GitHub Actions) is not yet wired — current
  release flow uses local scripts per target machine.

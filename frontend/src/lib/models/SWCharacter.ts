/**
 * SWCharacter.ts - Suldokar's Wake character model.
 *
 * Mirrors the markdown character-sheet structure the campaign uses
 * (see characters/osric_ward.md, kira_voss.md, hadrian_volk.md). Each
 * field maps to a section on those sheets so import/export and PDF-to-app
 * round-tripping are lossless.
 */

import type { CharacterType, LifeForm, Background, Stack, Language, ConstructionKit, DamageDie, DamageType, WeaponRange } from './Enums';
import type { TypeGraphDef, TypeGraphNode } from '$lib/data/typeGraphs';
import { getTypeGraph } from '$lib/data/typeGraphs';

export const CURRENT_SCHEMA_VERSION = 1;

// ============================================
// OWNED GRAPHS (multi-graph advancement, rules: looted graphs)
// ============================================
//
// Per the rulebook: "It is rare but possible to loot new and different
// graphs in an adventure, making your character cover uncharted
// development territory." Each character starts with one default graph
// for their type and may pick up more (looted) or build custom ones.
// Only one graph drives advancement at any time — the active graph.
// Source 'default' is immutable: edits / deletes refused.

export type OwnedGraphSource = 'default' | 'looted' | 'custom';

export interface OwnedGraph {
  id: string;
  /** Display name — "Default Apt", "Looted: Gauss Researcher Path", etc. */
  name: string;
  source: OwnedGraphSource;
  /** Full clone — independent from the static default in data/typeGraphs.ts. */
  graph: TypeGraphDef;
  /** ISO timestamp when added. */
  acquiredAt: string;
  notes?: string;
}

// ============================================
// STACK SCORES
// ============================================

/** All eight stack values, integer scores in 0-9 typical range. */
export interface StackScores {
  archive: number;
  bulk: number;
  ghost: number;
  morph: number;
  speed: number;
  tech: number;
  close: number;
  ranged: number;
}

// ============================================
// STACK COMPOSITION
// ============================================
//
// Each stack value is the sum of contributions from rolls + life-form +
// background + implants + misc ("other"). Tracking each contribution lets
// the sheet show WHY a stack is its current value, and lets the wizard /
// edit-form mutate one source without losing the others.
//
// For Tank Born set/cap stacks the convention is: `base` carries the rolled
// value (kept for reference), `other` holds whatever delta is needed so the
// sum reaches the cap. We don't special-case set/cap in `recomputeStacks` —
// it's a plain summation. The wizard is responsible for filling slots so
// the math works out.

export interface StackComposition {
  /** Rolled value (post optional swap), or 0 for combat stacks. */
  base: number;
  /** Bonus from life-form (Blood +2/+1, Alien +2/+1, Tank-Born set/cap, Constructs, etc.) */
  lifeFormBonus: number;
  /** Bonus from background (rules/19 primary + close/ranged). */
  backgroundBonus: number;
  /** Bonus from installed implants. */
  implantBonus: number;
  /** Misc — artistic mod, advancement floor raise, GM grants, etc. */
  other: number;
  /** Cached sum: base + lifeFormBonus + backgroundBonus + implantBonus + other. */
  final: number;
}

/** Default zero composition for an unset stack. */
export function emptyStackComposition(): StackComposition {
  return {
    base: 0,
    lifeFormBonus: 0,
    backgroundBonus: 0,
    implantBonus: 0,
    other: 0,
    final: 0
  };
}

/** Compute final = sum of contributions for one composition slot. */
export function sumComposition(c: StackComposition): number {
  return c.base + c.lifeFormBonus + c.backgroundBonus + c.implantBonus + c.other;
}

/** Origo (starting) values per type from rules/18 body text. */
export interface OrigoValues {
  spaces: number;
  implants: number;
  shadow: number;
  gunta: number;
  closeStart: number;
  rangedStart: number;
}

// ============================================
// KEYWORDS
// ============================================

/** A keyword (e.g. "Stealth") tied to a stack (e.g. Speed). */
export interface CharacterKeyword {
  id: string;
  name: string;
  stack: Stack;
  notes?: string;
  /** Origin: own background pick, cross-pick from another bg, implant, AM. */
  source: 'background' | 'cross' | 'implant' | 'artistic_mod' | 'advancement' | 'other';
  fromBackground?: Background;
}

// ============================================
// IMPLANTS
// ============================================

export interface Implant {
  id: string;
  name: string;
  bodyPart: 'head' | 'body' | 'leg' | 'arm' | 'hand' | 'eye' | 'other';
  /** Mechanical effect (free text). */
  effect: string;
  /** Drawback / side effect (free text). */
  drawback?: string;
  /** If +X to a stack, record here (also affects derived totals if computed). */
  stackBonus?: { stack: Stack; bonus: number }[];
  /** Free-text resistance, keyword, etc. */
  notes?: string;
}

// ============================================
// FORMULAE
// ============================================

export type FormulaCategory = 'basic' | 'subspace';

export interface CharacterFormula {
  id: string;
  name: string;
  category: FormulaCategory;
  /** Whether this is currently in an active space (Core only). */
  active: boolean;
  /** Cost in H paid by this character (Core / scrolled / construct version). */
  hCost: string; // e.g. "1", "2", "ed6", "d6+3"
  notes?: string;
}

// ============================================
// EQUIPMENT
// ============================================

export type EquipmentLocation =
  | 'worn' // Slots 1-9 outside
  | 'slot10' // Slot 10 — backpack itself, etc.
  | 'backpack' // Inside the 5-slot backpack
  | 'no_slot' // No-slot worn / cosmetic / coins
  | 'mission' // Given by the GM / mission start
  | 'storage' // Off-character storage
  | 'other';

export interface EquipmentItem {
  id: string;
  name: string;
  /** Slots used (0.5 for ½, 0 for no-slot). */
  slots: number;
  /** Cost paid (Parts). 0 for gifts / no-cost. */
  cost: number;
  location: EquipmentLocation;
  /** True when the item is actively ready/deployed. Containers grant slots only while equipped. */
  equipped: boolean;
  /** True when the item is stored off-character and does not count toward carried slots. */
  stashed: boolean;
  /** True when this item can hold other items. */
  isContainer?: boolean;
  /** Extra carried slots granted while this container is equipped. */
  containerSlots?: number;
  /** Free-text description / notes. */
  notes?: string;
  /** Optional construction kit needed if rebuilt. */
  kit?: ConstructionKit;
  /** Whether this item is carried as a free gen pick (Up to 5 items, ≤ 100 P). */
  freePick?: boolean;
  /** Energy draw e/d (per day) or e/w (per week), as displayed string. */
  energyDraw?: string;
  /** If ammunition: total shots loaded + spare. */
  ammoLoaded?: number;
  ammoSpare?: number;
}

// ============================================
// WEAPONS / ARMOR
// ============================================

export interface CharacterWeapon {
  id: string;
  name: string;
  damage: DamageDie;
  damageType: DamageType;
  slots: number;
  range: WeaponRange;
  /** Clip size in shots/uses. */
  clip?: number;
  /** Loaded shots remaining. */
  ammoLoaded?: number;
  /** Spare shots / ammo. */
  ammoSpare?: number;
  cost: number;
  kit?: ConstructionKit;
  specials?: string[];
  notes?: string;
  twoHanded?: boolean;
  /** Equipped (in hand or holstered). */
  equipped: boolean;
  /** Stored off-character; cannot also be equipped. */
  stashed: boolean;
}

export interface CharacterArmor {
  id: string;
  name: string;
  /** Strength (damage type resisted) */
  strength?: string;
  /** Weakness (damage type vulnerability) */
  weakness?: string;
  slots: number;
  cost: number;
  kit?: ConstructionKit;
  notes?: string;
  /** True for Prime-only § heavy armors. */
  primeOnly?: boolean;
  equipped: boolean;
  /** Stored off-character; cannot also be equipped. */
  stashed: boolean;
  isShield?: boolean;
  isHelmet?: boolean;
}

// ============================================
// CURRENCY
// ============================================

export interface PursePile {
  /** On-hand / carried Parts (P). Counts against carried money slots. */
  parts: number;
  /** On-hand / carried small parts (p). Counts against carried money slots. */
  smallParts: number;
  /** On-hand / carried energy packs (E). Counts against carried money slots. */
  energyPacks: number;
  /** On-hand / carried energy cells (e). Counts against carried money slots. */
  energyCells: number;
  /** Off-character Parts (P). Does not count against carried slots. */
  stashedParts: number;
  /** Off-character small parts (p). Does not count against carried slots. */
  stashedSmallParts: number;
  /** Off-character energy packs (E). Does not count against carried slots. */
  stashedEnergyPacks: number;
  /** Off-character energy cells (e). Does not count against carried slots. */
  stashedEnergyCells: number;
}

export interface DebtEntry {
  id: string;
  amount: number; // in P
  holder: string; // free text — to whom
  notes?: string;
}

// ============================================
// GUNTA / TRACKERS
// ============================================

export interface SpecialGuntaCoin {
  id: string;
  name: string;
  /** Description of how the coin behaves. */
  effect: string;
  /** Refresh rule: "session", "milestone", "never" (one-shot), or free text. */
  refresh: 'session' | 'milestone' | 'never' | 'other';
  refreshNotes?: string;
  /** Currently held / available. */
  held: boolean;
}

/**
 * High-level harm status (rules/46 + rules/50 + rules/51). Drives badge color
 * and which controls are enabled in the harm tracker UI.
 *
 *   unharmed              — no harm at all
 *   harmed                — harm exists, but no end roll is required yet
 *   end-roll-pending      — physical harm > Bulk; an end roll is pending
 *   suspended             — attacker suspended an end roll (legal until 20)
 *   injured               — injured, still standing
 *   injured-knocked-down  — injured, knocked down, can get up
 *   injured-knocked-out   — failed end roll while harm < 20
 *   dying                 — failed end roll while harm = 20; d20 timer starts
 *   comatose              — nanite track hit 20; ed6 days + daily Ghost roll
 *   dead                  — terminal
 */
export type HarmStatus =
  | 'unharmed'
  | 'harmed'
  | 'end-roll-pending'
  | 'suspended'
  | 'injured'
  | 'injured-knocked-down'
  | 'injured-knocked-out'
  | 'dying'
  | 'comatose'
  | 'dead';

function normalizeHarmStatus(status: unknown): HarmStatus {
  switch (status) {
    case 'unharmed':
    case 'harmed':
    case 'end-roll-pending':
    case 'suspended':
    case 'injured':
    case 'injured-knocked-down':
    case 'injured-knocked-out':
    case 'dying':
    case 'comatose':
    case 'dead':
      return status;
    case 'clean':
      return 'unharmed';
    case 'at-risk':
      return 'end-roll-pending';
    case 'injured-ko':
      return 'injured-knocked-out';
    default:
      return 'unharmed';
  }
}

export interface HarmTrackers {
  // ---- Physical track (fills LEFT → RIGHT, box 1..20). Rules/46. ----
  harmTaken: number;
  /** Hard ceiling — always 20 (rules/46:3). */
  harmCap: number;

  // ---- Nanite track (fills RIGHT → LEFT, box 20..1). Rules/42, 50. ----
  naniteTaken: number;
  /** Hard ceiling — always 20 (rules/50:36 — coma at 20, NOT 5). */
  naniteCap: number;

  // ---- Status & state machine ----
  status: HarmStatus;
  /** Freeform table-state note for True Grit, medical aid, injuries, GM rulings. */
  statusNote: string;

  // ---- Suspended end-roll bookkeeping (rules/46:30). ----
  /** Attacker suspended a forced end roll. Legal only while harm < 20. */
  endRollSuspended: boolean;
  /** Harm level at the moment the suspend was initiated. */
  suspendedAtHarm: number;

  // ---- Dying state (rules/50:32-34). ----
  /** Hidden d20 timer the GM rolls — UI shows "??? rounds". */
  dyingTimer: number | null;
  /** Prime gets minutes; everyone else gets rounds. */
  dyingTimerUnit: 'round' | 'minute' | null;
  /** True if bleeding faster than the timer (rules/50:34). */
  bleeding: boolean;
  /** Total bled points — dies if > Bulk score (rules/50:34). */
  bloodShed: number;

  // ---- Comatose state (rules/50:36). ----
  /** ed6 days remaining at nanite-cap; daily DN 20 Ghost or die. */
  comaDays: number | null;

  // ---- Recovery bookkeeping (rules/51). ----
  /** Index of the long turn when last aid attempted (1/long-turn limit). */
  lastAidAttemptLongTurn: number | null;
  /** Detrimental keywords picked instead of taking an injury (rules/51:58). */
  detrimentalKeywords: string[];

  // ---- Penalty (rules/51:11). ----
  /** Until full rest, the character rolls one shift up on everything. */
  shiftUpPenalty: boolean;
}

// ============================================
// IDENTITY
// ============================================

export interface IdentityBlock {
  age?: string; // "mid-40s"
  gender?: string; // "male", "female", "nonbinary", free-text
  appearance?: string; // long-form description
  speech?: string; // long-form
  habits?: string; // long-form
  orientation?: string;
  demeanor?: string;
  /** Free-form additional notes. */
  notes?: string;
}

// ============================================
// SPACE CONTENT
// ============================================
//
// Per type, "spaces" hold:
//   Apt → equipment / master / place / pet that boosts a stack 1/24h
//   Core → formulae (active + inactive)
//   Prime → bested-enemy memories that buff 1/24h

export interface CharacterSpace {
  id: string;
  /** Active or inactive (Core formulae mostly). */
  active: boolean;
  kind: 'equipment' | 'master' | 'place' | 'pet' | 'formula' | 'bested_enemy' | 'other';
  name: string;
  effect: string;
  notes?: string;
}

// ============================================
// PETS / VEHICLES
// ============================================

export interface CharacterPet {
  id: string;
  name: string;
  kind: string; // "Zotusk", "Babbophant", "Monkey", etc.
  upkeepPerWeek?: number;
  notes?: string;
}

export interface CharacterVehicle {
  id: string;
  name: string;
  kind: string; // "Roller", "Walker", etc.
  energyPerDay?: number;
  notes?: string;
}

// ============================================
// HOOKS / BACKSTORY
// ============================================

export interface BackstoryHook {
  id: string;
  title: string;
  body: string;
  /** Open thread (deliberately unresolved) vs. resolved/known background. */
  open: boolean;
}

// ============================================
// ARTISTIC MODIFICATION (rules/30)
// ============================================
//
// Each AM kind picks ONE underlying mechanic. The description / drawback are
// kept for free-form record (and required for powerful implants per rules/30).
// `appliedRefs` records WHICH underlying record(s) the wizard created so the
// edit-mode UI can surface them and so future re-apply / undo can find them.

export type ArtisticModKind =
  | 'language'
  | 'extra_keyword'
  | 'reputation'
  | 'gunta_plus'
  | 'special_coin'
  | 'shadow_plus'
  | 'expensive_equipment'
  | 'implant'
  | 'off_list';

export interface ArtisticModAppliedRefs {
  /** id of the language added to character.languages (Language enum value). */
  languageId?: string;
  /** id of the keyword pushed to character.keywords[] (CharacterKeyword.id). */
  keywordId?: string;
  /** id of the SpecialGuntaCoin pushed to character.specialCoins[]. */
  specialCoinId?: string;
  /** id of the EquipmentItem pushed to character.inventory. */
  inventoryItemId?: string;
  /** id of the matching DebtEntry pushed to character.debts. */
  debtId?: string;
  /** id of the Implant pushed to character.implants[]. */
  implantId?: string;
  /**
   * Delta amounts applied (audit + rollback hint). For replace-style mods
   * (reputation, shadow position) we ALSO snapshot the prior absolute value
   * in `previousValues` so undo restores the true pre-AM state instead of
   * just subtracting the delta — that way a player can edit reputation /
   * shadow between AM applies without corrupting rollback.
   */
  reputationDelta?: number;
  shadowDelta?: number;
  guntaDelta?: number;
  previousValues?: {
    reputation?: number;
    shadow?: number;
    guntaValue?: number;
    typeGraphPosition?: { x: number; y: number };
  };
}

export interface ArtisticModRecord {
  chosen: boolean;
  kind: ArtisticModKind;
  /** Freeform notes (always allowed). */
  description?: string;
  /** Required for powerful implants per rules/30, optional otherwise. */
  drawback?: string;
  /**
   * What was actually applied to the character. Lets the edit view show the
   * linked record (e.g. "Implant: Eye +2R [linked: imp-osric-witness]") and
   * lets a future re-apply / undo find the records by id.
   *
   * Optional for backward compatibility — old characters created before AM
   * was wired keep their description-only record without `appliedRefs`.
   */
  appliedRefs?: ArtisticModAppliedRefs;
}

// ============================================
// SESSION LOG
// ============================================
//
// Per rules/52: each session in which the character survives a Shadow
// Encounter of higher degree than her current Shadow allows ONE
// orthogonal step on the type-graph during that session. Use it or lose
// it — there is NO banking, no carry-over, no spendable ledger.
//
// `SessionLogEntry` is a historical record only. It captures whether the
// session resulted in a move and, if so, where to. Rollback flips the
// `moved` field back to `false` and clears the move details, leaving the
// entry visible as "session logged but the movement was rolled back."

export interface SessionLogEntry {
  id: string;
  /** ISO timestamp when logged. */
  loggedAt: string;
  /** Optional free-text label ("Session 3, scene 2"). */
  sessionLabel?: string;
  /** Highest shadow encounter degree survived this session (record only — no validation). */
  highestEncounterDegree?: number;
  notes?: string;
  /** Shadow value AT SESSION START — recorded for retrospective audit. */
  shadowAtSessionStart?: number;
  /** True iff this session resulted in a graph move. */
  moved: boolean;
  /** If moved, the position before the move. */
  fromNode?: { x: number; y: number };
  /** If moved, the position after the move. */
  toNode?: { x: number; y: number };
  /** If moved, the orthogonal direction (or null if moved to plotted node via wizard). */
  direction?: 'up' | 'down' | 'left' | 'right';
}

// ============================================
// ADVANCEMENT LOG
// ============================================

/**
 * One entry in the character's type-graph advancement history.
 * Created by the AdvancementModal when the player confirms a step
 * to a new graph node, or by a single-step orthogonal move. Origo (0,0)
 * is the implicit starting point — not logged. Each subsequent step
 * writes one entry.
 */
export interface AdvancementLogEntry {
  id: string;
  /**
   * Discriminator. 'move' (default for legacy entries) is a normal
   * orthogonal advancement step. 'graph_swap' records the player swapping
   * the active OwnedGraph and (if the new graph has a node at the current
   * coord) applying that node's effects without spending a session.
   */
  kind?: 'move' | 'graph_swap';
  /** For 'graph_swap' entries — which graphs swapped and what node (if any) was applied. */
  graphSwap?: {
    fromGraphId: string;
    toGraphId: string;
    /** The node at the current coord on the NEW graph (if any) — what we applied effects from. */
    appliedNode?: TypeGraphNode;
  };
  /** Coordinates the character moved away from. */
  fromNode: { x: number; y: number };
  /** Coordinates of the new node. */
  toNode: { x: number; y: number };
  /** ISO timestamp when applied. */
  appliedAt: string;
  /** Human-readable list of the changes applied (spaces +1, C 3 → 4, etc.). */
  changes: string[];
  /** Optional player annotation (the fictional Shadow Encounter). */
  notes?: string;
  /**
   * Id of the SessionLogEntry that powered this move. On rollback the
   * linked SessionLogEntry's `moved` flips back to `false` and the move
   * detail fields (fromNode/toNode/direction) are cleared, so the log
   * shows "session logged but movement was rolled back".
   */
  sessionLogEntryId?: string;
  /**
   * True if this entry can be safely rolled back. Auto-set false when a
   * later advancement built on top of it (e.g. picked a keyword, then a
   * later advancement rearranged it). Only the most recent entry is
   * normally `reversible: true`.
   */
  reversible?: boolean;
  /**
   * Snapshot of state BEFORE this advancement was applied — only the
   * fields the advancement actually mutated. Used to revert on rollback.
   */
  beforeState?: {
    stacks?: Partial<Record<Stack, number>>;
    /**
     * Per-stack composition slots before the advancement. Floor raises
     * mutate composition.other (so view-mode and recomputeStacks see the
     * raise immediately); rollback must restore both `stacks` AND the
     * composition slot or the cached final desyncs.
     */
    stackComposition?: Partial<Record<Stack, StackComposition>>;
    /** Implants cap floor before raise. */
    implantsCap?: number;
    /** Spaces added — by id, so we can remove them on undo. */
    spacesAddedIds?: string[];
    /** Keywords added — by id, so we can remove them on undo. */
    keywordsAddedIds?: string[];
    /** Bond before swap (Core only). */
    coreBond?: 'holoh' | 'nanite_cloud' | 'subspace_nanites' | 'none';
    /**
     * Bond notes before swap. We restore these alongside `coreBond` so
     * a swap-then-undo round-trip preserves any notes the player wrote
     * in between (or the empty default for a brand-new character).
     */
    coreBondNotes?: string;
    /** Per-keyword previous stack assignments (only changed ones). */
    keywordRearrangements?: { keywordId: string; previousStack: Stack }[];
    /** Shadow value before move. */
    shadow?: number;
    /** Gunta value before move. */
    guntaValue?: number;
    /**
     * If this advancement was a PROMOTE of an existing no-move
     * SessionLogEntry, snapshot the pre-promote session record so
     * rollback can restore label/degree/notes the player may have
     * edited in the promote modal — not just clear the move-detail
     * fields. Absent for fresh-create advancements (the linked session
     * is just deleted... no wait, fresh-create flips moved=false too;
     * but for fresh-create the no-move record IS the desired
     * post-rollback state since the player set those values when they
     * confirmed the take-step).
     *
     * Captured fields: sessionLabel, highestEncounterDegree, notes.
     * (loggedAt and shadowAtSessionStart are preserved through promote
     * by design, so they don't need a separate snapshot.)
     */
    priorSession?: {
      sessionLabel?: string;
      highestEncounterDegree?: number;
      notes?: string;
    };
  };
}

// ============================================
// MAIN CHARACTER
// ============================================

export interface SWCharacter {
  id: string;
  schemaVersion: number;

  // Identity ribbon
  name: string; // PC name, e.g. "Osric Ward"
  title?: string; // sheet title, e.g. "The Quiet Hand"
  type: CharacterType;
  lifeForm: LifeForm;
  background: Background;

  // Origo (per type, rules/18 body)
  origo: OrigoValues;

  // Stacks (final scores after life-form + bg + implant adjustments)
  stacks: StackScores;
  /** Original rolls before any modifiers, kept for the wizard / display. */
  baseStackRolls?: Partial<StackScores>;
  /**
   * Per-stack composition (base + life-form + background + implant + other).
   * `stacks[k]` is the cached sum — kept for backward compat with code that
   * doesn't yet know about composition. Whenever any composition slot
   * changes, call `recomputeStacks(c)` to refresh `stacks`.
   * Older saves missing this field are migrated by `normalizeCharacter`:
   * `base = baseStackRolls[k] ?? stacks[k]`, all other slots zero.
   */
  stackComposition?: Record<Stack, StackComposition>;

  // Combat stack origin notes
  /** For Apt: which combat stack started at 1 (the other at 0). */
  aptCombatPick?: 'close' | 'ranged';
  /** For Tank Born: which combat stack got the +2. */
  tankCombatPick?: 'close' | 'ranged';
  /** For Tank Born: stack capped at 8. */
  tankCappedStack?: 'archive' | 'bulk' | 'morph';

  // Construct subtype (rules/18 — Constructs section).
  constructBuiltIns?: string[]; // up to 3 built-in tools, total ≤ 50 P
  constructFormula?: string;    // built-in formula adaptation
  /** Droid Construct Inspiration (rules/18): original use, optimization, since-creation history. */
  droidInspiration?: { use?: string; optimization?: string; history?: string };
  /** Holid Construct Inspiration (rules/18): original purpose, transformation effects. */
  holidInspiration?: { purpose?: string; transform?: string };

  // Alien (rules/18 — Aliens section).
  alienResistance?: string;
  alienVulnerability?: string;
  alienFeature?: string;
  alienInnateFormula?: string;

  // Bond (Core only)
  coreBond?: 'holoh' | 'nanite_cloud' | 'subspace_nanites' | 'none';
  coreBondNotes?: string;

  // Keywords
  keywords: CharacterKeyword[];

  // Languages
  languages: Language[];
  thirdLanguageRoll?: number; // d3 result, 1/2/3

  // Spaces (slot for type-specific abilities)
  spaces: CharacterSpace[];

  // Equipment
  weapons: CharacterWeapon[];
  armor: CharacterArmor[];
  inventory: EquipmentItem[];
  formulae: CharacterFormula[];
  implants: Implant[];
  pets: CharacterPet[];
  vehicles: CharacterVehicle[];

  // Currency / economy
  purse: PursePile;
  spentAtGen?: number; // P spent during generation
  startingFundsRoll?: number; // d6 roll
  startingFunds?: number; // P granted by table
  debts: DebtEntry[];

  // Trackers
  beginnerGuntaCoins: number; // Default 3, never refreshes
  guntaValue: number; // Steady value from type-graph node
  specialCoins: SpecialGuntaCoin[];
  shadow: number; // Shadow value
  reputation: number; // 0-8 typical
  harm: HarmTrackers;
  /**
   * Historical session log (rules/52, strict no-banking). One entry per
   * session the player records, regardless of whether they advanced.
   * Each "Take advancement step" produces an entry with `moved: true`;
   * "Log session (no move)" produces an entry with `moved: false`. There
   * is no spending state — surviving a higher-degree shadow encounter
   * grants the right to take ONE step in THAT session only. Use it or
   * lose it.
   */
  sessionLog: SessionLogEntry[];

  // Type-graph node tracker
  typeGraphPosition?: { x: number; y: number }; // Default (0,0) origo
  /** Append-only log of advancement steps (origo → first node → ...). */
  advancementHistory?: AdvancementLogEntry[];

  /**
   * Graph library — the player's owned advancement graphs.
   * Always at least one entry (the default for the character's type, seeded
   * by createDefaultCharacter / normalizeCharacter). Looted + custom graphs
   * are appended over the campaign as the player picks them up. The
   * character advances on whichever entry is currently `activeGraphId`.
   */
  ownedGraphs?: OwnedGraph[];
  /** Id of the OwnedGraph currently driving advancement. */
  activeGraphId?: string;

  // Identity / fiction
  identity: IdentityBlock;
  hooks: BackstoryHook[];

  // Artistic Modification (rules/30)
  artisticMod?: ArtisticModRecord;

  // Free-form
  notes?: string;

  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

// ============================================
// FACTORY / DEFAULT
// ============================================

/** Pretty-print a CharacterType for graph-name labels. */
export function typeLabel(t: CharacterType): string {
  switch (t) {
    case 'apt':
      return 'Apt';
    case 'core':
      return 'Core';
    case 'prime':
      return 'Prime';
  }
}

/** Generate a fresh random id (UUID where supported, fallback for older runtimes). */
function newGraphId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `og-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Seed a fresh "default" OwnedGraph for the given character type. */
export function makeDefaultOwnedGraph(type: CharacterType): OwnedGraph {
  return {
    id: newGraphId(),
    name: `Default ${typeLabel(type)}`,
    source: 'default',
    graph: structuredClone(getTypeGraph(type)),
    acquiredAt: new Date().toISOString()
  };
}

export function createDefaultCharacter(): SWCharacter {
  const now = new Date().toISOString();
  const defaultOwned = makeDefaultOwnedGraph('apt');
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sw-${Date.now()}`,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: '',
    title: '',
    type: 'apt',
    lifeForm: 'blood',
    background: 'enforcer',
    ownedGraphs: [defaultOwned],
    activeGraphId: defaultOwned.id,
    origo: {
      spaces: 1,
      implants: 1,
      shadow: 0,
      gunta: 0,
      closeStart: 0,
      rangedStart: 1
    },
    stacks: {
      archive: 0,
      bulk: 0,
      ghost: 0,
      morph: 0,
      speed: 0,
      tech: 0,
      close: 0,
      // Apt origo grants Ranged 1 by default (player can flip to Close in wizard).
      ranged: 1
    },
    aptCombatPick: 'ranged',
    keywords: [],
    languages: ['pidgin'],
    spaces: [],
    weapons: [],
    armor: [],
    inventory: [],
    formulae: [],
    implants: [],
    pets: [],
    vehicles: [],
    purse: {
      parts: 0,
      smallParts: 0,
      energyPacks: 0,
      energyCells: 0,
      stashedParts: 0,
      stashedSmallParts: 0,
      stashedEnergyPacks: 0,
      stashedEnergyCells: 0
    },
    debts: [],
    beginnerGuntaCoins: 3,
    guntaValue: 0,
    specialCoins: [],
    shadow: 0,
    reputation: 0,
    harm: {
      harmTaken: 0,
      harmCap: 20,
      naniteTaken: 0,
      naniteCap: 20,
      status: 'unharmed',
      statusNote: '',
      endRollSuspended: false,
      suspendedAtHarm: 0,
      dyingTimer: null,
      dyingTimerUnit: null,
      bleeding: false,
      bloodShed: 0,
      comaDays: null,
      lastAidAttemptLongTurn: null,
      detrimentalKeywords: [],
      shiftUpPenalty: false
    },
    sessionLog: [],
    typeGraphPosition: { x: 0, y: 0 },
    advancementHistory: [],
    stackComposition: {
      archive: emptyStackComposition(),
      bulk: emptyStackComposition(),
      ghost: emptyStackComposition(),
      morph: emptyStackComposition(),
      speed: emptyStackComposition(),
      tech: emptyStackComposition(),
      close: emptyStackComposition(),
      // Apt origo grants Ranged 1 by default — express as base 1 so the
      // composition sums match `stacks.ranged`.
      ranged: { ...emptyStackComposition(), base: 1, final: 1 }
    },
    // All long-form `string?` fields seeded as '' so Svelte 5 components with
    // `value = $bindable('')` (TextArea / Select) never see `undefined` and
    // throw `props_invalid_value`. See migrateCharacter() in
    // stores/characters.svelte.ts — defaults are spread over rehydrated rows
    // so older saves missing these fields stay bind-safe.
    identity: {
      age: '',
      gender: '',
      appearance: '',
      speech: '',
      habits: '',
      orientation: '',
      demeanor: '',
      notes: ''
    },
    hooks: [],
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Normalize an unknown character-shaped object into a fully-populated SWCharacter.
 *
 * Pulls every default field forward, deep-merges nested objects, and ensures
 * every array-element optional `string` field is at least `''` so Svelte 5
 * `bind:value` / `bind:checked` against `$bindable('')` / `$bindable(false)`
 * components never receives `undefined` (which throws `props_invalid_value`).
 *
 * Use this anywhere a character enters the app from outside the wizard:
 *   - SQLite rehydration (stores/characters.svelte.ts loadCharacters)
 *   - JSON import (utils/importExport.ts parseImportText)
 *   - edit-page clone (defensive belt+braces)
 *
 * Single source of truth so the migration logic doesn't drift.
 */
export function normalizeCharacter(raw: unknown): SWCharacter {
  const d = createDefaultCharacter();
  const c = raw && typeof raw === 'object' ? (raw as Partial<SWCharacter>) : {};
  // Imports use this same path — pre-resolve the merged stacks so the
  // composition migrator below sees the correct final values.
  const mergedStacks = { ...d.stacks, ...(c.stacks ?? {}) };
  // Build composition: prefer existing per-stack composition, otherwise
  // synthesize one with `base = baseStackRolls[k] ?? mergedStacks[k]` and
  // zero the rest. The player can edit later to attribute the rest to
  // life-form / background / implants / other.
  const compIn = (c.stackComposition ?? {}) as Partial<Record<Stack, StackComposition>>;
  const baseRolls = (c.baseStackRolls ?? {}) as Partial<Record<Stack, number>>;
  const allStacks: Stack[] = ['archive', 'bulk', 'ghost', 'morph', 'speed', 'tech', 'close', 'ranged'];
  const composition = {} as Record<Stack, StackComposition>;
  for (const k of allStacks) {
    const existing = compIn[k];
    if (existing) {
      // Preserve a partially-populated composition, but coerce missing
      // contribution slots to 0 so sumComposition can't return NaN if
      // an importer dropped a slot. Then recompute `final` so the cache
      // matches what we actually summed.
      const safe: StackComposition = {
        base: typeof existing.base === 'number' ? existing.base : 0,
        lifeFormBonus: typeof existing.lifeFormBonus === 'number' ? existing.lifeFormBonus : 0,
        backgroundBonus: typeof existing.backgroundBonus === 'number' ? existing.backgroundBonus : 0,
        implantBonus: typeof existing.implantBonus === 'number' ? existing.implantBonus : 0,
        other: typeof existing.other === 'number' ? existing.other : 0,
        final: 0
      };
      safe.final = sumComposition(safe);
      composition[k] = safe;
    } else {
      // Migration: derive base from baseStackRolls if available, otherwise
      // use the cached final stack value as base. Other slots zeroed.
      const baseVal = baseRolls[k] ?? mergedStacks[k] ?? 0;
      composition[k] = {
        base: baseVal,
        lifeFormBonus: 0,
        backgroundBonus: 0,
        implantBonus: 0,
        other: 0,
        final: baseVal
      };
    }
  }
  // After migration, the cached `stacks` may differ from the composition
  // sums (legacy chars had final values in `stacks` but only `base` in
  // composition). Trust `stacks` for legacy characters — they reflect the
  // GM's last known truth — and DON'T overwrite them. The player can later
  // explicitly attribute the bonuses; until then the cached final stays.
  // We do however ensure each composition entry's final mirrors the cached
  // stack so the UI doesn't render an inconsistent breakdown.
  //
  // Apply the same reconciliation for partially-populated compositions —
  // if the imported slot's sum disagrees with the cached stack, fold the
  // delta into `other` so base+life+bg+implant+other = cached final.
  for (const k of allStacks) {
    if (mergedStacks[k] !== composition[k].final) {
      const delta = mergedStacks[k] - composition[k].final;
      composition[k] = {
        ...composition[k],
        other: composition[k].other + delta,
        final: mergedStacks[k]
      };
    }
  }

  // Session log — strict no-banking model (rules/52). Each session the
  // player records appears here; `moved` carries whether that session
  // resulted in a graph step. Missing field just means an empty log.
  // Migration: legacy `qualifyingSessions` arrays (pre-refactor saves)
  // are dropped silently — they used a banking model that no longer
  // applies. The advancementHistory log already captures any steps that
  // were taken; the per-session ledger isn't reconstructible from it
  // (we don't know the un-spent banked sessions), so we accept the small
  // history loss to keep the new model clean. Future imports just write
  // `sessionLog` directly.
  const sessions: SessionLogEntry[] = (c as { sessionLog?: SessionLogEntry[] }).sessionLog ?? [];

  // Implant.drawback is the one optional `string?` bound directly via TextArea
  // (CharacterEditForm line 285). Other array-element bindings either go to
  // Input/NumberInput (safe — bare $bindable()) or are always populated by the
  // form's add* helpers, but normalize defensively to harden against
  // hand-written / future-imported data.
  const normImplants = (c.implants ?? []).map((i) => ({
    ...i,
    drawback: i?.drawback ?? '',
    notes: i?.notes ?? ''
  }));
  const normSpaces = (c.spaces ?? []).map((s) => ({
    ...s,
    notes: s?.notes ?? ''
  }));
  // Equipment normalization: legacy saves may be missing the boolean / numeric
  // / location fields that the new EquipmentSection editors expect to be
  // populated. Default `equipped` to false (safer than true — won't silently
  // count toward slots), `slots` / `cost` to 0, and `location` to 'storage'
  // so an inventory item without a location doesn't crash the
  // LOCATION_LABEL[item.location] lookup in GearEditor.
  const normWeapons = (c.weapons ?? []).map((w) => ({
    ...w,
    notes: w?.notes ?? '',
    stashed: typeof w?.stashed === 'boolean' ? w.stashed : w?.equipped === false,
    equipped: (typeof w?.equipped === 'boolean' ? w.equipped : false) && !(typeof w?.stashed === 'boolean' ? w.stashed : false),
    slots: typeof w?.slots === 'number' ? w.slots : 0,
    cost: typeof w?.cost === 'number' ? w.cost : 0
  }));
  const normArmor = (c.armor ?? []).map((a) => ({
    ...a,
    strength: a?.strength ?? '',
    weakness: a?.weakness ?? '',
    notes: a?.notes ?? '',
    stashed: typeof a?.stashed === 'boolean' ? a.stashed : a?.equipped === false,
    equipped: (typeof a?.equipped === 'boolean' ? a.equipped : false) && !(typeof a?.stashed === 'boolean' ? a.stashed : false),
    slots: typeof a?.slots === 'number' ? a.slots : 0,
    cost: typeof a?.cost === 'number' ? a.cost : 0,
    isShield: typeof a?.isShield === 'boolean' ? a.isShield : false,
    isHelmet: typeof a?.isHelmet === 'boolean' ? a.isHelmet : false,
    primeOnly: typeof a?.primeOnly === 'boolean' ? a.primeOnly : false
  }));
  const normInventory = (c.inventory ?? []).map((i) => {
    const stashed = typeof i?.stashed === 'boolean' ? i.stashed : i?.location === 'storage';
    const equipped = (typeof i?.equipped === 'boolean' ? i.equipped : !stashed) && !stashed;
    const name = i?.name ?? '';
    const notes = i?.notes ?? '';
    const noteSlotMatch =
      notes.match(/(\d+(?:\.\d+)?)\s*internal\s*slots?/i) ??
      notes.match(/(?:grants?|adds?|capacity|container).*?(\d+(?:\.\d+)?)\s*slots?/i);
    const noteSlots = Number(noteSlotMatch?.[1] ?? 0);
    const inferredContainerSlots = /carrier bot/i.test(name) ? 10 : /backpack|valise/i.test(name) ? 5 : noteSlots;
    const isContainer = typeof i?.isContainer === 'boolean' ? i.isContainer : inferredContainerSlots > 0;
    return {
      ...i,
      notes: i?.notes ?? '',
      slots: typeof i?.slots === 'number' ? i.slots : 0,
      cost: typeof i?.cost === 'number' ? i.cost : 0,
      location: stashed ? 'storage' : (i?.location ?? 'worn'),
      equipped,
      stashed,
      isContainer,
      containerSlots: typeof i?.containerSlots === 'number' ? i.containerSlots : inferredContainerSlots
    };
  });
  const normKeywords = (c.keywords ?? []).map((k) => ({
    ...k,
    notes: k?.notes ?? ''
  }));
  const normHooks = (c.hooks ?? []).map((h) => ({
    ...h,
    body: h?.body ?? '',
    title: h?.title ?? ''
  }));
  const normCoins = (c.specialCoins ?? []).map((s) => ({
    ...s,
    refreshNotes: s?.refreshNotes ?? ''
  }));
  const normDebts = (c.debts ?? []).map((dbt) => ({
    ...dbt,
    notes: dbt?.notes ?? ''
  }));

  // ============================================
  // OWNED GRAPHS — backfill if missing, and enforce default-graph contract.
  // ============================================
  // Legacy characters have no `ownedGraphs` / `activeGraphId`. Seed exactly
  // one entry — the default graph for the character's type — and mark it
  // active. Characters that already have entries keep theirs intact (we
  // re-validate `activeGraphId` points at one of them) BUT we also
  // guarantee that at least one entry with `source: 'default'` exists for
  // the character's type — the rest of the model + UI assume the player
  // always owns the immutable default for fall-back / reset purposes.
  // If a malformed import has only custom/looted entries, we PREPEND a
  // fresh default; we do not change the active graph in that case.
  const charType: CharacterType = (c.type ?? d.type) as CharacterType;
  let ownedGraphs: OwnedGraph[] = (c as { ownedGraphs?: OwnedGraph[] }).ownedGraphs ?? [];
  let activeGraphId: string | undefined = (c as { activeGraphId?: string }).activeGraphId ?? undefined;
  if (!Array.isArray(ownedGraphs) || ownedGraphs.length === 0) {
    const seeded = makeDefaultOwnedGraph(charType);
    ownedGraphs = [seeded];
    activeGraphId = seeded.id;
  } else {
    // Defensive: ensure each entry has the minimum fields populated.
    ownedGraphs = ownedGraphs.map((og) => ({
      id: og.id || newGraphId(),
      name: og.name || `Graph ${og.id?.slice(0, 4) ?? ''}`,
      source: (og.source as OwnedGraphSource) || 'custom',
      graph: og.graph && Array.isArray(og.graph.nodes) ? og.graph : structuredClone(getTypeGraph(charType)),
      acquiredAt: og.acquiredAt || new Date().toISOString(),
      notes: og.notes
    }));
    // Enforce: at least one default-source graph for the character's type.
    const hasDefaultForType = ownedGraphs.some((og) => og.source === 'default' && og.graph?.type === charType);
    if (!hasDefaultForType) {
      ownedGraphs = [makeDefaultOwnedGraph(charType), ...ownedGraphs];
    }
    if (!activeGraphId || !ownedGraphs.some((og) => og.id === activeGraphId)) {
      activeGraphId = ownedGraphs[0].id;
    }
  }

  function moneyAmount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  const rawPurse = (c.purse ?? {}) as Partial<PursePile> & Record<string, unknown>;
  const purse: PursePile = {
    parts: moneyAmount(rawPurse.parts),
    smallParts: moneyAmount(rawPurse.smallParts),
    energyPacks: moneyAmount(rawPurse.energyPacks),
    energyCells: moneyAmount(rawPurse.energyCells),
    stashedParts: moneyAmount(rawPurse.stashedParts),
    stashedSmallParts: moneyAmount(rawPurse.stashedSmallParts),
    stashedEnergyPacks: moneyAmount(rawPurse.stashedEnergyPacks),
    stashedEnergyCells: moneyAmount(rawPurse.stashedEnergyCells)
  };

  return {
    ...d,
    ...c,
    // Top-level optional `string?` bound via TextArea — guard explicit-undefined.
    notes: c.notes ?? '',
    title: c.title ?? '',
    // Deep-merge nested objects so a partial saved version doesn't leave
    // inner fields undefined. Explicit `undefined` in the imported identity
    // would overwrite the default '' — restore '' per field so bindable
    // TextAreas never see undefined.
    identity: (() => {
      const merged = { ...d.identity, ...(c.identity ?? {}) };
      for (const k of ['age', 'gender', 'appearance', 'speech', 'habits', 'orientation', 'demeanor', 'notes'] as const) {
        if (merged[k] === undefined) merged[k] = '';
      }
      return merged;
    })(),
    harm: (() => {
      const merged = { ...d.harm, ...(c.harm ?? {}) };
      // Migration: old saves had naniteCap=5 (incorrect — rules/50:36 says 20).
      if ((merged as { naniteCap?: number }).naniteCap !== 20) merged.naniteCap = 20;
      merged.status = normalizeHarmStatus((merged as { status?: unknown }).status);
      merged.statusNote = typeof (merged as { statusNote?: unknown }).statusNote === 'string' ? merged.statusNote : '';
      return merged;
    })(),
    purse,
    origo: { ...d.origo, ...(c.origo ?? {}) },
    stacks: mergedStacks,
    stackComposition: composition,
    sessionLog: sessions,
    // Array-element normalization (see comment block above).
    implants: normImplants,
    spaces: normSpaces,
    weapons: normWeapons,
    armor: normArmor,
    inventory: normInventory,
    keywords: normKeywords,
    hooks: normHooks,
    specialCoins: normCoins,
    debts: normDebts,
    ownedGraphs,
    activeGraphId,
    schemaVersion: CURRENT_SCHEMA_VERSION
  } as SWCharacter;
}

/**
 * Sum every implant's stack-bonus contributions per stack. Used to refresh
 * the `implantBonus` composition slot after the implants list changes.
 */
export function aggregateImplantBonuses(implants: Implant[]): Partial<Record<Stack, number>> {
  const totals: Partial<Record<Stack, number>> = {};
  for (const i of implants) {
    if (!i.stackBonus) continue;
    for (const { stack, bonus } of i.stackBonus) {
      totals[stack] = (totals[stack] ?? 0) + bonus;
    }
  }
  return totals;
}

/**
 * Refresh `character.stacks` and each composition's `final` from the
 * per-stack composition slots. Returns a new character object — does NOT
 * mutate the input. Call after any composition slot edit.
 *
 * If `refreshImplantBonus` is true, the per-stack `implantBonus` slot is
 * first recomputed from `character.implants[].stackBonus[]` so the cache
 * tracks the implant list. Wizard / edit flows that mutate implants set
 * this true.
 */
export function recomputeStacks(c: SWCharacter, refreshImplantBonus = false): SWCharacter {
  const allStacks: Stack[] = ['archive', 'bulk', 'ghost', 'morph', 'speed', 'tech', 'close', 'ranged'];
  const composition = { ...(c.stackComposition ?? {}) } as Record<Stack, StackComposition>;
  const stacks: StackScores = { ...c.stacks };
  const implantTotals = refreshImplantBonus ? aggregateImplantBonuses(c.implants) : {};
  for (const k of allStacks) {
    const baseSlot = composition[k] ?? emptyStackComposition();
    const slot = refreshImplantBonus ? { ...baseSlot, implantBonus: implantTotals[k] ?? 0 } : baseSlot;
    const final = sumComposition(slot);
    composition[k] = { ...slot, final };
    stacks[k] = final;
  }
  return {
    ...c,
    stacks,
    stackComposition: composition
  };
}

/** Clone a character giving it a new id. Used by import. */
export function cloneCharacterWithNewIds(input: SWCharacter): SWCharacter {
  const newId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...input,
    id: newId,
    updatedAt: new Date().toISOString()
  };
}

// ============================================
// CONSTANTS
// ============================================

/** Number of base equipment slots a character carries (slots 1-10). */
export const BASE_EQUIPMENT_SLOTS = 10;
/** Backpack adds 5 slots when placed in slot 10. */
export const BACKPACK_BONUS_SLOTS = 5;

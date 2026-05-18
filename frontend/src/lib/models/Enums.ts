/**
 * Enums.ts - Suldokar's Wake fundamental enumerations.
 *
 * These are domain types — character type, life-form, background, stack,
 * weapon family, currency, etc. — used across the model and data layers.
 */

// ============================================
// CHARACTER TYPE
// ============================================

export type CharacterType = 'apt' | 'core' | 'prime';

export const CHARACTER_TYPES: { id: CharacterType; label: string; tagline: string }[] = [
  { id: 'apt', label: 'Apt', tagline: 'Expertise & equipment' },
  { id: 'core', label: 'Core', tagline: 'Nanites & mysteries' },
  { id: 'prime', label: 'Prime', tagline: 'Combat & physique' }
];

// ============================================
// LIFE-FORM
// ============================================

export type LifeForm = 'blood' | 'palp_alien' | 'amphibious_alien' | 'tank_born' | 'droid' | 'holid';

export const LIFE_FORMS: { id: LifeForm; label: string; group: 'blood' | 'alien' | 'tank_born' | 'construct' }[] = [
  { id: 'blood', label: 'Blood', group: 'blood' },
  { id: 'palp_alien', label: 'Palp Alien', group: 'alien' },
  { id: 'amphibious_alien', label: 'Amphibious Alien', group: 'alien' },
  { id: 'tank_born', label: 'Tank Born', group: 'tank_born' },
  { id: 'droid', label: 'Droid', group: 'construct' },
  { id: 'holid', label: 'Holid', group: 'construct' }
];

// Number of stack pairs (zero rolls) → allowed life-form groups (rules/18).
export function allowedLifeForms(pairs: number): LifeForm[] {
  if (pairs <= 0) return ['blood', 'palp_alien', 'amphibious_alien'];
  if (pairs === 1) return ['blood'];
  if (pairs === 2) return ['blood', 'palp_alien', 'amphibious_alien', 'tank_born'];
  return ['blood', 'palp_alien', 'amphibious_alien', 'tank_born', 'droid', 'holid'];
}

// ============================================
// BACKGROUND
// ============================================

export type Background = 'enforcer' | 'diplomat' | 'entertainer' | 'cultist' | 'fixer' | 'outrider' | 'archivist' | 'worker';

export const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: 'enforcer', label: 'Enforcer' },
  { id: 'diplomat', label: 'Diplomat' },
  { id: 'entertainer', label: 'Entertainer' },
  { id: 'cultist', label: 'Cultist' },
  { id: 'fixer', label: 'Fixer' },
  { id: 'outrider', label: 'Outrider' },
  { id: 'archivist', label: 'Archivist' },
  { id: 'worker', label: 'Worker' }
];

// ============================================
// STACKS — six primary + two combat (Close, Ranged)
// ============================================

export type PrimaryStack = 'archive' | 'bulk' | 'ghost' | 'morph' | 'speed' | 'tech';
export type CombatStack = 'close' | 'ranged';
export type Stack = PrimaryStack | CombatStack;

export const PRIMARY_STACKS: PrimaryStack[] = ['archive', 'bulk', 'ghost', 'morph', 'speed', 'tech'];
export const COMBAT_STACKS: CombatStack[] = ['close', 'ranged'];
export const ALL_STACKS: Stack[] = [...PRIMARY_STACKS, ...COMBAT_STACKS];

export const STACK_LABELS: Record<Stack, string> = {
  archive: 'Archive',
  bulk: 'Bulk',
  ghost: 'Ghost',
  morph: 'Morph',
  speed: 'Speed',
  tech: 'Tech',
  close: 'Close',
  ranged: 'Ranged'
};

export const STACK_DESCRIPTIONS: Record<Stack, string> = {
  archive: 'Knowledge, memory, records',
  bulk: 'Strength, endurance, harm',
  ghost: 'Will, awareness, death',
  morph: 'Body control, disguise, change',
  speed: 'Reflexes, stealth, movement',
  tech: 'Machines, tools, repair',
  close: 'Melee and close fighting',
  ranged: 'Guns and distance attacks'
};

// Single-letter shortcodes used in SW source (A, B, G, M, S, T, C, R)
export const STACK_SHORT: Record<Stack, string> = {
  archive: 'A',
  bulk: 'B',
  ghost: 'G',
  morph: 'M',
  speed: 'S',
  tech: 'T',
  close: 'C',
  ranged: 'R'
};

// ============================================
// LANGUAGES
// ============================================

export type Language =
  | 'pidgin'
  | 'vatori'
  | 'old_imperial'
  | 'hro_hro'
  | 'shagadar'
  | 'tgaka'
  | 'katonga'
  | 'slither'
  | 'al_gol'
  | 'klsixla'
  | 'bugga'
  | 'orug'
  | 'palp'
  | 'aeonic'
  | 'fungal'
  | 'krypotkep'
  | 'thieves_cant'
  | 'mime'
  | 'harabarum';

// ============================================
// WEAPONS / ARMOR
// ============================================

export type DamageDie = 'd3' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'special' | 'none';

export type DamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'kinetic' | 'energy' | 'non-injuring' | 'varies';

export type WeaponRange = 'melee' | 'room' | 'range' | 'long_range';

export type ConstructionKit = 'A' | 'B' | 'C' | 'E' | 'G' | 'T' | 'W' | 'M';

export const KIT_LABELS: Record<ConstructionKit, string> = {
  A: 'Armor',
  B: 'Blueprint',
  C: 'Chemical',
  E: 'Explosives',
  G: 'General',
  T: 'Tools',
  W: 'Weapons',
  M: 'Maker'
};

// ============================================
// CURRENCY (parts and energy, major/minor denominations)
// ============================================
//
// Zira-Kaan economy uses P-arts, p-arts, E-nergy packs, and e-nergy cells.
// E:P, e:p, E:e, and P:p are all 1:10.

export type Currency = 'parts' | 'small_parts' | 'energy_packs' | 'energy_cells';

export const CURRENCY_LABELS: Record<Currency, string> = {
  parts: 'P',
  small_parts: 'p',
  energy_packs: 'E',
  energy_cells: 'e'
};

// ============================================
// HARM
// ============================================

export type HarmKind = 'physical' | 'nanite';

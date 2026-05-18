/**
 * lifeFormTables.ts — d12 / d10 / d11 tables and lookup data for the
 * unique life-form sub-systems (rules/18 body text).
 *
 * Covers:
 *   - Alien resistance / vulnerability (one d12 table, rolled twice)
 *   - Alien feature (separate d12 table)
 *   - Tank Born "corresponding appearance" trait based on capped stack
 *   - Droid Construct Inspiration (use / optimization / since-creation history)
 *   - Holid Construct Inspiration (original purpose / transformation effect)
 *
 * Used by:
 *   - Creation wizard (life-form step) to roll / pick these values
 *   - Edit form (Identity tab) to re-edit them post-creation
 *   - View sheet to display
 */

import type { PrimaryStack } from '$lib/models/Enums';

/** d12 table — alien resistance + alien vulnerability share this list.
 *  Roll twice (re-roll dupes if you want — RAW is silent).
 *  Named `ALIEN_RES_VUL_PICKS` (not `ALIEN_RES_VULN_TABLE`) so it doesn't
 *  collide with the legacy object-form table in `lifeforms.ts` used by
 *  LifeFormInfoPanel's display-only reference table. */
export const ALIEN_RES_VUL_PICKS = [
  'Heat',
  'Cold',
  'Energy',
  'Mental',
  'Poison',
  'Disease',
  'Acid',
  'Fear',
  'Death',
  'Light',
  'Sound',
  'Radiation'
] as const;

/** d12 table — alien physical feature (one roll, in addition to palp/amphibious features).
 *  Named `ALIEN_FEATURE_PICKS` to avoid colliding with the legacy
 *  `ALIEN_FEATURE_TABLE` (object form) in `lifeforms.ts`. */
export const ALIEN_FEATURE_PICKS = [
  'Very powerful bones',
  'Extra joints',
  'Curved spine',
  'Impossibly thin or fat',
  'Very protruding jaw',
  'Three digits hands',
  'No nostrils or no nose',
  'Slit ears or huge ears',
  'Huge eyes or glowing eyes',
  'Slightly translucent skull',
  'Deep wrinkles everywhere',
  'Moving birthmarks'
] as const;

/** Tank Born "corresponding appearance" trait — paired with the set/cap stack.
 *  Rules/18: "All have one out of three enhancements: Archive, Bulk or Morph is set and capped at 8 with a corresponding appearance." */
export const TANK_BORN_APPEARANCE: Record<'archive' | 'bulk' | 'morph', string> = {
  archive: 'Oversized head',
  bulk: 'Very tall and muscular',
  morph: 'Huge eyes and long neck'
};

/** Droid Construct Inspiration — what the droid was originally designed for. */
export const DROID_USE_TABLE = [
  'Servant',
  'Guide',
  'Worker',
  'Exploration',
  'War',
  'Pleasure',
  'Companion',
  'Scout',
  'Science',
  'Janitor'
] as const;

/** Droid Construct Inspiration — how it was optimized for that purpose. */
export const DROID_OPTIMIZATION_TABLE = [
  'Blood-like build',
  'Camouflage',
  'Tools',
  'Protocol',
  'Databases',
  'Language',
  'Power',
  'Weaponry',
  'Protection',
  'Transportation',
  'Satellites'
] as const;

/** Droid Construct Inspiration — what has happened to it since creation. */
export const DROID_HISTORY_TABLE = [
  'Re-fitted',
  'Re-purposed',
  'Broken',
  'Outer shell removed',
  'Nanite blistering',
  'Nothing',
  'Re-programmed',
  'Hacked'
] as const;

/** Holid Construct Inspiration — what the holid's original purpose was. */
export const HOLID_PURPOSE_TABLE = [
  'Preacher',
  'Teacher',
  'Doctor',
  'Guard',
  'Librarian',
  'Host',
  'Journalist',
  'Monitor',
  'Psychologist',
  'Clerk',
  'Dancer'
] as const;

/** Holid Construct Inspiration — how the transformation into holid has affected it. */
export const HOLID_TRANSFORM_TABLE = [
  'No additional effect',
  'Hates previous tasks',
  'Existentialist angst',
  'Wants to learn friendship and love',
  'Extremely emotional',
  'Deep need for artistic expression',
  'Obsessed with HoloH',
  'Superior towards other life-forms',
  'Deeply religious',
  'Wants to become biologic'
] as const;

/** Roll an index into a table — 0-based. */
export function rollTableIndex(tableLength: number): number {
  return Math.floor(Math.random() * tableLength);
}

/** Convenience: roll + return entry from any of the above. */
export function rollFrom<T extends readonly string[]>(table: T): T[number] {
  return table[rollTableIndex(table.length)];
}

/** Tank Born appearance lookup — returns the descriptor or empty when capped
 *  stack isn't set yet. */
export function tankBornAppearance(capped: PrimaryStack | undefined): string {
  if (!capped) return '';
  return TANK_BORN_APPEARANCE[capped as 'archive' | 'bulk' | 'morph'] ?? '';
}

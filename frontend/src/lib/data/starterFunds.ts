/**
 * starterFunds.ts - Starting Parts table by life-form (rules/23).
 *
 * Roll d6 once. Free starter picks (up to 5 items, ≤ 100 P each) come
 * BEFORE these funds — funds buy everything else.
 */

import type { LifeForm } from '$lib/models/Enums';

/** d6 → P, indexed by life-form group. */
export const STARTING_PARTS: Record<'blood' | 'alien' | 'tank_born' | 'construct', number[]> = {
  blood: [50, 100, 150, 200, 250, 300],
  alien: [25, 50, 75, 100, 125, 150],
  tank_born: [50, 80, 110, 140, 170, 200],
  construct: [75, 100, 125, 150, 175, 200]
};

/** Group used to look up the d6 row. */
export function lifeFormGroup(lf: LifeForm): keyof typeof STARTING_PARTS {
  switch (lf) {
    case 'palp_alien':
    case 'amphibious_alien':
      return 'alien';
    case 'tank_born':
      return 'tank_born';
    case 'droid':
    case 'holid':
      return 'construct';
    default:
      return 'blood';
  }
}

/** Look up starter Parts given a d6 roll (1-6) and life-form. */
export function startingPartsFor(lf: LifeForm, roll: number): number {
  const group = lifeFormGroup(lf);
  const idx = Math.max(1, Math.min(6, roll)) - 1;
  return STARTING_PARTS[group][idx];
}

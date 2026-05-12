/**
 * weapons.ts - Full weapon table from rules/29.
 *
 * Two-handed versions step damage up once and add +1 slot.
 * Energy weapons use 1 e as a clip (2 e two-handed; 3+ stationary).
 */

import type { ConstructionKit, DamageDie, DamageType, WeaponRange } from '$lib/models/Enums';

export interface WeaponDef {
  id: string;
  name: string;
  damage: DamageDie;
  damageType: DamageType;
  slots: number;
  range: WeaponRange;
  clip?: number;
  cost: number; // Parts
  kit: ConstructionKit;
  specials: string[];
  notes?: string;
}

/**
 * Returns a player-facing warning when the weapon imposes a penalty on this
 * type (rules/18), or null if clean.
 *   - Apt: heavy weapons (≥3 slots) cap Ranged at 3 unless using a stack-roll
 *     stationary device.
 *   - Core: weapons using more than 1 slot impose half rolls.
 *   - Prime: no restriction.
 */
export function weaponWarningForType(weapon: WeaponDef, type: 'apt' | 'core' | 'prime'): string | null {
  if (type === 'prime') return null;
  if (type === 'apt' && weapon.slots >= 3) {
    return 'Heavy weapon (≥3 slots) — Apt caps usable Ranged at 3.';
  }
  if (type === 'core' && weapon.slots > 1) {
    return 'Weapon uses >1 slot — Core rolls half rolls with it.';
  }
  return null;
}

export const WEAPONS_DATA: WeaponDef[] = [
  {
    id: 'blade',
    name: 'Blade',
    damage: 'd6',
    damageType: 'slashing',
    slots: 1,
    range: 'melee',
    cost: 50,
    kit: 'W',
    specials: []
  },
  {
    id: 'blowpipe',
    name: 'Blowpipe',
    damage: 'd3',
    damageType: 'piercing',
    slots: 1,
    range: 'room',
    clip: 1,
    cost: 10,
    kit: 'W',
    specials: ['Poison']
  },
  {
    id: 'bludgeon',
    name: 'Bludgeon',
    damage: 'd4',
    damageType: 'bludgeoning',
    slots: 1,
    range: 'melee',
    cost: 5,
    kit: 'W',
    specials: ['Can deal non-injuring damage']
  },
  {
    id: 'bola_net',
    name: 'Bola, Net',
    damage: 'special',
    damageType: 'bludgeoning',
    slots: 1,
    range: 'room',
    clip: 1,
    cost: 15,
    kit: 'W',
    specials: ['Snare']
  },
  {
    id: 'chuka_stick',
    name: 'Chuka Stick',
    damage: 'd4',
    damageType: 'bludgeoning',
    slots: 1,
    range: 'melee',
    cost: 30,
    kit: 'W',
    specials: ['Shields don\'t work']
  },
  {
    id: 'crossbow_bow',
    name: 'Crossbow / Bow',
    damage: 'd6',
    damageType: 'piercing',
    slots: 2,
    range: 'long_range',
    clip: 1,
    cost: 60,
    kit: 'W',
    specials: ['Silent']
  },
  {
    id: 'fascine',
    name: 'Fascine',
    damage: 'd4',
    damageType: 'slashing',
    slots: 0.5,
    range: 'room',
    cost: 7,
    kit: 'W',
    specials: ['Concealable']
  },
  {
    id: 'grenade',
    name: 'Grenade',
    damage: 'd8',
    damageType: 'varies',
    slots: 0.5,
    range: 'room',
    clip: 1,
    cost: 10,
    kit: 'B',
    specials: ['Timer']
  },
  {
    id: 'jitte',
    name: 'Jitte',
    damage: 'd4',
    damageType: 'slashing',
    slots: 0.5,
    range: 'melee',
    cost: 10,
    kit: 'W',
    specials: ['Disarm']
  },
  {
    id: 'kin_gun',
    name: 'Kin-Gun',
    damage: 'd6',
    damageType: 'kinetic',
    slots: 0.5,
    range: 'range',
    clip: 5,
    cost: 50,
    kit: 'W',
    specials: ['Burst', 'Full Auto', 'Silencer']
  },
  {
    id: 'gauss_gun',
    name: 'Gauss Gun',
    damage: 'd8',
    damageType: 'energy',
    slots: 1,
    range: 'long_range',
    clip: 5,
    cost: 800,
    kit: 'B',
    specials: []
  },
  {
    id: 'maser_gun',
    name: 'Maser Gun',
    damage: 'd6',
    damageType: 'energy',
    slots: 2,
    range: 'range',
    clip: 5,
    cost: 1200,
    kit: 'B',
    specials: ['Always silent']
  },
  {
    id: 'nano_edged_blade',
    name: 'Nano-edged Blade',
    damage: 'd10',
    damageType: 'slashing',
    slots: 1,
    range: 'melee',
    cost: 1000,
    kit: 'M',
    specials: ['Reach (only 2h form)'],
    notes: 'Slashing + piercing. Buildable only with a Maker.'
  },
  {
    id: 'palm_gun',
    name: 'Palm Gun',
    damage: 'd4',
    damageType: 'kinetic',
    slots: 0.5,
    range: 'room',
    clip: 2,
    cost: 40,
    kit: 'W',
    specials: ['Concealable']
  },
  {
    id: 'plasma_gun',
    name: 'Plasma Gun',
    damage: 'd8',
    damageType: 'energy',
    slots: 1,
    range: 'long_range',
    clip: 7,
    cost: 700,
    kit: 'B',
    specials: []
  },
  {
    id: 'pulse_gun',
    name: 'Pulse Gun',
    damage: 'd8',
    damageType: 'energy',
    slots: 1,
    range: 'long_range',
    clip: 7,
    cost: 900,
    kit: 'B',
    specials: ['Burst']
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 'd6',
    damageType: 'kinetic',
    slots: 2,
    range: 'range',
    clip: 5,
    cost: 60,
    kit: 'W',
    specials: ['Close up', 'Burst']
  },
  {
    id: 'sound_gun',
    name: 'Sound Gun',
    damage: 'd6',
    damageType: 'non-injuring',
    slots: 1,
    range: 'room',
    clip: 5,
    cost: 600,
    kit: 'B',
    specials: ['Non-Injuring']
  },
  {
    id: 'spear',
    name: 'Spear',
    damage: 'd6',
    damageType: 'piercing',
    slots: 2,
    range: 'range',
    clip: 1,
    cost: 10,
    kit: 'W',
    specials: ['Reach', 'Use as Staff']
  },
  {
    id: 'stave',
    name: 'Stave',
    damage: 'd4',
    damageType: 'bludgeoning',
    slots: 2,
    range: 'melee',
    cost: 7,
    kit: 'W',
    specials: []
  },
  {
    id: 'unarmed',
    name: 'Unarmed',
    damage: 'd4',
    damageType: 'bludgeoning',
    slots: 0,
    range: 'melee',
    cost: 0,
    kit: 'W',
    specials: []
  }
];

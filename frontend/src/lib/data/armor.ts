/**
 * armor.ts - Full armor table from rules/29.
 *
 * "Above Force Armor" in source = lighter rows above it in the table.
 * Apt and Core may wear Force Armor or LIGHTER (no penalty).
 * Prime may wear all armors including § heavies.
 */

import type { ConstructionKit } from '$lib/models/Enums';

export interface ArmorDef {
  id: string;
  name: string;
  notes: string;
  strength: string;
  weakness: string;
  slots: number;
  cost: number; // Parts; 0 if non-buyable
  kit?: ConstructionKit;
  /** True if § Prime-only (heavy) — Apt/Core lose abilities if worn. */
  primeOnly: boolean;
  isShield?: boolean;
  isHelmet?: boolean;
  /** "above Force Armor" rank — 1 (lightest) to 12 (heaviest). */
  weightRank: number;
}

export const ARMOR_DATA: ArmorDef[] = [
  {
    id: 'shield',
    name: 'Shield',
    notes: 'Design varies',
    strength: 'As per material',
    weakness: 'As per material',
    slots: 0.5,
    cost: 50,
    kit: 'A',
    primeOnly: false,
    isShield: true,
    weightRank: 1
  },
  {
    id: 'helmet',
    name: 'Helmet',
    notes: 'Info display common',
    strength: 'Avoids the extra crit ed6',
    weakness: '',
    slots: 0.5,
    cost: 50,
    kit: 'A',
    primeOnly: false,
    isHelmet: true,
    weightRank: 2
  },
  {
    id: 'leather',
    name: 'Leather',
    notes: 'Hardened',
    strength: 'Bludgeoning',
    weakness: 'Energy',
    slots: 3,
    cost: 80,
    kit: 'A',
    primeOnly: false,
    weightRank: 3
  },
  {
    id: 'aramid',
    name: 'Aramid',
    notes: 'Synthetic fiber',
    strength: 'Kinetic',
    weakness: 'Slashing',
    slots: 1,
    cost: 100,
    kit: 'A',
    primeOnly: false,
    weightRank: 4
  },
  {
    id: 'force_armor',
    name: 'Force Armor',
    notes: 'Belt or harness',
    strength: 'Energy',
    weakness: 'Bludgeoning, Slashing',
    slots: 0.5,
    cost: 200,
    kit: 'B',
    primeOnly: false,
    weightRank: 5
  },
  {
    id: 'implant_armor',
    name: 'Implant Armor',
    notes: 'Secretes and hardens',
    strength: 'Energy, Kinetic',
    weakness: 'Bludgeoning',
    slots: 0,
    cost: 12000,
    kit: 'M',
    primeOnly: true,
    weightRank: 6
  },
  {
    id: 'shellock_plate',
    name: 'Shellock Plate',
    notes: 'Any color',
    strength: 'Slashing',
    weakness: 'Energy, Bludgeoning',
    slots: 5,
    cost: 140,
    kit: 'A',
    primeOnly: true,
    weightRank: 7
  },
  {
    id: 'tank_cuirass',
    name: 'Tank Cuirass',
    notes: 'Bulky frontanium',
    strength: '—',
    weakness: '—',
    slots: 9,
    cost: 300,
    kit: 'A',
    primeOnly: true,
    weightRank: 8
  },
  {
    id: 'worm_hide',
    name: 'Worm Hide',
    notes: 'Very thick and tough',
    strength: 'Kinetic, Bludgeoning',
    weakness: 'Energy',
    slots: 3,
    cost: 1000,
    kit: 'A',
    primeOnly: true,
    weightRank: 9
  },
  {
    id: 'battle_suit',
    name: 'Battle Suit',
    notes: 'Small exo [2e/day]',
    strength: 'All except EMP',
    weakness: 'EMP',
    slots: 7,
    cost: 8000,
    kit: 'M',
    primeOnly: true,
    weightRank: 10
  },
  {
    id: 'shadow_armor',
    name: 'Shadow Armor',
    notes: 'Parasitic, necrotic',
    strength: 'All except weakness',
    weakness: 'Unknown. Possibly Æonic',
    slots: 3,
    cost: 0,
    primeOnly: true,
    weightRank: 11
  },
  {
    id: 'aeonic_plate',
    name: 'Æonic Plate',
    notes: 'Hard and fluid at the same time',
    strength: 'All except weakness',
    weakness: 'Unknown. Possibly Shadow',
    slots: 5,
    cost: 0,
    primeOnly: true,
    weightRank: 12
  }
];

/**
 * Apt and Core may wear Force Armor or lighter (rank ≤ 5) without losing abilities.
 * Prime may wear any armor.
 */
export function armorAllowedForType(armor: ArmorDef, type: 'apt' | 'core' | 'prime'): boolean {
  if (type === 'prime') return true;
  return !armor.primeOnly && armor.weightRank <= 5;
}

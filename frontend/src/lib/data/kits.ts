/**
 * kits.ts - Construction kits (rules/24).
 *
 * Each kit is required to build certain items in the field. A "Maker" (M) is
 * a manufacturing apparatus, not a portable kit — items marked M cannot be
 * field-built.
 */

import type { ConstructionKit } from '$lib/models/Enums';

export interface KitDef {
  id: ConstructionKit;
  name: string;
  slots: number; // ½ = 0.5
  cost: number; // Parts; − for not buyable
  buildableWithKit: ConstructionKit | null; // What kit you need to build THIS kit
  notes?: string;
}

export const KITS_DATA: KitDef[] = [
  { id: 'A', name: 'Armor', slots: 0.5, cost: 20, buildableWithKit: 'G' },
  { id: 'B', name: 'Blueprint', slots: 0.5, cost: 0, buildableWithKit: null, notes: 'Found, not bought.' },
  { id: 'C', name: 'Chemical', slots: 0.5, cost: 90, buildableWithKit: 'B' },
  { id: 'E', name: 'Explosives', slots: 0.5, cost: 110, buildableWithKit: 'E' },
  { id: 'G', name: 'General', slots: 0.5, cost: 10, buildableWithKit: 'G' },
  { id: 'T', name: 'Tools', slots: 0.5, cost: 40, buildableWithKit: 'G' },
  { id: 'W', name: 'Weapons', slots: 0.5, cost: 75, buildableWithKit: 'B' },
  { id: 'M', name: 'Maker', slots: 0, cost: 0, buildableWithKit: null, notes: 'Stationary apparatus, not portable.' }
];

/**
 * implants.ts - Basic implant catalogue (rules/24).
 *
 * Implants are normally an in-play acquisition, but Apt characters get
 * Implants 1 at origo and may pre-install one via Artistic Modification.
 *
 * Cost multipliers by life-form:
 *   Blood / Construct → ×1
 *   Tank Born → ×1.5
 *   Alien → ×2
 * Each bonus increment doubles total cost (e.g. +3 = ×4 base price * lifeform).
 */

export interface ImplantDef {
  id: string;
  bodyPart: 'head' | 'body' | 'leg' | 'arm' | 'hand' | 'eye';
  benefit: string;        // Display label (e.g. "+1 A/G/M/S/T")
  baseCost: number;       // Parts (×1 blood)
  /** Construction kit needed (Maker for all basic implants). */
  kit: 'M';
  /** True if the benefit is a keyword slot, ‡ if a resistance. */
  isKeyword?: boolean;
  isResistance?: boolean;
}

export const IMPLANTS_DATA: ImplantDef[] = [
  // Head
  { id: 'head_attr', bodyPart: 'head', benefit: '+1 Archive / Ghost / Morph / Speed / Tech', baseCost: 500, kit: 'M' },
  { id: 'head_keyword', bodyPart: 'head', benefit: 'Keyword (subset of regular)', baseCost: 500, kit: 'M', isKeyword: true },
  { id: 'head_resist', bodyPart: 'head', benefit: 'Resistance (Mental / Fear / Sound / Death)', baseCost: 500, kit: 'M', isResistance: true },
  // Body
  { id: 'body_attr', bodyPart: 'body', benefit: '+1 Bulk / Ghost / Close', baseCost: 300, kit: 'M' },
  { id: 'body_resist', bodyPart: 'body', benefit: 'Resistance (Heat / Cold / Energy / Poison / Disease / Radiation)', baseCost: 300, kit: 'M', isResistance: true },
  // Leg
  { id: 'leg_attr', bodyPart: 'leg', benefit: '+1 Bulk / Speed / Close', baseCost: 300, kit: 'M' },
  // Arm
  { id: 'arm_attr', bodyPart: 'arm', benefit: '+1 Bulk / Speed / Close', baseCost: 300, kit: 'M' },
  // Hand
  { id: 'hand_attr', bodyPart: 'hand', benefit: '+1 Bulk / Tech / Speed / Ranged', baseCost: 300, kit: 'M' },
  { id: 'hand_keyword', bodyPart: 'hand', benefit: 'Keyword (subset)', baseCost: 300, kit: 'M', isKeyword: true },
  // Eye
  { id: 'eye_attr', bodyPart: 'eye', benefit: '+1 Archive / Morph / Tech / Ranged', baseCost: 300, kit: 'M' },
  { id: 'eye_keyword', bodyPart: 'eye', benefit: 'Keyword (subset)', baseCost: 300, kit: 'M', isKeyword: true },
  { id: 'eye_resist', bodyPart: 'eye', benefit: 'Resistance (Light)', baseCost: 300, kit: 'M', isResistance: true }
];

/**
 * Compute final implant cost given life-form multiplier and bonus increment.
 * +1 = ×1, +2 = ×2, +3 = ×4, +4 = ×8 ... (each step doubles).
 */
export function implantCost(baseCost: number, lifeFormMult: number, bonusLevel: number): number {
  const stepMult = Math.max(1, Math.pow(2, Math.max(0, bonusLevel - 1)));
  return Math.round(baseCost * lifeFormMult * stepMult);
}

export const LIFEFORM_IMPLANT_MULT: Record<'blood' | 'construct' | 'tank_born' | 'alien', number> = {
  blood: 1,
  construct: 1,
  tank_born: 1.5,
  alien: 2
};

/**
 * computed.ts - Derived SW character stats.
 *
 * Pure functions over SWCharacter. Used by the sheet view, the wizard
 * progress panel, and the equipment editor.
 */

import type {
  SWCharacter,
  StackScores,
  EquipmentItem,
  CharacterWeapon,
  CharacterArmor,
  StackComposition
} from '$lib/models/SWCharacter';
import { BASE_EQUIPMENT_SLOTS, BACKPACK_BONUS_SLOTS, sumComposition } from '$lib/models/SWCharacter';
import type { Stack } from '$lib/models/Enums';
import { ALL_STACKS } from '$lib/models/Enums';
import { getBackground } from '$lib/data/backgrounds';
import { getLifeForm } from '$lib/data/lifeforms';

// ============================================
// FINAL STACK SCORES
// ============================================
//
// `applyBonuses` takes raw stack rolls + a player's distribution of
// life-form +2/+1 bonuses + the character's background and produces the
// final StackScores including Close/Ranged origo. The wizard calls this
// once the player has confirmed each step.

import type { LifeForm, PrimaryStack } from '$lib/models/Enums';
import { PRIMARY_STACKS } from '$lib/models/Enums';

/** Sum of bonuses each background contributes to a primary stack. */
export function backgroundPrimaryBonus(c: SWCharacter, stack: Stack): number {
  const bg = getBackground(c.background);
  if (stack === 'close') return bg.closeBonus;
  if (stack === 'ranged') return bg.rangedBonus;
  return bg.primaryBonuses[stack as keyof typeof bg.primaryBonuses] ?? 0;
}

/** A distribution of life-form bonus points across primary stacks. */
export interface LifeFormBonusDistribution {
  /** Stacks that get +2 (length must equal life-form's plus2Count). */
  plus2: PrimaryStack[];
  /** Stacks that get +1 (length must equal life-form's plus1Count). */
  plus1: PrimaryStack[];
  /** For Tank Born: which stack is set/cap'd at 8. */
  capped?: PrimaryStack;
  /** For Tank Born + Apt: which combat stack got the bonus. */
  combatPick?: 'close' | 'ranged';
}

/**
 * Build the final StackScores from raw rolls + distributions + background +
 * type origo. Pure function — does not mutate.
 */
export function applyBonuses(opts: {
  raw: Partial<Record<PrimaryStack, number>>;
  type: 'apt' | 'core' | 'prime';
  lifeForm: LifeForm;
  background: import('$lib/models/Enums').Background;
  /** Player's life-form bonus distribution. */
  distribution: LifeFormBonusDistribution;
}): StackScores {
  const { raw, type, lifeForm, background, distribution } = opts;
  const lf = getLifeForm(lifeForm);
  const bg = getBackground(background);

  // Start from raw rolls.
  const out: StackScores = {
    archive: raw.archive ?? 0,
    bulk: raw.bulk ?? 0,
    ghost: raw.ghost ?? 0,
    morph: raw.morph ?? 0,
    speed: raw.speed ?? 0,
    tech: raw.tech ?? 0,
    close: 0,
    ranged: 0
  };

  // 1. Life-form set/cap (Droid Tech 8 & Ghost 3, Holid Archive 7 & Ghost 4,
  //    Tank Born picks one).
  if (lf.stackSets) {
    for (const [stack, value] of Object.entries(lf.stackSets)) {
      if (value !== undefined) {
        out[stack as PrimaryStack] = value as number;
      }
    }
  }
  if (lf.pickCapStack && distribution.capped) {
    out[distribution.capped] = lf.capValue ?? 8;
  }

  // 2. Life-form +2 distribution.
  for (const s of distribution.plus2) {
    // Don't bump capped/set stacks — they are gated.
    if (lf.pickCapStack && distribution.capped === s) continue;
    if (lf.stackSets && lf.stackSets[s as keyof typeof lf.stackSets] !== undefined) continue;
    out[s] += 2;
  }

  // 3. Life-form +1 distribution.
  for (const s of distribution.plus1) {
    if (lf.pickCapStack && distribution.capped === s) continue;
    if (lf.stackSets && lf.stackSets[s as keyof typeof lf.stackSets] !== undefined) continue;
    out[s] += 1;
  }

  // 4. Background primary bonuses.
  for (const s of PRIMARY_STACKS) {
    out[s] += bg.primaryBonuses[s] ?? 0;
  }

  // 5. Type origo for Close/Ranged.
  if (type === 'apt') {
    out.close = distribution.combatPick === 'close' ? 1 : 0;
    out.ranged = distribution.combatPick === 'ranged' ? 1 : 0;
  } else if (type === 'core') {
    out.close = 0;
    out.ranged = 0;
  } else {
    // prime
    out.close = 1;
    out.ranged = 1;
  }

  // 6. Life-form combat bonuses.
  if (lf.combatBonusMode === 'both') {
    out.close += lf.closeBonus;
    out.ranged += lf.rangedBonus;
  } else if (lf.combatBonusMode === 'either') {
    // Tank Born picks one.
    if (distribution.combatPick === 'close') {
      out.close += 2;
    } else if (distribution.combatPick === 'ranged') {
      out.ranged += 2;
    }
  }

  // 7. Background combat bonuses.
  out.close += bg.closeBonus;
  out.ranged += bg.rangedBonus;

  return out;
}

/**
 * Same inputs as `applyBonuses` but returns a full per-stack composition
 * — base / lifeFormBonus / backgroundBonus / implantBonus / other — so the
 * wizard can attribute each contribution. The implantBonus + other slots
 * are zeroed (the wizard may set them later); base carries the rolled
 * value and (for combat stacks) the type-origo seed.
 */
export function applyBonusesComposed(opts: {
  raw: Partial<Record<PrimaryStack, number>>;
  type: 'apt' | 'core' | 'prime';
  lifeForm: LifeForm;
  background: import('$lib/models/Enums').Background;
  distribution: LifeFormBonusDistribution;
}): Record<Stack, StackComposition> {
  const { raw, type, lifeForm, background, distribution } = opts;
  const lf = getLifeForm(lifeForm);
  const bg = getBackground(background);

  function makeSlot(base: number): StackComposition {
    return { base, lifeFormBonus: 0, backgroundBonus: 0, implantBonus: 0, other: 0, final: base };
  }

  const composition: Record<Stack, StackComposition> = {
    archive: makeSlot(raw.archive ?? 0),
    bulk: makeSlot(raw.bulk ?? 0),
    ghost: makeSlot(raw.ghost ?? 0),
    morph: makeSlot(raw.morph ?? 0),
    speed: makeSlot(raw.speed ?? 0),
    tech: makeSlot(raw.tech ?? 0),
    close: makeSlot(0),
    ranged: makeSlot(0)
  };

  // 1. Life-form set/cap → set/cap stacks. We stuff the cap value into `other`
  //    so base still reflects the player's roll. The composition then sums
  //    to the cap regardless of base.
  if (lf.stackSets) {
    for (const [stack, value] of Object.entries(lf.stackSets)) {
      if (value !== undefined) {
        const k = stack as PrimaryStack;
        const target = value as number;
        composition[k].other = target - composition[k].base;
      }
    }
  }
  if (lf.pickCapStack && distribution.capped) {
    const k = distribution.capped;
    const target = lf.capValue ?? 8;
    composition[k].other = target - composition[k].base;
  }

  // 2 + 3. Life-form +2 / +1 distribution.
  for (const s of distribution.plus2) {
    if (lf.pickCapStack && distribution.capped === s) continue;
    if (lf.stackSets && lf.stackSets[s as keyof typeof lf.stackSets] !== undefined) continue;
    composition[s].lifeFormBonus += 2;
  }
  for (const s of distribution.plus1) {
    if (lf.pickCapStack && distribution.capped === s) continue;
    if (lf.stackSets && lf.stackSets[s as keyof typeof lf.stackSets] !== undefined) continue;
    composition[s].lifeFormBonus += 1;
  }

  // 4. Background primary bonuses.
  for (const s of PRIMARY_STACKS) {
    composition[s].backgroundBonus += bg.primaryBonuses[s] ?? 0;
  }

  // 5. Type origo for Close/Ranged → carry on `base`, since this is the
  //    intrinsic starting value before any class-specific bonuses.
  if (type === 'apt') {
    composition.close.base = distribution.combatPick === 'close' ? 1 : 0;
    composition.ranged.base = distribution.combatPick === 'ranged' ? 1 : 0;
  } else if (type === 'core') {
    composition.close.base = 0;
    composition.ranged.base = 0;
  } else {
    // prime
    composition.close.base = 1;
    composition.ranged.base = 1;
  }

  // 6. Life-form combat bonuses.
  if (lf.combatBonusMode === 'both') {
    composition.close.lifeFormBonus += lf.closeBonus;
    composition.ranged.lifeFormBonus += lf.rangedBonus;
  } else if (lf.combatBonusMode === 'either') {
    if (distribution.combatPick === 'close') {
      composition.close.lifeFormBonus += 2;
    } else if (distribution.combatPick === 'ranged') {
      composition.ranged.lifeFormBonus += 2;
    }
  }

  // 7. Background combat bonuses.
  composition.close.backgroundBonus += bg.closeBonus;
  composition.ranged.backgroundBonus += bg.rangedBonus;

  // Final cache.
  for (const k of ALL_STACKS) {
    composition[k].final = sumComposition(composition[k]);
  }
  return composition;
}

// ============================================
// EQUIPMENT SLOTS
// ============================================

/** Total equipment slots: base 10 + (backpack ? +5 : 0) + Carry formula etc. */
export function totalSlots(c: SWCharacter): number {
  const hasBackpack = c.inventory.some(
    (i) => i.location === 'slot10' && /backpack|valise/i.test(i.name)
  );
  return BASE_EQUIPMENT_SLOTS + (hasBackpack ? BACKPACK_BONUS_SLOTS : 0);
}

/** Slot count of carried items (worn + slot10 + backpack). */
export function usedSlots(c: SWCharacter): number {
  let used = 0;
  for (const item of c.inventory) {
    if (
      item.location === 'worn' ||
      item.location === 'slot10' ||
      item.location === 'backpack' ||
      item.location === 'mission'
    ) {
      used += item.slots;
    }
  }
  for (const w of c.weapons) {
    if (w.equipped) used += w.slots;
  }
  for (const a of c.armor) {
    if (a.equipped) used += a.slots;
  }
  return used;
}

/** True if the character is overloaded. */
export function isOverloaded(c: SWCharacter): boolean {
  return usedSlots(c) > totalSlots(c);
}

/** Encumbrance status: ok | overloaded | severely_overloaded (over slots by > Bulk). */
export function encumbranceStatus(c: SWCharacter): 'ok' | 'overloaded' | 'severely_overloaded' {
  const used = usedSlots(c);
  const cap = totalSlots(c);
  if (used <= cap) return 'ok';
  const excess = used - cap;
  if (excess > c.stacks.bulk) return 'severely_overloaded';
  return 'overloaded';
}

// ============================================
// AMMO
// ============================================

/** Ammunition total: loaded + spare. */
export function ammoTotal(w: CharacterWeapon | EquipmentItem): number {
  const loaded = (w as CharacterWeapon).ammoLoaded ?? (w as EquipmentItem).ammoLoaded ?? 0;
  const spare = (w as CharacterWeapon).ammoSpare ?? (w as EquipmentItem).ammoSpare ?? 0;
  return loaded + spare;
}

// ============================================
// MONEY
// ============================================

/** Total Parts equivalent: 1 E = 10 P; energy packs are NOT money. */
export function totalCashInParts(c: SWCharacter): number {
  return c.purse.parts + c.purse.eCredits * 10;
}

// ============================================
// HARM
// ============================================

/** Returns true if at the harm cap (downed). */
export function isHarmCap(c: SWCharacter): boolean {
  return c.harm.harmTaken >= c.harm.harmCap;
}

/** Returns true if at the nanite cap (comatose). */
export function isNaniteCap(c: SWCharacter): boolean {
  return c.harm.naniteTaken >= c.harm.naniteCap;
}

// ============================================
// HARM STATE MACHINE  (rules/46, 50, 51)
// ============================================
//
// Pure helpers — they receive the character + a delta and RETURN a patched
// HarmTrackers object. Callers (UI handlers) are responsible for assigning
// the patch back to character.harm. Keeping it pure makes the rules easy
// to test and reason about.

import type { HarmTrackers } from '$lib/models/SWCharacter';

/** End-roll DN per rules/46:24 — max(physical, nanite). */
export function endRollDN(h: HarmTrackers): number {
  return Math.max(h.harmTaken, h.naniteTaken);
}

/** True when an end roll is required: physical harm has exceeded Bulk
 *  (rules/46:24-26). Nanite harm doesn't trigger by itself. */
export function isEndRollRequired(h: HarmTrackers, bulk: number): boolean {
  return h.harmTaken > bulk;
}

/** Suspend is legal only while physical harm < 20 (rules/46:30). */
export function canSuspend(h: HarmTrackers): boolean {
  return h.harmTaken < h.harmCap;
}

/** True at the forced-roll point (physical harm = 20). No suspend allowed. */
export function isForcedRoll(h: HarmTrackers): boolean {
  return h.harmTaken >= h.harmCap;
}

/**
 * Apply physical damage. Pure — returns a patched HarmTrackers.
 * Caps at 20 (rules/46:3). Recomputes status:
 *   - clean → harmed (1..bulk)
 *   - harmed → at-risk (> bulk)
 *   - at-risk stays at-risk (or forced-roll at 20)
 *   - already injured-ko / dying / dead are NOT regressed by new damage —
 *     they need their own resolution flow.
 */
export function applyPhysicalHarm(c: SWCharacter, dmg: number): HarmTrackers {
  const h = { ...c.harm };
  const bulk = c.stacks.bulk;
  if (dmg <= 0) return h;
  // No-op if already terminal.
  if (h.status === 'dead') return h;
  h.harmTaken = Math.min(h.harmTaken + dmg, h.harmCap);
  if (h.status === 'dying' || h.status === 'injured-ko' || h.status === 'comatose') {
    return h; // status unchanged by raw damage in these states
  }
  if (h.harmTaken >= h.harmCap) {
    // Forced roll — kills any active suspend.
    h.status = 'at-risk';
    h.endRollSuspended = false;
  } else if (h.harmTaken > bulk) {
    h.status = h.endRollSuspended ? 'suspended' : 'at-risk';
  } else if (h.harmTaken > 0) {
    h.status = 'harmed';
  }
  return h;
}

/**
 * Apply nanite cost. Pure — returns a patched HarmTrackers.
 * At the cap (rules/50:36) the character goes comatose. ed6 days needs an
 * actual roll — caller passes it in (keeps this pure).
 */
export function applyNaniteHarm(c: SWCharacter, cost: number, comaDaysIfMaxed?: number): HarmTrackers {
  const h = { ...c.harm };
  if (cost <= 0) return h;
  if (h.status === 'dead' || h.status === 'comatose') return h;
  h.naniteTaken = Math.min(h.naniteTaken + cost, h.naniteCap);
  if (h.naniteTaken >= h.naniteCap) {
    h.status = 'comatose';
    h.comaDays = comaDaysIfMaxed ?? null;
  }
  return h;
}

/** Heal physical harm by N (clamped to 0). Pure. */
export function healPhysicalHarm(c: SWCharacter, amount: number): HarmTrackers {
  const h = { ...c.harm };
  h.harmTaken = Math.max(0, h.harmTaken - amount);
  if (h.status !== 'dying' && h.status !== 'injured-ko' && h.status !== 'comatose' && h.status !== 'dead') {
    if (h.harmTaken === 0 && h.naniteTaken === 0) h.status = 'clean';
    else if (h.harmTaken > 0 && h.harmTaken <= c.stacks.bulk) h.status = 'harmed';
  }
  return h;
}

/** Heal nanite harm by N (clamped to 0). Pure. */
export function healNaniteHarm(c: SWCharacter, amount: number): HarmTrackers {
  const h = { ...c.harm };
  h.naniteTaken = Math.max(0, h.naniteTaken - amount);
  if (h.status === 'comatose' && h.naniteTaken < h.naniteCap) {
    h.status = h.harmTaken === 0 ? 'clean' : 'harmed';
    h.comaDays = null;
  }
  return h;
}

/** End-roll passed (rules/46:28). All physical harm clears; nanite stays. */
export function endRollPass(c: SWCharacter): HarmTrackers {
  const h = { ...c.harm };
  h.harmTaken = 0;
  h.endRollSuspended = false;
  h.suspendedAtHarm = 0;
  h.status = h.naniteTaken > 0 ? 'harmed' : 'clean';
  return h;
}

/**
 * End-roll failed (rules/46:29 + rules/50). Branches by harm level:
 *   - < 20 → injured-ko (but a True Grit Ghost roll comes next)
 *   - = 20 → dying (start hidden d20 timer; Prime gets minutes)
 */
export function endRollFail(c: SWCharacter, dyingTimerD20?: number): HarmTrackers {
  const h = { ...c.harm };
  h.endRollSuspended = false;
  if (h.harmTaken >= h.harmCap) {
    h.status = 'dying';
    h.dyingTimer = dyingTimerD20 ?? null;
    h.dyingTimerUnit = c.type === 'prime' ? 'minute' : 'round';
  } else {
    h.status = 'injured-ko';
  }
  return h;
}

/** Suspend the pending end roll (rules/46:30). */
export function suspendEndRoll(c: SWCharacter): HarmTrackers {
  const h = { ...c.harm };
  if (!canSuspend(h)) return h;
  h.endRollSuspended = true;
  h.suspendedAtHarm = h.harmTaken;
  h.status = 'suspended';
  return h;
}

/** Reset everything to clean (long-rest, GM override, etc.). */
export function resetHarm(c: SWCharacter): HarmTrackers {
  return {
    ...c.harm,
    harmTaken: 0,
    naniteTaken: 0,
    status: 'clean',
    endRollSuspended: false,
    suspendedAtHarm: 0,
    dyingTimer: null,
    dyingTimerUnit: null,
    bleeding: false,
    bloodShed: 0,
    comaDays: null,
    shiftUpPenalty: false
  };
}

/** Friendly status label + color hint for the badge. */
export function statusBadge(status: HarmTrackers['status']): { label: string; tone: 'ok' | 'warn' | 'danger' | 'critical' } {
  switch (status) {
    case 'clean':       return { label: 'Clean',       tone: 'ok' };
    case 'harmed':      return { label: 'Harmed',      tone: 'warn' };
    case 'at-risk':     return { label: 'At risk',     tone: 'danger' };
    case 'suspended':   return { label: 'Suspended',   tone: 'danger' };
    case 'injured-ko':  return { label: 'Injured · KO', tone: 'critical' };
    case 'dying':       return { label: 'Dying',       tone: 'critical' };
    case 'comatose':    return { label: 'Comatose',    tone: 'critical' };
    case 'dead':        return { label: 'Dead',        tone: 'critical' };
  }
}

// ============================================
// EQUIPPED ARMOR
// ============================================

export function equippedArmor(c: SWCharacter): CharacterArmor | undefined {
  return c.armor.find((a) => a.equipped && !a.isShield && !a.isHelmet);
}

export function equippedShield(c: SWCharacter): CharacterArmor | undefined {
  return c.armor.find((a) => a.equipped && a.isShield);
}

export function equippedHelmet(c: SWCharacter): CharacterArmor | undefined {
  return c.armor.find((a) => a.equipped && a.isHelmet);
}

// ============================================
// SUMMARY
// ============================================

export interface CharacterSummary {
  /** Display name for headers. */
  displayName: string;
  /** "Apt Blood Outrider", etc. */
  classLine: string;
  /** Final stacks after all bonuses (player-entered). */
  stacks: StackScores;
  /** Ammo grand total across all weapons. */
  totalAmmo: number;
  /** Slot count usage. */
  slotsUsed: number;
  /** Slot capacity. */
  slotsCap: number;
  /** Encumbrance status. */
  encumbrance: 'ok' | 'overloaded' | 'severely_overloaded';
  /** Cash in equivalent Parts. */
  cashInParts: number;
}

export function summarize(c: SWCharacter): CharacterSummary {
  const lf = getLifeForm(c.lifeForm);
  const bg = getBackground(c.background);
  return {
    displayName: c.name || 'Unnamed Character',
    classLine: `${capitalize(c.type)} ${lf.label} ${bg.label}`,
    stacks: c.stacks,
    totalAmmo: c.weapons.reduce((sum, w) => sum + ammoTotal(w), 0),
    slotsUsed: usedSlots(c),
    slotsCap: totalSlots(c),
    encumbrance: encumbranceStatus(c),
    cashInParts: totalCashInParts(c)
  };
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Quick lookup of every stack with its display label and value. */
export function stackEntries(c: SWCharacter): { stack: Stack; value: number }[] {
  return ALL_STACKS.map((s) => ({ stack: s, value: c.stacks[s] }));
}

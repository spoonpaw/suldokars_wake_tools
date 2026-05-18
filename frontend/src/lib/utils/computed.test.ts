import { describe, expect, it } from 'vitest';
import { createDefaultCharacter, normalizeCharacter } from '$lib/models';
import {
  ammoTotal,
  applyBonuses,
  applyBonusesComposed,
  applyNaniteHarm,
  applyPhysicalHarm,
  backgroundPrimaryBonus,
  canSuspend,
  carriedMoneySlots,
  encumbranceStatus,
  endRollDN,
  endRollFail,
  endRollPass,
  equippedArmor,
  equippedHelmet,
  equippedShield,
  formatPartsEquivalent,
  healNaniteHarm,
  healPhysicalHarm,
  isEndRollRequired,
  isForcedRoll,
  isHarmCap,
  isNaniteCap,
  isOverloaded,
  onHandCashInParts,
  resetHarm,
  stashedCashInParts,
  statusBadge,
  summarize,
  suspendEndRoll,
  totalCashInParts,
  totalSlots,
  usedSlots
} from './computed';

describe('equipment carrying state', () => {
  it('grants container capacity only while the container is equipped and not stashed', () => {
    const character = createDefaultCharacter();
    character.inventory = [
      {
        id: 'backpack',
        name: 'Backpack',
        slots: 1,
        cost: 5,
        location: 'slot10',
        equipped: true,
        stashed: false,
        isContainer: true,
        containerSlots: 5
      }
    ];

    expect(totalSlots(character)).toBe(14);
    expect(usedSlots(character)).toBe(1);

    character.inventory[0].equipped = false;
    expect(totalSlots(character)).toBe(10);
    expect(usedSlots(character)).toBe(1);

    character.inventory[0].stashed = true;
    character.inventory[0].location = 'storage';
    expect(totalSlots(character)).toBe(10);
    expect(usedSlots(character)).toBe(0);
  });

  it('counts carried weapons and armor, but ignores stashed entries', () => {
    const character = createDefaultCharacter();
    character.weapons = [
      {
        id: 'sidearm',
        name: 'Sidearm',
        damage: 'd6',
        damageType: 'kinetic',
        slots: 1,
        range: 'range',
        cost: 0,
        equipped: false,
        stashed: false
      }
    ];
    character.armor = [
      {
        id: 'jacket',
        name: 'Soft Jacket',
        slots: 2,
        cost: 0,
        equipped: false,
        stashed: false
      }
    ];

    expect(usedSlots(character)).toBe(3);

    character.weapons[0].stashed = true;
    character.armor[0].stashed = true;
    expect(usedSlots(character)).toBe(0);
  });

  it('does not treat stashed armor as equipped protection', () => {
    const character = createDefaultCharacter();
    character.armor = [
      {
        id: 'stashed-armor',
        name: 'Stashed Armor',
        slots: 2,
        cost: 0,
        equipped: true,
        stashed: true
      },
      {
        id: 'worn-armor',
        name: 'Worn Armor',
        slots: 2,
        cost: 0,
        equipped: true,
        stashed: false
      }
    ];

    expect(equippedArmor(character)?.id).toBe('worn-armor');
  });

  it('counts on-hand money as carried slots while ignoring stashed money', () => {
    const character = createDefaultCharacter();
    character.purse.parts = 11;
    character.purse.smallParts = 5;
    character.purse.energyPacks = 10;
    character.purse.energyCells = 101;
    character.purse.stashedParts = 999;
    character.purse.stashedSmallParts = 999;
    character.purse.stashedEnergyPacks = 999;
    character.purse.stashedEnergyCells = 999;

    expect(carriedMoneySlots(character.purse)).toBe(5);
    expect(usedSlots(character)).toBe(5);
  });
});

describe('harm status language', () => {
  it('uses rules-facing labels instead of clean/KO shorthand', () => {
    const character = createDefaultCharacter();
    character.stacks.bulk = 2;

    expect(character.harm.status).toBe('unharmed');
    expect(statusBadge(character.harm.status).label).toBe('Unharmed');

    character.harm = applyPhysicalHarm(character, 3);
    expect(character.harm.status).toBe('end-roll-pending');
    expect(statusBadge(character.harm.status).label).toBe('End roll pending');

    character.harm = endRollFail(character);
    expect(character.harm.status).toBe('injured-knocked-out');
    expect(statusBadge(character.harm.status).label).toBe('Injured + knocked out');

    character.harm.status = 'injured';
    expect(statusBadge(character.harm.status).label).toBe('Injured');

    character.harm.status = 'injured-knocked-down';
    expect(statusBadge(character.harm.status).label).toBe('Injured + knocked down');
  });

  it('normalizes pre-release harm status names from older local exports', () => {
    expect(normalizeCharacter({ harm: { status: 'clean' } }).harm.status).toBe('unharmed');
    expect(normalizeCharacter({ harm: { status: 'at-risk' } }).harm.status).toBe('end-roll-pending');
    expect(normalizeCharacter({ harm: { status: 'injured-ko' } }).harm.status).toBe('injured-knocked-out');
  });

  it('treats nanite-only harm as harm, not as unharmed', () => {
    const character = createDefaultCharacter();

    character.harm = applyNaniteHarm(character, 1);
    expect(character.harm.status).toBe('harmed');
    expect(statusBadge(character.harm.status).label).toBe('Harmed');

    character.harm = healNaniteHarm(character, 1);
    expect(character.harm.status).toBe('unharmed');

    character.harm = applyNaniteHarm(character, 20);
    expect(character.harm.status).toBe('comatose');
    expect(statusBadge(character.harm.status).label).toBe('Comatose');
  });

  it('keeps and clears a manual status note with the harm tracker state', () => {
    const character = createDefaultCharacter();
    character.harm.status = 'injured';
    character.harm.statusNote = 'True Grit special success';

    expect(character.harm.statusNote).toBe('True Grit special success');

    character.harm = resetHarm(character);
    expect(character.harm.status).toBe('unharmed');
    expect(character.harm.statusNote).toBe('');
  });
});

// ============================================
// applyBonuses (life-form + background math)
// ============================================

describe('applyBonuses (rules/18 + 19 stack math)', () => {
  it('Blood Enforcer: distributes +2 to 4 stacks, +1 to 2 stacks, plus background', () => {
    // Blood: 4×+2, 2×+1, +2C +2R.
    // Enforcer: bulk +2, ghost +2, close +2, ranged +2.
    const stacks = applyBonuses({
      raw: { archive: 2, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt',
      lifeForm: 'blood',
      background: 'enforcer',
      distribution: {
        plus2: ['archive', 'bulk', 'ghost', 'morph'],
        plus1: ['speed', 'tech'],
        combatPick: 'ranged' // Apt picks one combat stack to start at 1
      }
    });
    expect(stacks.archive).toBe(2 + 2); // raw 2 + lf+2
    expect(stacks.bulk).toBe(1 + 2 + 2); // raw 1 + lf+2 + bg+2
    expect(stacks.ghost).toBe(1 + 2 + 2);
    expect(stacks.morph).toBe(1 + 2);
    expect(stacks.speed).toBe(1 + 1);
    expect(stacks.tech).toBe(1 + 1);
    // Apt Ranged 1 origo + Blood +2 + Enforcer +2.
    expect(stacks.close).toBe(0 + 2 + 2);
    expect(stacks.ranged).toBe(1 + 2 + 2);
  });

  it('Apt origo grants Close XOR Ranged based on combatPick', () => {
    const closePick = applyBonuses({
      raw: { archive: 0, bulk: 0, ghost: 0, morph: 0, speed: 0, tech: 0 },
      type: 'apt',
      lifeForm: 'blood',
      background: 'enforcer',
      distribution: { plus2: [], plus1: [], combatPick: 'close' }
    });
    expect(closePick.close).toBe(1 + 2 + 2); // origo 1 + lf 2 + bg 2
    expect(closePick.ranged).toBe(0 + 2 + 2); // origo 0 + lf 2 + bg 2
  });

  it('Prime gets Close 1 + Ranged 1 origo automatically', () => {
    const stacks = applyBonuses({
      raw: { archive: 0, bulk: 0, ghost: 0, morph: 0, speed: 0, tech: 0 },
      type: 'prime',
      lifeForm: 'blood',
      background: 'enforcer',
      distribution: { plus2: [], plus1: [] }
    });
    expect(stacks.close).toBe(1 + 2 + 2);
    expect(stacks.ranged).toBe(1 + 2 + 2);
  });

  it('Core gets 0 Close + 0 Ranged origo before life-form / background', () => {
    const stacks = applyBonuses({
      raw: { archive: 0, bulk: 0, ghost: 0, morph: 0, speed: 0, tech: 0 },
      type: 'core',
      lifeForm: 'blood',
      background: 'enforcer',
      distribution: { plus2: [], plus1: [] }
    });
    expect(stacks.close).toBe(0 + 2 + 2);
    expect(stacks.ranged).toBe(0 + 2 + 2);
  });

  it('Droid: forces Tech = 8 and Ghost = 3, ignoring raw rolls AND plus2/plus1', () => {
    const stacks = applyBonuses({
      raw: { archive: 2, bulk: 2, ghost: 5, morph: 2, speed: 2, tech: 2 },
      type: 'apt',
      lifeForm: 'droid',
      background: 'enforcer',
      // Try to bump tech/ghost — must be ignored.
      distribution: { plus2: ['tech', 'ghost', 'archive', 'bulk'], plus1: [] }
    });
    expect(stacks.tech).toBe(8); // set, ignores roll + bonus
    expect(stacks.ghost).toBe(3 + 2); // set 3 + bg +2 (lf bonus refused, bg still applies)
    // Allowed bumps still land.
    expect(stacks.archive).toBe(2 + 2);
    expect(stacks.bulk).toBe(2 + 2 + 2); // raw 2 + lf+2 + bg+2
  });

  it('Holid: forces Archive = 7 and Ghost = 4', () => {
    const stacks = applyBonuses({
      raw: { archive: 5, bulk: 2, ghost: 5, morph: 2, speed: 2, tech: 2 },
      type: 'apt',
      lifeForm: 'holid',
      background: 'enforcer',
      distribution: { plus2: ['archive', 'ghost', 'bulk', 'morph'], plus1: [] }
    });
    expect(stacks.archive).toBe(7); // set, raw + lf bump ignored
    expect(stacks.ghost).toBe(4 + 2); // set + bg+2
  });

  it('Tank Born: caps chosen stack at 8 + applies +2 to chosen combat stack', () => {
    const stacks = applyBonuses({
      raw: { archive: 2, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt',
      lifeForm: 'tank_born',
      background: 'enforcer',
      distribution: {
        plus2: [],
        plus1: ['ghost', 'morph', 'speed', 'tech', 'bulk'],
        capped: 'archive',
        combatPick: 'close'
      }
    });
    expect(stacks.archive).toBe(8); // capped
    expect(stacks.bulk).toBe(1 + 1 + 2); // raw + lf+1 + bg+2
    // Apt close pick adds origo 1 + Tank Born +2 close + Enforcer +2 close
    expect(stacks.close).toBe(1 + 2 + 2);
    expect(stacks.ranged).toBe(0 + 0 + 2); // no origo, no lf combat, bg+2
  });

  it('refuses to apply +2 / +1 to a stack that is set/cap (Tank Born + Droid)', () => {
    const stacks = applyBonuses({
      raw: { archive: 2, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt',
      lifeForm: 'tank_born',
      background: 'enforcer',
      distribution: {
        plus2: ['archive'], // capped — should be ignored
        plus1: ['archive', 'bulk'], // archive ignored, bulk applies
        capped: 'archive',
        combatPick: 'close'
      }
    });
    expect(stacks.archive).toBe(8); // still 8, no bump
    expect(stacks.bulk).toBe(1 + 1 + 2); // bulk +1 + bg+2
  });
});

describe('applyBonusesComposed', () => {
  it('returns a per-stack composition that sums to the same total as applyBonuses', () => {
    const opts = {
      raw: { archive: 2, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt' as const,
      lifeForm: 'blood' as const,
      background: 'enforcer' as const,
      distribution: {
        plus2: ['archive', 'bulk', 'ghost', 'morph'] as ('archive' | 'bulk' | 'ghost' | 'morph')[],
        plus1: ['speed', 'tech'] as ('speed' | 'tech')[]
      }
    };
    const totals = applyBonuses(opts);
    const composed = applyBonusesComposed(opts);
    for (const k of ['archive', 'bulk', 'ghost', 'morph', 'speed', 'tech', 'close', 'ranged'] as const) {
      expect(composed[k].final).toBe(totals[k]);
    }
  });

  it('attributes life-form vs background bonuses to the correct slot (Enforcer)', () => {
    const composed = applyBonusesComposed({
      raw: { archive: 2, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt',
      lifeForm: 'blood',
      background: 'enforcer',
      distribution: { plus2: ['archive', 'bulk', 'ghost', 'morph'], plus1: ['speed', 'tech'] }
    });
    expect(composed.bulk.base).toBe(1);
    expect(composed.bulk.lifeFormBonus).toBe(2);
    expect(composed.bulk.backgroundBonus).toBe(2);
    expect(composed.ghost.lifeFormBonus).toBe(2);
    expect(composed.ghost.backgroundBonus).toBe(2);
  });

  it('encodes Tank Born cap as an `other` delta so base still reflects the player roll', () => {
    const composed = applyBonusesComposed({
      raw: { archive: 3, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1 },
      type: 'apt',
      lifeForm: 'tank_born',
      background: 'enforcer',
      distribution: { plus2: [], plus1: [], capped: 'archive', combatPick: 'close' }
    });
    expect(composed.archive.base).toBe(3);
    expect(composed.archive.other).toBe(8 - 3); // delta to reach cap
    expect(composed.archive.final).toBe(8);
  });
});

describe('backgroundPrimaryBonus', () => {
  it('returns the background closeBonus / rangedBonus / primary bonus by stack', () => {
    const c = createDefaultCharacter();
    c.background = 'enforcer';
    expect(backgroundPrimaryBonus(c, 'bulk')).toBe(2);
    expect(backgroundPrimaryBonus(c, 'ghost')).toBe(2);
    expect(backgroundPrimaryBonus(c, 'close')).toBe(2);
    expect(backgroundPrimaryBonus(c, 'ranged')).toBe(2);
    expect(backgroundPrimaryBonus(c, 'archive')).toBe(0);
  });
});

// ============================================
// Extended HARM state machine tests
// ============================================

describe('harm: cap helpers', () => {
  it('isHarmCap fires only at the 20 cap', () => {
    const c = createDefaultCharacter();
    expect(isHarmCap(c)).toBe(false);
    c.harm.harmTaken = 19;
    expect(isHarmCap(c)).toBe(false);
    c.harm.harmTaken = 20;
    expect(isHarmCap(c)).toBe(true);
  });

  it('isNaniteCap fires only at the 20 cap (rules/50:36)', () => {
    const c = createDefaultCharacter();
    expect(isNaniteCap(c)).toBe(false);
    c.harm.naniteTaken = 19;
    expect(isNaniteCap(c)).toBe(false);
    c.harm.naniteTaken = 20;
    expect(isNaniteCap(c)).toBe(true);
  });

  it('endRollDN is max(physical, nanite) per rules/46:24', () => {
    expect(endRollDN({ harmTaken: 7, naniteTaken: 3 } as never)).toBe(7);
    expect(endRollDN({ harmTaken: 3, naniteTaken: 7 } as never)).toBe(7);
  });

  it('isEndRollRequired only when physical harm > bulk', () => {
    expect(isEndRollRequired({ harmTaken: 3 } as never, 3)).toBe(false);
    expect(isEndRollRequired({ harmTaken: 4 } as never, 3)).toBe(true);
  });

  it('isForcedRoll only at the 20 cap; canSuspend is the inverse', () => {
    expect(isForcedRoll({ harmTaken: 19, harmCap: 20 } as never)).toBe(false);
    expect(isForcedRoll({ harmTaken: 20, harmCap: 20 } as never)).toBe(true);
    expect(canSuspend({ harmTaken: 19, harmCap: 20 } as never)).toBe(true);
    expect(canSuspend({ harmTaken: 20, harmCap: 20 } as never)).toBe(false);
  });
});

describe('harm: applyPhysicalHarm', () => {
  it('clamps at the harm cap and does not regress already-injured states', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 19;
    c.harm = applyPhysicalHarm(c, 50);
    expect(c.harm.harmTaken).toBe(20);
    expect(c.harm.endRollSuspended).toBe(false);

    c.harm.status = 'injured-knocked-out';
    c.harm = applyPhysicalHarm(c, 5);
    // status doesn't revert; harm still clamped at cap.
    expect(c.harm.status).toBe('injured-knocked-out');
  });

  it('is a no-op for dead characters', () => {
    const c = createDefaultCharacter();
    c.harm.status = 'dead';
    c.harm.harmTaken = 20;
    const before = { ...c.harm };
    c.harm = applyPhysicalHarm(c, 99);
    expect(c.harm).toEqual(before);
  });

  it('routes through harmed → end-roll-pending as harm crosses Bulk', () => {
    const c = createDefaultCharacter();
    c.stacks.bulk = 3;
    c.harm = applyPhysicalHarm(c, 2);
    expect(c.harm.status).toBe('harmed');
    c.harm = applyPhysicalHarm(c, 2); // total 4 > bulk 3
    expect(c.harm.status).toBe('end-roll-pending');
  });
});

describe('harm: end roll resolution', () => {
  it('endRollPass clears all physical harm but keeps nanite damage', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 12;
    c.harm.naniteTaken = 5;
    c.harm.endRollSuspended = true;
    c.harm.suspendedAtHarm = 8;
    c.harm = endRollPass(c);
    expect(c.harm.harmTaken).toBe(0);
    expect(c.harm.naniteTaken).toBe(5);
    expect(c.harm.endRollSuspended).toBe(false);
    expect(c.harm.suspendedAtHarm).toBe(0);
    expect(c.harm.status).toBe('harmed'); // because nanite > 0
  });

  it('endRollPass returns to unharmed when nanite is also 0', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 12;
    c.harm = endRollPass(c);
    expect(c.harm.status).toBe('unharmed');
  });

  it('endRollFail at physical 20 → dying + records timer; Prime gets minutes', () => {
    const c = createDefaultCharacter();
    c.type = 'prime';
    c.harm.harmTaken = 20;
    c.harm = endRollFail(c, 17);
    expect(c.harm.status).toBe('dying');
    expect(c.harm.dyingTimer).toBe(17);
    expect(c.harm.dyingTimerUnit).toBe('minute');
  });

  it('endRollFail below 20 → injured-knocked-out; non-Prime gets rounds when dying', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 12;
    c.harm = endRollFail(c, 9);
    expect(c.harm.status).toBe('injured-knocked-out');
    expect(c.harm.dyingTimer).toBeNull();
  });

  it('suspendEndRoll flips suspended state when legal; refuses at cap', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 12;
    c.harm = suspendEndRoll(c);
    expect(c.harm.endRollSuspended).toBe(true);
    expect(c.harm.status).toBe('suspended');
    expect(c.harm.suspendedAtHarm).toBe(12);

    const atCap = createDefaultCharacter();
    atCap.harm.harmTaken = 20;
    const original = { ...atCap.harm };
    atCap.harm = suspendEndRoll(atCap);
    expect(atCap.harm).toEqual(original); // no-op
  });
});

describe('harm: healing', () => {
  it('healPhysicalHarm clamps at 0 and recomputes status to unharmed', () => {
    const c = createDefaultCharacter();
    c.harm.harmTaken = 4;
    c.harm.status = 'harmed';
    c.harm = healPhysicalHarm(c, 99);
    expect(c.harm.harmTaken).toBe(0);
    expect(c.harm.status).toBe('unharmed');
  });

  it('healNaniteHarm of a comatose character drops them back to harmed or unharmed', () => {
    const c = createDefaultCharacter();
    c.harm = applyNaniteHarm(c, 20, 4);
    expect(c.harm.status).toBe('comatose');
    expect(c.harm.comaDays).toBe(4);
    c.harm = healNaniteHarm(c, 1);
    expect(c.harm.status).toBe('harmed');
    expect(c.harm.comaDays).toBeNull();
  });

  it('applyNaniteHarm at the cap sets comatose + coma days', () => {
    const c = createDefaultCharacter();
    c.harm = applyNaniteHarm(c, 25, 6); // overcap: clamps to 20
    expect(c.harm.naniteTaken).toBe(20);
    expect(c.harm.status).toBe('comatose');
    expect(c.harm.comaDays).toBe(6);
  });
});

describe('encumbrance / money helpers', () => {
  it('isOverloaded fires when used > total', () => {
    const c = createDefaultCharacter();
    c.inventory = [
      { id: 'a', name: 'A', slots: 15, cost: 0, location: 'worn', equipped: true, stashed: false }
    ];
    expect(isOverloaded(c)).toBe(true);
  });

  it('encumbranceStatus distinguishes overloaded vs severely overloaded by Bulk', () => {
    const c = createDefaultCharacter();
    c.stacks.bulk = 2;
    c.inventory = [
      { id: 'a', name: 'A', slots: 11, cost: 0, location: 'worn', equipped: true, stashed: false }
    ];
    expect(encumbranceStatus(c)).toBe('overloaded'); // 11 - 10 = 1 ≤ bulk 2
    c.inventory[0].slots = 14;
    expect(encumbranceStatus(c)).toBe('severely_overloaded'); // 14 - 10 = 4 > bulk 2
  });

  it('cash conversions: 1 E = 10 P, 10 p = 1 P', () => {
    const c = createDefaultCharacter();
    c.purse = {
      parts: 5,
      smallParts: 30, // = 3 P
      energyPacks: 2, // = 20 P
      energyCells: 4, // = 4 P
      stashedParts: 10,
      stashedSmallParts: 20, // = 2 P
      stashedEnergyPacks: 1, // = 10 P
      stashedEnergyCells: 7
    };
    expect(onHandCashInParts(c)).toBe(5 + 3 + 20 + 4);
    expect(stashedCashInParts(c)).toBe(10 + 2 + 10 + 7);
    expect(totalCashInParts(c)).toBe(32 + 29);
  });

  it('formatPartsEquivalent trims trailing .0 only', () => {
    expect(formatPartsEquivalent(5)).toBe('5');
    expect(formatPartsEquivalent(5.0)).toBe('5');
    expect(formatPartsEquivalent(5.5)).toBe('5.5');
  });

  it('ammoTotal sums loaded + spare for weapons and inventory items', () => {
    expect(ammoTotal({ ammoLoaded: 4, ammoSpare: 6 } as never)).toBe(10);
    expect(ammoTotal({} as never)).toBe(0);
  });
});

describe('equipment helpers', () => {
  it('equippedShield and equippedHelmet find the matching item, ignoring stashed', () => {
    const c = createDefaultCharacter();
    c.armor = [
      { id: 'h', name: 'Helmet', slots: 1, cost: 0, equipped: true, stashed: false, isHelmet: true },
      { id: 's', name: 'Shield', slots: 1, cost: 0, equipped: true, stashed: false, isShield: true },
      { id: 's2', name: 'Stashed Shield', slots: 1, cost: 0, equipped: true, stashed: true, isShield: true }
    ];
    expect(equippedHelmet(c)?.id).toBe('h');
    expect(equippedShield(c)?.id).toBe('s');
  });

  it('summarize emits the displayName / classLine / encumbrance fields', () => {
    const c = createDefaultCharacter();
    c.name = 'Test PC';
    c.type = 'apt';
    c.lifeForm = 'blood';
    c.background = 'enforcer';
    const s = summarize(c);
    expect(s.displayName).toBe('Test PC');
    expect(s.classLine).toBe('Apt Blood Enforcer');
    expect(s.slotsCap).toBe(10);
    expect(s.encumbrance).toBe('ok');
  });

  it('summarize uses "Unnamed Character" when name is blank', () => {
    const c = createDefaultCharacter();
    c.name = '';
    expect(summarize(c).displayName).toBe('Unnamed Character');
  });
});

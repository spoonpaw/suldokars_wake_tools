import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanRoll,
  doubleRoll,
  explodingD20,
  halfRoll,
  invertedRoll,
  odyn,
  rollD12,
  rollD20,
  rollD3,
  rollD6,
  rollDamage,
  rollNd,
  stepDamageDown,
  stepDamageUp,
  type RollOutcome
} from './dice';

/**
 * Math.random() returns a value in [0, 1). With `floor(random * sides) + 1`
 * a returned `r` produces face = `floor(r * sides) + 1`. The helper below
 * picks an `r` that lands on a specific face deterministically.
 */
function mockFace(face: number, sides: number) {
  // floor(r * sides) === face - 1, so r in [(face-1)/sides, face/sides)
  const lo = (face - 1) / sides;
  vi.spyOn(Math, 'random').mockReturnValue(lo);
}

function mockSequence(values: number[]) {
  const mock = vi.spyOn(Math, 'random');
  for (const v of values) mock.mockReturnValueOnce(v);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('low-level RNG helpers', () => {
  it('rollNd returns exactly N face values in 1..sides', () => {
    const rolls = rollNd(50, 6);
    expect(rolls).toHaveLength(50);
    for (const r of rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
  });

  it('rollD3 / rollD6 / rollD12 / rollD20 stay within range across many rolls', () => {
    for (let i = 0; i < 200; i++) {
      const d3 = rollD3();
      const d6 = rollD6();
      const d12 = rollD12();
      const d20 = rollD20().face;
      expect(d3).toBeGreaterThanOrEqual(1);
      expect(d3).toBeLessThanOrEqual(3);
      expect(d6).toBeGreaterThanOrEqual(1);
      expect(d6).toBeLessThanOrEqual(6);
      expect(d12).toBeGreaterThanOrEqual(1);
      expect(d12).toBeLessThanOrEqual(12);
      expect(d20).toBeGreaterThanOrEqual(1);
      expect(d20).toBeLessThanOrEqual(20);
    }
  });

  it('rollD20 applies the modifier to the total but not the face', () => {
    mockFace(7, 20);
    const r = rollD20(3);
    expect(r.face).toBe(7);
    expect(r.modifier).toBe(3);
    expect(r.total).toBe(10);
  });
});

describe('invertedRoll outcomes (rules/32, /45)', () => {
  it('returns regular success when face <= stack', () => {
    mockFace(3, 20);
    const r = invertedRoll(5, 15);
    expect(r.outcome).toBe<RollOutcome>('success');
    expect(r.d20).toBe(3);
  });

  it('returns special success when face > DN', () => {
    mockFace(18, 20);
    const r = invertedRoll(5, 15);
    expect(r.outcome).toBe<RollOutcome>('special');
  });

  it('returns crit on natural 20 when DN <= 19', () => {
    mockFace(20, 20);
    expect(invertedRoll(5, 15).outcome).toBe<RollOutcome>('crit');
    // DN 20 → 20 is not a crit (rules/32: crit only when DN ≤ 19)
    mockFace(20, 20);
    expect(invertedRoll(5, 20).outcome).not.toBe<RollOutcome>('crit');
  });

  it('treats natural 19 as crit ONLY for Apt characters', () => {
    mockFace(19, 20);
    expect(invertedRoll(5, 15, true).outcome).toBe<RollOutcome>('crit');
    mockFace(19, 20);
    expect(invertedRoll(5, 15, false).outcome).not.toBe<RollOutcome>('crit');
  });

  it('fumbles on exact 13 when DN >= 13 (NOT natural 1)', () => {
    mockFace(13, 20);
    expect(invertedRoll(5, 13).outcome).toBe<RollOutcome>('fumble');
    // DN 12 → 13 is not a fumble
    mockFace(13, 20);
    expect(invertedRoll(5, 12).outcome).not.toBe<RollOutcome>('fumble');
    // Natural 1 is regular success (1 <= stack 5)
    mockFace(1, 20);
    expect(invertedRoll(5, 15).outcome).toBe<RollOutcome>('success');
  });

  it('fumble priority beats both crit/special checks (rules edge: 13 when DN=13)', () => {
    mockFace(13, 20);
    const r = invertedRoll(5, 13);
    expect(r.outcome).toBe<RollOutcome>('fumble');
  });

  it('returns failure when face > stack AND <= DN', () => {
    mockFace(10, 20);
    expect(invertedRoll(5, 15).outcome).toBe<RollOutcome>('failure');
  });
});

describe('cleanRoll (DN-only — no stack)', () => {
  it('passes when face <= DN, fails when face > DN', () => {
    mockFace(5, 20);
    expect(cleanRoll(10).outcome).toBe<RollOutcome>('success');
    mockFace(15, 20);
    expect(cleanRoll(10).outcome).toBe<RollOutcome>('failure');
  });

  it('crits on natural 20 when DN <= 19', () => {
    mockFace(20, 20);
    expect(cleanRoll(15).outcome).toBe<RollOutcome>('crit');
  });

  it('fumbles on exact 13 when DN >= 13', () => {
    mockFace(13, 20);
    expect(cleanRoll(15).outcome).toBe<RollOutcome>('fumble');
  });

  it('never returns "special" — gap between stack and DN collapses without a stack', () => {
    for (let face = 1; face <= 20; face++) {
      mockFace(face, 20);
      const r = cleanRoll(10);
      expect(r.outcome).not.toBe<RollOutcome>('special');
    }
  });
});

describe('doubleRoll / halfRoll', () => {
  it('doubleRoll picks the BEST of two outcomes (crit > special > success > failure > fumble)', () => {
    // Roll A: face 5 against stack 5 → success. Roll B: face 20 → crit.
    mockSequence([4 / 20, 19 / 20]);
    const r = doubleRoll(5, 15);
    expect(r.best.outcome).toBe<RollOutcome>('crit');
  });

  it('halfRoll picks the WORST of two outcomes', () => {
    // Roll A: face 13 → fumble (DN=13). Roll B: face 5 → success.
    mockSequence([12 / 20, 4 / 20]);
    const r = halfRoll(5, 13);
    expect(r.worst.outcome).toBe<RollOutcome>('fumble');
  });
});

describe('explodingD20', () => {
  it('stops after the first non-20 face', () => {
    mockFace(5, 20);
    const r = explodingD20();
    expect(r.rolls).toEqual([5]);
    expect(r.total).toBe(5);
  });

  it('chains adds for consecutive 20s, then stops', () => {
    // r in [19/20, 1) → face = floor(r * 20) + 1 = 20
    mockSequence([0.95, 0.95, 5 / 20]);
    const r = explodingD20();
    expect(r.rolls).toEqual([20, 20, 6]);
    expect(r.total).toBe(46);
  });
});

describe('odyn (rules/12 — one die of each)', () => {
  it('returns exactly one face per die size in range', () => {
    const o = odyn();
    expect(o.d20).toBeGreaterThanOrEqual(1);
    expect(o.d20).toBeLessThanOrEqual(20);
    expect(o.d12).toBeGreaterThanOrEqual(1);
    expect(o.d12).toBeLessThanOrEqual(12);
    expect(o.d10).toBeGreaterThanOrEqual(1);
    expect(o.d10).toBeLessThanOrEqual(10);
    expect(o.d8).toBeGreaterThanOrEqual(1);
    expect(o.d8).toBeLessThanOrEqual(8);
    expect(o.d6).toBeGreaterThanOrEqual(1);
    expect(o.d6).toBeLessThanOrEqual(6);
    expect(o.d4).toBeGreaterThanOrEqual(1);
    expect(o.d4).toBeLessThanOrEqual(4);
  });
});

describe('damage step ladder', () => {
  it('steps up through d3 → d4 → d6 → d8 → d10 → d12, clamped at d12', () => {
    expect(stepDamageUp('d3')).toBe('d4');
    expect(stepDamageUp('d4')).toBe('d6');
    expect(stepDamageUp('d6')).toBe('d8');
    expect(stepDamageUp('d8')).toBe('d10');
    expect(stepDamageUp('d10')).toBe('d12');
    expect(stepDamageUp('d12')).toBe('d12');
  });

  it('steps down through the same ladder, clamped at d3', () => {
    expect(stepDamageDown('d12')).toBe('d10');
    expect(stepDamageDown('d10')).toBe('d8');
    expect(stepDamageDown('d3')).toBe('d3');
  });

  it('multi-step jumps respect bounds', () => {
    expect(stepDamageUp('d4', 3)).toBe('d10');
    expect(stepDamageUp('d4', 99)).toBe('d12');
    expect(stepDamageDown('d10', 99)).toBe('d3');
  });

  it('rollDamage returns the rolled face within the die range', () => {
    const r = rollDamage('d6');
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.total).toBeLessThanOrEqual(6);
    expect(r.rolls).toHaveLength(1);
  });
});

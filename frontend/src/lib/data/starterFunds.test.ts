import { describe, expect, it } from 'vitest';
import { STARTING_PARTS, lifeFormGroup, startingPartsFor } from './starterFunds';

describe('lifeFormGroup (rules/23 funds row lookup)', () => {
  it('maps Blood and Tank Born to their own rows', () => {
    expect(lifeFormGroup('blood')).toBe('blood');
    expect(lifeFormGroup('tank_born')).toBe('tank_born');
  });

  it('maps Palp + Amphibious to the shared alien row', () => {
    expect(lifeFormGroup('palp_alien')).toBe('alien');
    expect(lifeFormGroup('amphibious_alien')).toBe('alien');
  });

  it('maps Droid + Holid to the shared construct row', () => {
    expect(lifeFormGroup('droid')).toBe('construct');
    expect(lifeFormGroup('holid')).toBe('construct');
  });
});

describe('startingPartsFor (d6 → P table per life-form)', () => {
  it('returns the published Blood row (50, 100, 150, 200, 250, 300)', () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => startingPartsFor('blood', r))).toEqual([50, 100, 150, 200, 250, 300]);
  });

  it('returns the Alien row (25-150 in 25s)', () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => startingPartsFor('palp_alien', r))).toEqual([25, 50, 75, 100, 125, 150]);
  });

  it('returns the Tank Born row (50-200 in 30s)', () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => startingPartsFor('tank_born', r))).toEqual([50, 80, 110, 140, 170, 200]);
  });

  it('returns the Construct row (75-200 in 25s)', () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => startingPartsFor('droid', r))).toEqual([75, 100, 125, 150, 175, 200]);
    expect([1, 2, 3, 4, 5, 6].map((r) => startingPartsFor('holid', r))).toEqual([75, 100, 125, 150, 175, 200]);
  });

  it('clamps out-of-range rolls to 1..6', () => {
    expect(startingPartsFor('blood', 0)).toBe(50); // clamps to roll 1
    expect(startingPartsFor('blood', 7)).toBe(300); // clamps to roll 6
    expect(startingPartsFor('blood', -99)).toBe(50);
    expect(startingPartsFor('blood', 100)).toBe(300);
  });

  it('exports a complete STARTING_PARTS table with 6 entries per group', () => {
    for (const row of Object.values(STARTING_PARTS)) {
      expect(row).toHaveLength(6);
      expect(row.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    }
  });
});

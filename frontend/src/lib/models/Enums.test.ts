import { describe, expect, it } from 'vitest';
import { allowedLifeForms } from './Enums';

describe('allowedLifeForms (rules/18 pair gating)', () => {
  it('returns Blood + Aliens when no pairs (0 pairs)', () => {
    expect(allowedLifeForms(0)).toEqual(['blood', 'palp_alien', 'amphibious_alien']);
  });

  it('locks to Blood-only at 1 pair', () => {
    expect(allowedLifeForms(1)).toEqual(['blood']);
  });

  it('adds Tank Born at 2 pairs', () => {
    expect(allowedLifeForms(2)).toEqual(['blood', 'palp_alien', 'amphibious_alien', 'tank_born']);
  });

  it('unlocks Constructs (Droid + Holid) at 3+ pairs', () => {
    const three = allowedLifeForms(3);
    expect(three).toContain('droid');
    expect(three).toContain('holid');
    expect(three).toEqual(['blood', 'palp_alien', 'amphibious_alien', 'tank_born', 'droid', 'holid']);
  });

  it('keeps everything unlocked at 4+ pairs (rules cap is the same set)', () => {
    expect(allowedLifeForms(6)).toEqual(['blood', 'palp_alien', 'amphibious_alien', 'tank_born', 'droid', 'holid']);
  });

  it('treats negative pair counts as 0 (defensive)', () => {
    expect(allowedLifeForms(-1)).toEqual(['blood', 'palp_alien', 'amphibious_alien']);
  });
});

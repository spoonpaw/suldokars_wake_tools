import { describe, expect, it } from 'vitest';
import {
  LANGUAGES_DATA,
  computeLanguageExpertise,
  getLanguageDef,
  isConstructLifeForm,
  languagePickEligibility,
  mandatoryLanguageForLifeForm
} from './languages';

describe('mandatoryLanguageForLifeForm (rules/20)', () => {
  it('returns null for Blood / Tank Born (free pick)', () => {
    expect(mandatoryLanguageForLifeForm('blood')).toBeNull();
    expect(mandatoryLanguageForLifeForm('tank_born')).toBeNull();
  });

  it('forces palp for Palp Alien', () => {
    expect(mandatoryLanguageForLifeForm('palp_alien')).toBe('palp');
  });

  it("forces K'lsixla for Amphibious Alien", () => {
    expect(mandatoryLanguageForLifeForm('amphibious_alien')).toBe('klsixla');
  });

  it('forces Al-Gol for Droid and Holid (constructs)', () => {
    expect(mandatoryLanguageForLifeForm('droid')).toBe('al_gol');
    expect(mandatoryLanguageForLifeForm('holid')).toBe('al_gol');
  });
});

describe('isConstructLifeForm', () => {
  it('classifies droid and holid as construct', () => {
    expect(isConstructLifeForm('droid')).toBe(true);
    expect(isConstructLifeForm('holid')).toBe(true);
  });

  it('rejects non-construct life-forms', () => {
    expect(isConstructLifeForm('blood')).toBe(false);
    expect(isConstructLifeForm('palp_alien')).toBe(false);
    expect(isConstructLifeForm('amphibious_alien')).toBe(false);
    expect(isConstructLifeForm('tank_born')).toBe(false);
  });
});

describe('languagePickEligibility (rules/20 restrictions)', () => {
  const krypotkep = LANGUAGES_DATA.find((l) => l.id === 'krypotkep');
  const vatori = LANGUAGES_DATA.find((l) => l.id === 'vatori');

  it('returns null for unrestricted languages regardless of life-form', () => {
    expect(vatori).toBeDefined();
    expect(languagePickEligibility(vatori!, 'blood', false, 0)).toBeNull();
    expect(languagePickEligibility(vatori!, 'droid', true, 0)).toBeNull();
  });

  it('blocks Krypotkep for non-construct life-forms', () => {
    expect(krypotkep).toBeDefined();
    const reason = languagePickEligibility(krypotkep!, 'blood', true, 1);
    expect(reason).toMatch(/construct/i);
  });

  it('blocks Krypotkep for constructs without d3=3 unlock', () => {
    const reason = languagePickEligibility(krypotkep!, 'droid', false, 0);
    expect(reason).toMatch(/third-slot|d3/i);
  });

  it('blocks Krypotkep before first extra pick (must be the THIRD slot)', () => {
    const reason = languagePickEligibility(krypotkep!, 'droid', true, 0);
    expect(reason).toMatch(/pick another|third/i);
  });

  it('allows Krypotkep for a construct with d3=3 and one extra picked', () => {
    expect(languagePickEligibility(krypotkep!, 'droid', true, 1)).toBeNull();
    expect(languagePickEligibility(krypotkep!, 'holid', true, 1)).toBeNull();
  });
});

describe('computeLanguageExpertise (Languages keyword on Archive or Morph)', () => {
  it('reports both false with no Language keyword', () => {
    expect(computeLanguageExpertise([{ name: 'Stealth', stack: 'speed' }])).toEqual({ written: false, spoken: false });
  });

  it('marks written when Languages keyword is on Archive', () => {
    expect(computeLanguageExpertise([{ name: 'Languages', stack: 'archive' }])).toEqual({ written: true, spoken: false });
  });

  it('marks spoken when Languages keyword is on Morph', () => {
    expect(computeLanguageExpertise([{ name: 'Languages', stack: 'morph' }])).toEqual({ written: false, spoken: true });
  });

  it('marks both when present on both stacks', () => {
    expect(
      computeLanguageExpertise([
        { name: 'Languages', stack: 'archive' },
        { name: 'Language', stack: 'morph' }
      ])
    ).toEqual({ written: true, spoken: true });
  });

  it('is case-insensitive and tolerates singular "Language"', () => {
    expect(computeLanguageExpertise([{ name: 'language', stack: 'archive' }])).toEqual({ written: true, spoken: false });
  });
});

describe('getLanguageDef', () => {
  it('returns the def for a valid id', () => {
    expect(getLanguageDef('pidgin')?.name).toBe('Pidgin');
    expect(getLanguageDef('krypotkep')?.restriction?.lifeFormGroup).toBe('construct');
  });

  it('returns null for an unknown id', () => {
    expect(getLanguageDef('not_a_real_lang' as never)).toBeNull();
  });
});

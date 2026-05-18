import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from '$lib/models';
import { BASIC_FORMULAE } from '$lib/data/formulae';
import { SUBSPACE_FORMULAE } from '$lib/data/subspaceFormulae';
import {
  addBasicFormula,
  addCustomFormula,
  addSubspaceFormula,
  removeFormula,
  setActiveFormula
} from './formulae';

function coreChar() {
  const c = createDefaultCharacter();
  c.type = 'core';
  c.coreBond = 'subspace_nanites';
  return c;
}

describe('addBasicFormula lock-step', () => {
  it('adds the formula to BOTH character.formulae and character.spaces (kind=formula)', () => {
    const c = coreChar();
    const first = BASIC_FORMULAE[0];
    const out = addBasicFormula(c, first.id);
    expect(out.formulae).toHaveLength(1);
    expect(out.spaces.filter((s) => s.kind === 'formula')).toHaveLength(1);
    // Shared id wires the two records together for setActive / remove.
    expect(out.formulae[0].id).toBe(out.spaces[0].id);
    expect(out.formulae[0].name).toBe(first.name);
    expect(out.spaces[0].kind).toBe('formula');
  });

  it('marks the FIRST added formula active, subsequent ones inactive', () => {
    const c = coreChar();
    const a = BASIC_FORMULAE[0];
    const b = BASIC_FORMULAE[1];
    const after1 = addBasicFormula(c, a.id);
    const after2 = addBasicFormula(after1, b.id);
    expect(after2.formulae[0].active).toBe(true);
    expect(after2.formulae[1].active).toBe(false);
    expect(after2.spaces[0].active).toBe(true);
    expect(after2.spaces[1].active).toBe(false);
  });

  it('refuses to add a duplicate formula by name', () => {
    const c = coreChar();
    const f = BASIC_FORMULAE[0];
    const once = addBasicFormula(c, f.id);
    const twice = addBasicFormula(once, f.id);
    expect(twice.formulae).toHaveLength(1);
    expect(twice.spaces).toHaveLength(1);
  });

  it('returns the input character unchanged when given an unknown formula id', () => {
    const c = coreChar();
    const out = addBasicFormula(c, 'not-a-real-id');
    expect(out).toBe(c);
  });

  it('does not mutate the input character', () => {
    const c = coreChar();
    const before = structuredClone(c);
    addBasicFormula(c, BASIC_FORMULAE[0].id);
    expect(c).toEqual(before);
  });
});

describe('addSubspaceFormula lock-step', () => {
  it('writes the subspace H-cost into both records', () => {
    const c = coreChar();
    const f = SUBSPACE_FORMULAE[0];
    const out = addSubspaceFormula(c, f.id);
    expect(out.formulae[0].hCost).toBe(f.bondedCost);
    expect(out.formulae[0].category).toBe('subspace');
    expect(out.spaces[0].notes).toContain(`${f.bondedCost} H`);
    expect(out.spaces[0].notes).toContain('subspace');
  });

  it('refuses to add a duplicate by name and ignores unknown ids', () => {
    const c = coreChar();
    const f = SUBSPACE_FORMULAE[0];
    const once = addSubspaceFormula(c, f.id);
    const twice = addSubspaceFormula(once, f.id);
    expect(twice.formulae).toHaveLength(1);
    expect(addSubspaceFormula(c, 'not-a-real-subspace-id')).toBe(c);
  });
});

describe('addCustomFormula', () => {
  it('adds the homebrew formula to both arrays and tags space notes as "custom"', () => {
    const c = coreChar();
    const out = addCustomFormula(c, {
      name: 'Reroute Grid',
      hCost: '2',
      category: 'basic',
      description: 'Reflows ambient energy.'
    });
    expect(out.formulae[0].name).toBe('Reroute Grid');
    expect(out.formulae[0].hCost).toBe('2');
    expect(out.formulae[0].category).toBe('basic');
    expect(out.spaces[0].notes).toContain('custom');
    expect(out.spaces[0].notes).not.toContain('subspace');
  });

  it('marks subspace custom formulae with the subspace tag', () => {
    const c = coreChar();
    const out = addCustomFormula(c, {
      name: 'Echo Phase',
      hCost: '3',
      category: 'subspace',
      description: 'Doubles a subspace effect.'
    });
    expect(out.spaces[0].notes).toContain('subspace');
  });
});

describe('removeFormula lock-step', () => {
  it('removes the formula AND its mirrored space by shared id', () => {
    const c = coreChar();
    const a = BASIC_FORMULAE[0];
    const b = BASIC_FORMULAE[1];
    const withTwo = addBasicFormula(addBasicFormula(c, a.id), b.id);
    const idToRemove = withTwo.formulae[0].id;
    const out = removeFormula(withTwo, idToRemove);
    expect(out.formulae.map((f) => f.id)).not.toContain(idToRemove);
    expect(out.spaces.map((s) => s.id)).not.toContain(idToRemove);
    expect(out.formulae).toHaveLength(1);
    expect(out.spaces).toHaveLength(1);
  });

  it('is a no-op when the id is not present', () => {
    const c = coreChar();
    const out = removeFormula(c, 'not-present');
    expect(out.formulae).toHaveLength(0);
    expect(out.spaces).toHaveLength(0);
  });
});

describe('setActiveFormula', () => {
  it('flips active for the chosen formula AND its mirrored space; all others inactive', () => {
    const c = coreChar();
    const a = BASIC_FORMULAE[0];
    const b = BASIC_FORMULAE[1];
    const withTwo = addBasicFormula(addBasicFormula(c, a.id), b.id);
    const idToActivate = withTwo.formulae[1].id;
    const out = setActiveFormula(withTwo, idToActivate);
    expect(out.formulae.find((f) => f.id === idToActivate)?.active).toBe(true);
    expect(out.formulae.find((f) => f.id !== idToActivate)?.active).toBe(false);
    expect(out.spaces.find((s) => s.id === idToActivate)?.active).toBe(true);
    expect(out.spaces.find((s) => s.id !== idToActivate)?.active).toBe(false);
  });

  it('leaves non-formula spaces untouched', () => {
    const c = coreChar();
    c.spaces.push({ id: 'sp-extra', active: true, kind: 'other', name: 'Misc', effect: '' });
    const f = BASIC_FORMULAE[0];
    const withOne = addBasicFormula(c, f.id);
    const out = setActiveFormula(withOne, withOne.formulae[0].id);
    expect(out.spaces.find((s) => s.id === 'sp-extra')?.active).toBe(true);
  });
});

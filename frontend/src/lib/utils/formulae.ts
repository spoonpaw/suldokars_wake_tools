/**
 * formulae.ts — shared Core-formula picker logic for the creation wizard
 * AND the post-creation edit form.
 *
 * Per rules/18, every formula a Core picks lives in TWO places at once:
 *   - character.formulae (the typed formula record with H-cost + category)
 *   - character.spaces   (a mirrored entry of kind 'formula' so the
 *                        per-type space view shows it)
 *
 * Both arrays MUST stay in lock-step. These helpers are the single
 * source of truth for that — never write to formulae or spaces directly
 * for Core formula management; route through here.
 */

import type { SWCharacter, CharacterSpace, CharacterFormula } from '$lib/models/SWCharacter';
import { BASIC_FORMULAE } from '$lib/data/formulae';
import { SUBSPACE_FORMULAE } from '$lib/data/subspaceFormulae';

/** Add a basic formula by id. No-op if already picked (matched by name).
 *  Auto-marks the first formula active. */
export function addBasicFormula(c: SWCharacter, formulaId: string): SWCharacter {
  const f = BASIC_FORMULAE.find((x) => x.id === formulaId);
  if (!f) return c;
  if (c.formulae.some((p) => p.name === f.name)) return c;
  const sharedId = crypto.randomUUID();
  const isFirst = c.formulae.length === 0;
  const newFormula: CharacterFormula = {
    id: sharedId,
    name: f.name,
    category: 'basic',
    active: isFirst,
    hCost: f.formulaCost,
    notes: f.description
  };
  const newSpace: CharacterSpace = {
    id: sharedId,
    active: isFirst,
    kind: 'formula',
    name: f.name,
    effect: f.description,
    notes: `${f.formulaCost} H`
  };
  return {
    ...c,
    formulae: [...c.formulae, newFormula],
    spaces: [...c.spaces, newSpace],
    updatedAt: new Date().toISOString()
  };
}

/** Add a subspace formula — caller is responsible for gating on
 *  character.coreBond === 'subspace_nanites'. */
export function addSubspaceFormula(c: SWCharacter, formulaId: string): SWCharacter {
  const f = SUBSPACE_FORMULAE.find((x) => x.id === formulaId);
  if (!f) return c;
  if (c.formulae.some((p) => p.name === f.name)) return c;
  const sharedId = crypto.randomUUID();
  const isFirst = c.formulae.length === 0;
  const newFormula: CharacterFormula = {
    id: sharedId,
    name: f.name,
    category: 'subspace',
    active: isFirst,
    hCost: f.bondedCost,
    notes: f.description
  };
  const newSpace: CharacterSpace = {
    id: sharedId,
    active: isFirst,
    kind: 'formula',
    name: f.name,
    effect: f.description,
    notes: `${f.bondedCost} H (subspace)`
  };
  return {
    ...c,
    formulae: [...c.formulae, newFormula],
    spaces: [...c.spaces, newSpace],
    updatedAt: new Date().toISOString()
  };
}

/** Remove a formula + its mirrored space by shared id. */
export function removeFormula(c: SWCharacter, formulaId: string): SWCharacter {
  return {
    ...c,
    formulae: c.formulae.filter((f) => f.id !== formulaId),
    spaces: c.spaces.filter((s) => s.id !== formulaId),
    updatedAt: new Date().toISOString()
  };
}

/** Add a custom (homebrew / GM-given) formula not in the printed catalog.
 *  Same lock-step add to character.formulae + character.spaces. Caller must
 *  validate the user-supplied fields. */
export function addCustomFormula(
  c: SWCharacter,
  payload: { name: string; hCost: string; category: 'basic' | 'subspace'; description: string }
): SWCharacter {
  const sharedId = crypto.randomUUID();
  const isFirst = c.formulae.length === 0;
  const newFormula: CharacterFormula = {
    id: sharedId,
    name: payload.name,
    category: payload.category,
    active: isFirst,
    hCost: payload.hCost,
    notes: payload.description
  };
  const newSpace: CharacterSpace = {
    id: sharedId,
    active: isFirst,
    kind: 'formula',
    name: payload.name,
    effect: payload.description,
    notes: `${payload.hCost} H${payload.category === 'subspace' ? ' (subspace)' : ''} · custom`
  };
  return {
    ...c,
    formulae: [...c.formulae, newFormula],
    spaces: [...c.spaces, newSpace],
    updatedAt: new Date().toISOString()
  };
}

/** Mark one formula (and its mirrored space) active; all others go inactive.
 *  Switching active in play takes a long turn of concentration (rules/18)
 *  — this helper just enforces the one-active invariant, the GM/player
 *  enforces the time cost in fiction. */
export function setActiveFormula(c: SWCharacter, formulaId: string): SWCharacter {
  return {
    ...c,
    formulae: c.formulae.map((f) => ({ ...f, active: f.id === formulaId })),
    spaces: c.spaces.map((s) =>
      s.kind === 'formula' ? { ...s, active: s.id === formulaId } : s
    ),
    updatedAt: new Date().toISOString()
  };
}

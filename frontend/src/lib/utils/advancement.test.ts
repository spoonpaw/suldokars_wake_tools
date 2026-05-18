import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from '$lib/models';
import type { AdvancementLogEntry, SessionLogEntry, SWCharacter } from '$lib/models/SWCharacter';
import type { TypeGraphNode } from '$lib/data/typeGraphs';
import { APT_GRAPH } from '$lib/data/typeGraphs';
import {
  applyNodeAdvancement,
  computeSpaceCountAfter,
  nodeGrants,
  rollbackAdvancement,
  validateAdvancementMove
} from './advancement';

let nextId = 1;
const idGen = () => `id-${nextId++}`;
const now = () => '2026-05-18T00:00:00.000Z';

function makeCharacterAtOrigo(): SWCharacter {
  // createDefaultCharacter seeds origin at (0,0), Apt origo, active default graph.
  const c = createDefaultCharacter();
  nextId = 1;
  return c;
}

function aptNodeAt(x: number, y: number): TypeGraphNode {
  const n = APT_GRAPH.nodes.find((node) => node.x === x && node.y === y);
  if (!n) throw new Error(`No Apt node at (${x}, ${y})`);
  return n;
}

function buildSessionEntry(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number }
): SessionLogEntry {
  return {
    id,
    loggedAt: now(),
    sessionLabel: 'Session 1',
    highestEncounterDegree: 3,
    notes: 'Encounter notes',
    shadowAtSessionStart: 0,
    moved: true,
    fromNode: from,
    toNode: to,
    direction: 'right'
  };
}

// ============================================
// Scenario 1: normal node advancement
// ============================================

describe('applyNodeAdvancement — normal node move', () => {
  it('writes a session entry and history entry, moves position, updates shadow/gunta', () => {
    const character = makeCharacterAtOrigo();
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    // wizardUpdated = character clone with NodeEffectsWizard mutations already
    // applied. For this test the wizard didn't change anything beyond what
    // applyNodeAdvancement adds on top (position / shadow / gunta / history).
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { updated, logEntry } = result;

    // Position + shadow/gunta updated from the target.
    expect(updated.typeGraphPosition).toEqual({ x: 1, y: 1 });
    expect(updated.shadow).toBe(1); // shadow = target.x
    expect(updated.guntaValue).toBe(1); // gunta = target.y

    // Session log appended (CREATE path).
    expect(updated.sessionLog).toHaveLength(1);
    expect(updated.sessionLog[0].id).toBe('s1');
    expect(updated.sessionLog[0].moved).toBe(true);

    // History entry written and marked reversible.
    expect(updated.advancementHistory).toHaveLength(1);
    expect(logEntry.reversible).toBe(true);
    expect(logEntry.kind).toBe('move');
    expect(logEntry.fromNode).toEqual({ x: 0, y: 0 });
    expect(logEntry.toNode).toEqual({ x: 1, y: 1 });
    expect(logEntry.sessionLogEntryId).toBe('s1');
    // beforeState captures pre-move shadow/gunta so rollback can restore.
    expect(logEntry.beforeState?.shadow).toBe(0);
    expect(logEntry.beforeState?.guntaValue).toBe(0);
  });

  it('marks prior history entries non-reversible when a new step is applied', () => {
    const character = makeCharacterAtOrigo();
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    // Seed a prior reversible entry.
    character.advancementHistory = [
      {
        id: 'old',
        fromNode: { x: 0, y: 0 },
        toNode: { x: 0, y: 0 },
        appliedAt: now(),
        changes: ['Origin'],
        reversible: true,
        beforeState: { shadow: 0, guntaValue: 0 }
      } as AdvancementLogEntry
    ];
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated.advancementHistory).toHaveLength(2);
    const oldEntry = result.updated.advancementHistory!.find((e) => e.id === 'old');
    expect(oldEntry?.reversible).toBe(false); // prior entry locked
    expect(result.updated.advancementHistory![1].reversible).toBe(true); // new tail reversible
  });

  it('omits empty notes from the log entry (no trailing empty-string)', () => {
    const character = makeCharacterAtOrigo();
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '   ', // whitespace-only must be treated as empty
      newId: idGen,
      now
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.logEntry.notes).toBeUndefined();
  });
});

// ============================================
// Scenario 2: promote existing no-move session
// ============================================

describe('applyNodeAdvancement — promote existing session', () => {
  it('replaces the no-move session in place (preserves loggedAt) and snapshots prior fields', () => {
    const character = makeCharacterAtOrigo();
    // Seed a no-move session that we'll later promote.
    const noMove: SessionLogEntry = {
      id: 'promote-me',
      loggedAt: '2026-05-01T00:00:00.000Z', // older timestamp — must be preserved by promote
      sessionLabel: 'Old label',
      highestEncounterDegree: 2,
      notes: 'Original notes',
      shadowAtSessionStart: 0,
      moved: false
    };
    character.sessionLog = [noMove];
    const target = aptNodeAt(1, 1);
    // Build the PROMOTE session — same id, now moved=true with edited label.
    const promoteSession: SessionLogEntry = {
      id: 'promote-me',
      loggedAt: noMove.loggedAt,
      sessionLabel: 'Edited label',
      highestEncounterDegree: 3,
      notes: 'Edited notes',
      shadowAtSessionStart: 0,
      moved: true,
      fromNode: { x: 0, y: 0 },
      toNode: { x: 1, y: 1 },
      direction: 'right'
    };
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: promoteSession,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { updated, logEntry } = result;
    expect(updated.sessionLog).toHaveLength(1); // REPLACE not append
    expect(updated.sessionLog[0].id).toBe('promote-me');
    expect(updated.sessionLog[0].moved).toBe(true);
    expect(updated.sessionLog[0].loggedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(updated.sessionLog[0].sessionLabel).toBe('Edited label');
    // Prior label/degree/notes captured for rollback.
    expect(logEntry.beforeState?.priorSession).toEqual({
      sessionLabel: 'Old label',
      highestEncounterDegree: 2,
      notes: 'Original notes'
    });
  });

  it('refuses with promote_already_moved when the target session has moved', () => {
    const character = makeCharacterAtOrigo();
    character.sessionLog = [
      {
        id: 'moved-already',
        loggedAt: now(),
        moved: true,
        fromNode: { x: 0, y: 0 },
        toNode: { x: 1, y: 0 }
      } as SessionLogEntry
    ];
    const session = buildSessionEntry('moved-already', { x: 0, y: 0 }, { x: 1, y: 1 });
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: aptNodeAt(1, 1),
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('promote_already_moved');
  });

  it('refuses with promote_already_tied when an advancement already references the session id', () => {
    const character = makeCharacterAtOrigo();
    character.sessionLog = [
      {
        id: 'tied',
        loggedAt: now(),
        moved: false,
        shadowAtSessionStart: 0
      } as SessionLogEntry
    ];
    character.advancementHistory = [
      {
        id: 'old',
        fromNode: { x: 0, y: 0 },
        toNode: { x: 0, y: 0 },
        appliedAt: now(),
        changes: [],
        reversible: false,
        sessionLogEntryId: 'tied'
      } as AdvancementLogEntry
    ];
    const session = buildSessionEntry('tied', { x: 0, y: 0 }, { x: 1, y: 1 });
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: aptNodeAt(1, 1),
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('promote_already_tied');
  });
});

// ============================================
// Scenario 3: rollback restores prior state
// ============================================

describe('rollbackAdvancement — undoes the most recent step', () => {
  it('restores position, shadow/gunta, and flips linked session back to moved=false', () => {
    const character = makeCharacterAtOrigo();
    // Apply a normal advancement.
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const applied = applyNodeAdvancement({
      character,
      wizardUpdated: JSON.parse(JSON.stringify(character)),
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const post = applied.updated;
    const back = rollbackAdvancement(post, applied.logEntry);

    expect(back.typeGraphPosition).toEqual({ x: 0, y: 0 });
    expect(back.shadow).toBe(0);
    expect(back.guntaValue).toBe(0);
    // Session record stays in the log (rollback only undoes the movement, not the record).
    expect(back.sessionLog).toHaveLength(1);
    expect(back.sessionLog[0].moved).toBe(false);
    expect(back.sessionLog[0].fromNode).toBeUndefined();
    expect(back.sessionLog[0].toNode).toBeUndefined();
    expect(back.sessionLog[0].direction).toBeUndefined();
    // History entry dropped.
    expect(back.advancementHistory).toHaveLength(0);
  });

  it('restores added spaces, added keywords, raised stack floors, bond + bond notes', () => {
    const character = makeCharacterAtOrigo();
    character.type = 'core';
    character.coreBond = 'holoh';
    character.coreBondNotes = 'original bond notes';
    character.spaces = [{ id: 'orig-space', active: true, kind: 'formula', name: 'Existing', effect: '' }];
    character.keywords = [
      { id: 'orig-kw', name: 'Existing KW', stack: 'tech', source: 'background' }
    ];
    character.stacks.close = 1;

    const newSpace = { id: 'sp-added', active: false, kind: 'formula' as const, name: 'Added', effect: '' };
    const newKeyword = { id: 'kw-added', name: 'Added KW', stack: 'speed' as const, source: 'advancement' as const };
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    wizardUpdated.spaces = [...character.spaces, newSpace];
    wizardUpdated.keywords = [...character.keywords, newKeyword];
    wizardUpdated.stacks.close = 4; // floor raise
    wizardUpdated.coreBond = 'subspace_nanites';
    wizardUpdated.coreBondNotes = 'swapped notes';
    const wizardBeforeState = {
      stacks: { close: 1 },
      spacesAddedIds: ['sp-added'],
      keywordsAddedIds: ['kw-added'],
      coreBond: 'holoh' as const,
      coreBondNotes: 'original bond notes'
    };
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const applied = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState,
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const back = rollbackAdvancement(applied.updated, applied.logEntry);

    // Added space dropped, original space kept.
    expect(back.spaces.map((s) => s.id)).toEqual(['orig-space']);
    // Added keyword dropped, original kept.
    expect(back.keywords.map((k) => k.id)).toEqual(['orig-kw']);
    // Floor raise reverted.
    expect(back.stacks.close).toBe(1);
    // Bond + notes restored.
    expect(back.coreBond).toBe('holoh');
    expect(back.coreBondNotes).toBe('original bond notes');
  });

  it('restores keyword rearrangements (previous stack assignments)', () => {
    const character = makeCharacterAtOrigo();
    character.keywords = [
      { id: 'kw1', name: 'Stealth', stack: 'speed', source: 'background' },
      { id: 'kw2', name: 'Crafting', stack: 'tech', source: 'background' }
    ];
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    wizardUpdated.keywords = wizardUpdated.keywords.map((k) =>
      k.id === 'kw1' ? { ...k, stack: 'morph' } : k
    );
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const applied = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {
        keywordRearrangements: [{ keywordId: 'kw1', previousStack: 'speed' }]
      },
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const back = rollbackAdvancement(applied.updated, applied.logEntry);
    const kw1 = back.keywords.find((k) => k.id === 'kw1');
    expect(kw1?.stack).toBe('speed');
  });

  it('restores promoted-session label/degree/notes from beforeState.priorSession', () => {
    const character = makeCharacterAtOrigo();
    const noMove: SessionLogEntry = {
      id: 'promote-me',
      loggedAt: '2026-05-01T00:00:00.000Z',
      sessionLabel: 'Original label',
      highestEncounterDegree: 2,
      notes: 'Original notes',
      shadowAtSessionStart: 0,
      moved: false
    };
    character.sessionLog = [noMove];
    const promoteSession: SessionLogEntry = {
      ...noMove,
      sessionLabel: 'Edited label',
      highestEncounterDegree: 3,
      notes: 'Edited notes',
      moved: true,
      fromNode: { x: 0, y: 0 },
      toNode: { x: 1, y: 1 },
      direction: 'right'
    };
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const applied = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: aptNodeAt(1, 1),
      sessionLogEntry: promoteSession,
      notes: '',
      newId: idGen,
      now
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const back = rollbackAdvancement(applied.updated, applied.logEntry);
    // Session stays in the log with original label/degree/notes restored.
    expect(back.sessionLog).toHaveLength(1);
    const sess = back.sessionLog[0];
    expect(sess.moved).toBe(false);
    expect(sess.sessionLabel).toBe('Original label');
    expect(sess.highestEncounterDegree).toBe(2);
    expect(sess.notes).toBe('Original notes');
    // loggedAt preserved through the whole promote/undo round-trip.
    expect(sess.loggedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('re-marks the new tail reversible only when it carries a beforeState snapshot', () => {
    const character = makeCharacterAtOrigo();
    // Seed a legacy entry without beforeState — should NOT become reversible after undo.
    character.advancementHistory = [
      {
        id: 'legacy-no-beforestate',
        fromNode: { x: 0, y: 0 },
        toNode: { x: 0, y: 0 },
        appliedAt: now(),
        changes: ['Legacy'],
        reversible: false
        // no beforeState
      } as AdvancementLogEntry
    ];
    // Apply a normal advancement on top of the legacy entry.
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const applied = applyNodeAdvancement({
      character,
      wizardUpdated: JSON.parse(JSON.stringify(character)),
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const back = rollbackAdvancement(applied.updated, applied.logEntry);
    expect(back.advancementHistory).toHaveLength(1);
    expect(back.advancementHistory![0].id).toBe('legacy-no-beforestate');
    // Tail stays non-reversible — better than lying.
    expect(back.advancementHistory![0].reversible).toBe(false);
  });

  it('is a no-op when entry.reversible is false', () => {
    const character = makeCharacterAtOrigo();
    character.typeGraphPosition = { x: 1, y: 1 };
    const entry: AdvancementLogEntry = {
      id: 'locked',
      fromNode: { x: 0, y: 0 },
      toNode: { x: 1, y: 1 },
      appliedAt: now(),
      changes: [],
      reversible: false
    };
    const back = rollbackAdvancement(character, entry);
    expect(back).toBe(character);
  });
});

// ============================================
// Scenario 4: stale modal confirm refused
// ============================================

describe('validateAdvancementMove — stale state guards', () => {
  it('passes when live position == session.fromNode AND target == session.toNode', () => {
    const character = makeCharacterAtOrigo();
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(validateAdvancementMove(character, session, target)).toBeNull();
  });

  it('refuses with stale_position when live position has shifted since the modal opened', () => {
    const character = makeCharacterAtOrigo();
    character.typeGraphPosition = { x: 1, y: 1 }; // moved between modal open + confirm
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(validateAdvancementMove(character, session, target)).toBe('stale_position');
  });

  it('refuses with wrong_target when targetNode coords disagree with session.toNode', () => {
    const character = makeCharacterAtOrigo();
    const realTarget = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(validateAdvancementMove(character, session, realTarget)).toBe('wrong_target');
  });
});

// ============================================
// Sticky-spaces + revisit re-apply (Mehrstam 2026-05-18 clarification)
// ============================================

describe('computeSpaceCountAfter — sticky spaces rule', () => {
  it('keeps the current count when the node has NO inner number (spaces=null)', () => {
    expect(computeSpaceCountAfter(0, null)).toBe(0);
    expect(computeSpaceCountAfter(3, null)).toBe(3);
    expect(computeSpaceCountAfter(7, null)).toBe(7);
  });

  it('raises to the node value when the node specifies a higher count', () => {
    expect(computeSpaceCountAfter(1, 3)).toBe(3);
    expect(computeSpaceCountAfter(0, 1)).toBe(1);
  });

  it('keeps the higher current count on revisit (never decreases)', () => {
    // Revisit: current is already 4, node says 2 — keep 4.
    expect(computeSpaceCountAfter(4, 2)).toBe(4);
    // Revisit numbered node at current count — no-op.
    expect(computeSpaceCountAfter(3, 3)).toBe(3);
  });
});

describe('nodeGrants — what re-applies on revisit (Mehrstam: bonuses re-apply)', () => {
  function node(kind: 'open' | 'double' | 'filled' | 'double_filled'): TypeGraphNode {
    return { x: 1, y: 1, spaces: null, kind };
  }

  it('open nodes grant nothing — no prompts on visit or revisit', () => {
    const g = nodeGrants(node('open'), 'apt');
    expect(g.grantsKeyword).toBe(false);
    expect(g.grantsRearrange).toBe(false);
    expect(g.grantsBondSwap).toBe(false);
  });

  it('double / double_filled nodes prompt for a new keyword (every visit)', () => {
    expect(nodeGrants(node('double'), 'apt').grantsKeyword).toBe(true);
    expect(nodeGrants(node('double_filled'), 'apt').grantsKeyword).toBe(true);
  });

  it('filled / double_filled nodes prompt for a rearrange (every visit)', () => {
    expect(nodeGrants(node('filled'), 'apt').grantsRearrange).toBe(true);
    expect(nodeGrants(node('double_filled'), 'apt').grantsRearrange).toBe(true);
    expect(nodeGrants(node('double'), 'apt').grantsRearrange).toBe(false);
  });

  it('grantsBondSwap fires ONLY for Core characters on filled / double_filled nodes', () => {
    expect(nodeGrants(node('filled'), 'core').grantsBondSwap).toBe(true);
    expect(nodeGrants(node('double_filled'), 'core').grantsBondSwap).toBe(true);
    expect(nodeGrants(node('filled'), 'apt').grantsBondSwap).toBe(false);
    expect(nodeGrants(node('filled'), 'prime').grantsBondSwap).toBe(false);
    expect(nodeGrants(node('double'), 'core').grantsBondSwap).toBe(false);
  });
});

describe('applyNodeAdvancement — stale modal confirm is refused (Scenario 4)', () => {
  it('refuses with stale_position when the character has moved since the modal opened', () => {
    const character = makeCharacterAtOrigo();
    character.typeGraphPosition = { x: 1, y: 1 }; // shifted while the modal was open
    const target = aptNodeAt(1, 1);
    const session = buildSessionEntry('s1', { x: 0, y: 0 }, { x: 1, y: 1 });
    const wizardUpdated: SWCharacter = JSON.parse(JSON.stringify(character));
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState: {},
      targetNode: target,
      sessionLogEntry: session,
      notes: '',
      newId: idGen,
      now
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('stale_position');
  });
});

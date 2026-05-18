/**
 * advancement.ts — pure helpers behind the type-graph advancement flow.
 *
 * Extracted from AdvancementPanel.svelte (rollback) and
 * AdvancementModal.svelte (apply). Components used to host this logic
 * inline; extracting lets us unit-test the state-machine + rollback paths
 * (the riskiest data-mutation surface in the app — corrupt advancement
 * history silently invalidates a character).
 *
 * Three exports:
 *   - applyNodeAdvancement: writes both a SessionLogEntry and an
 *     AdvancementLogEntry for a normal node advancement (rules/52,
 *     strict no-banking). Re-validates the move against the live
 *     character position before mutating, refuses if stale or if a
 *     promote target was already moved / already tied to another
 *     history entry.
 *   - rollbackAdvancement: undoes the most recent advancement entry,
 *     restoring position / shadow / gunta / stack composition / added
 *     spaces+keywords / bond + notes / promoted-session label-degree-notes.
 *   - validateAdvancementMove: the live-position check shared with the
 *     modal — the target must be a legal neighbour AND match the
 *     pre-built session entry.
 */

import type { SWCharacter, AdvancementLogEntry, SessionLogEntry } from '$lib/models/SWCharacter';
import type { TypeGraphNode } from '$lib/data/typeGraphs';
import type { CharacterType } from '$lib/models/Enums';
import { isLegalNextNode } from '$lib/data/typeGraphs';
import { getActiveGraph } from './graphLibrary';

// ============================================
// NODE-EFFECT QUERIES (used by the wizard UI + tests)
// ============================================

/**
 * Resolve the space count AFTER arriving at a node.
 *
 * Per Christian Mehrstam's rules clarification (2026-05-18): spaces are
 * "sticky" — when a node has NO inner number (`spaces === null`), the
 * character keeps their previous count. When a node DOES specify a value,
 * the count is raised to that value (or kept higher if the character is
 * already above it). Spaces never decrease through advancement, and
 * revisiting a numbered node is a no-op for the count.
 */
export function computeSpaceCountAfter(currentSpaceCount: number, nodeSpaces: number | null): number {
  if (nodeSpaces === null) return currentSpaceCount;
  return Math.max(currentSpaceCount, nodeSpaces);
}

/** What a node grants by `kind` (and the character's type for bond-swap eligibility). */
export interface NodeGrants {
  grantsKeyword: boolean;
  grantsRearrange: boolean;
  /** Core characters only — bond swap fires on the same kinds as rearrange. */
  grantsBondSwap: boolean;
}

/**
 * Per Christian Mehrstam's rules clarification (2026-05-18): a character
 * MAY revisit a previously-passed node, and its bonuses RE-APPLY each
 * time. `nodeGrants` returns the per-kind grant set the wizard prompts
 * for on every visit — there is no first-visit-only gate.
 */
export function nodeGrants(node: TypeGraphNode, characterType: CharacterType): NodeGrants {
  const grantsKeyword = node.kind === 'double' || node.kind === 'double_filled';
  const grantsRearrange = node.kind === 'filled' || node.kind === 'double_filled';
  const grantsBondSwap = characterType === 'core' && grantsRearrange;
  return { grantsKeyword, grantsRearrange, grantsBondSwap };
}

// ============================================
// VALIDATION
// ============================================

export type AdvancementRefusalReason =
  | 'stale_position'
  | 'wrong_target'
  | 'illegal_neighbor'
  | 'promote_already_moved'
  | 'promote_already_tied';

/**
 * Re-validate a take-step against the LIVE character position AND the
 * pre-built SessionLogEntry. Per rules/52 strict no-banking the live
 * position must equal sessionLogEntry.fromNode, targetNode must equal
 * sessionLogEntry.toNode, and the target must still be a plotted node
 * within Manhattan 2 of the current position on the active graph.
 */
export function validateAdvancementMove(
  character: SWCharacter,
  sessionLogEntry: SessionLogEntry,
  targetNode: TypeGraphNode
): AdvancementRefusalReason | null {
  const px = character.typeGraphPosition?.x ?? 0;
  const py = character.typeGraphPosition?.y ?? 0;
  const from = sessionLogEntry.fromNode;
  const to = sessionLogEntry.toNode;
  if (!from || !to) return 'stale_position';
  if (px !== from.x || py !== from.y) return 'stale_position';
  if (targetNode.x !== to.x || targetNode.y !== to.y) return 'wrong_target';
  if (!isLegalNextNode(getActiveGraph(character), { x: px, y: py }, targetNode)) {
    return 'illegal_neighbor';
  }
  return null;
}

// ============================================
// APPLY (node advancement)
// ============================================

export interface ApplyNodeAdvancementInput {
  character: SWCharacter;
  /** Clone of `character` already mutated by NodeEffectsWizard (floors / spaces / keywords / bond / etc.) */
  wizardUpdated: SWCharacter;
  /** Before-state recorded by NodeEffectsWizard (composition / spaces added / keywords added / bond ...). */
  wizardBeforeState: NonNullable<AdvancementLogEntry['beforeState']>;
  targetNode: TypeGraphNode;
  sessionLogEntry: SessionLogEntry;
  notes?: string;
  /** Id factory — pass a deterministic one in tests. */
  newId: () => string;
  /** Current ISO timestamp — pass a deterministic one in tests. */
  now: () => string;
}

export type ApplyNodeAdvancementResult =
  | { ok: true; updated: SWCharacter; logEntry: AdvancementLogEntry }
  | { ok: false; reason: AdvancementRefusalReason };

/**
 * Compose the move-side mutations on top of the wizard's `updated` clone
 * and produce the matching AdvancementLogEntry. Refuses with a reason
 * code if the move is stale or the promote target conflicts.
 */
export function applyNodeAdvancement(input: ApplyNodeAdvancementInput): ApplyNodeAdvancementResult {
  const {
    character,
    wizardUpdated,
    wizardBeforeState,
    targetNode,
    sessionLogEntry,
    notes,
    newId,
    now
  } = input;

  const validation = validateAdvancementMove(character, sessionLogEntry, targetNode);
  if (validation) return { ok: false, reason: validation };

  const fromNode = {
    x: character.typeGraphPosition?.x ?? 0,
    y: character.typeGraphPosition?.y ?? 0
  };

  const updated: SWCharacter = wizardUpdated;
  const beforeState: NonNullable<AdvancementLogEntry['beforeState']> = {
    ...wizardBeforeState,
    shadow: character.shadow,
    guntaValue: character.guntaValue
  };

  updated.typeGraphPosition = { x: targetNode.x, y: targetNode.y };
  updated.shadow = targetNode.x;
  updated.guntaValue = targetNode.y;

  // Promote vs create: if the session id already exists in sessionLog,
  // re-validate the entry is still promotable (moved=false, not tied
  // to a prior advancement) and REPLACE it in place. Otherwise append.
  const existingIdx = (updated.sessionLog ?? []).findIndex((e) => e.id === sessionLogEntry.id);
  let priorSessionSnapshot: NonNullable<AdvancementLogEntry['beforeState']>['priorSession'] | undefined;

  if (existingIdx >= 0) {
    const existing = updated.sessionLog![existingIdx];
    if (existing.moved) return { ok: false, reason: 'promote_already_moved' };
    const alreadyTied = (updated.advancementHistory ?? []).some(
      (h) => h.sessionLogEntryId === existing.id
    );
    if (alreadyTied) return { ok: false, reason: 'promote_already_tied' };
    priorSessionSnapshot = {
      sessionLabel: existing.sessionLabel,
      highestEncounterDegree: existing.highestEncounterDegree,
      notes: existing.notes
    };
    updated.sessionLog = (updated.sessionLog ?? []).map((e, i) =>
      i === existingIdx ? { ...sessionLogEntry } : e
    );
  } else {
    updated.sessionLog = [...(updated.sessionLog ?? []), { ...sessionLogEntry }];
  }
  if (priorSessionSnapshot) {
    beforeState.priorSession = priorSessionSnapshot;
  }

  // Human-readable changes list — used by the history panel.
  const changes: string[] = [];
  changes.push(`Moved (${fromNode.x}, ${fromNode.y}) → (${targetNode.x}, ${targetNode.y})`);
  changes.push(`Shadow ${fromNode.x} → ${targetNode.x}`);
  changes.push(`Gunta ${fromNode.y} → ${targetNode.y}`);
  if (beforeState.stacks?.close !== undefined) {
    changes.push(`Close ${beforeState.stacks.close} → ${updated.stacks.close}`);
  }
  if (beforeState.stacks?.ranged !== undefined) {
    changes.push(`Ranged ${beforeState.stacks.ranged} → ${updated.stacks.ranged}`);
  }
  if (beforeState.implantsCap !== undefined) {
    changes.push(`Implants cap ${beforeState.implantsCap} → ${updated.origo.implants}`);
  }
  if (beforeState.spacesAddedIds && beforeState.spacesAddedIds.length > 0) {
    const n = beforeState.spacesAddedIds.length;
    changes.push(`Added ${n} empty space slot${n === 1 ? '' : 's'}`);
  }
  if (beforeState.keywordsAddedIds && beforeState.keywordsAddedIds.length > 0) {
    for (const id of beforeState.keywordsAddedIds) {
      const kw = updated.keywords.find((k) => k.id === id);
      if (kw) {
        const provenance =
          kw.fromBackground && kw.fromBackground !== character.background
            ? `cross from ${kw.fromBackground}`
            : 'own bg';
        changes.push(`New keyword: ${kw.name} (${kw.stack}, ${provenance})`);
      }
    }
  }
  if (beforeState.keywordRearrangements && beforeState.keywordRearrangements.length > 0) {
    const moved: string[] = [];
    for (const r of beforeState.keywordRearrangements) {
      const kw = updated.keywords.find((k) => k.id === r.keywordId);
      if (kw) moved.push(`${kw.name}: ${r.previousStack} → ${kw.stack}`);
    }
    if (moved.length > 0) changes.push(`Rearranged: ${moved.join('; ')}`);
  }
  if (beforeState.coreBond !== undefined) {
    changes.push(`Bond swap: ${beforeState.coreBond} → ${updated.coreBond}`);
  }

  // Mark prior history non-reversible — only the latest advancement is undoable.
  const priorHistory = (updated.advancementHistory ?? []).map((e) => ({
    ...e,
    reversible: false
  }));
  const trimmedNotes = (notes ?? '').trim();
  const logEntry: AdvancementLogEntry = {
    id: newId(),
    kind: 'move',
    fromNode: { x: fromNode.x, y: fromNode.y },
    toNode: { x: targetNode.x, y: targetNode.y },
    appliedAt: now(),
    changes,
    notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
    sessionLogEntryId: sessionLogEntry.id,
    reversible: true,
    beforeState
  };
  updated.advancementHistory = [...priorHistory, logEntry];
  updated.updatedAt = now();

  return { ok: true, updated, logEntry };
}

// ============================================
// ROLLBACK
// ============================================

/**
 * Undo a reversible advancement entry. Returns a new character with
 * position / shadow / gunta / stack composition / added spaces+keywords /
 * bond+notes restored, the linked SessionLogEntry flipped back to
 * moved=false (and pre-promote label/degree/notes restored if recorded),
 * and the entry dropped from advancementHistory. The new tail (if any)
 * is re-marked reversible, but ONLY when it carries a beforeState
 * snapshot — otherwise a chained undo would silently leave non-position
 * changes orphaned.
 *
 * No-op when `entry.reversible` is false.
 */
export function rollbackAdvancement(character: SWCharacter, entry: AdvancementLogEntry): SWCharacter {
  if (!entry.reversible) return character;
  const updated: SWCharacter = JSON.parse(JSON.stringify(character));

  // Graph-swap entries — restore the prior activeGraphId if it still exists.
  if (entry.kind === 'graph_swap' && entry.graphSwap) {
    const stillExists = (updated.ownedGraphs ?? []).some(
      (og) => og.id === entry.graphSwap!.fromGraphId
    );
    if (stillExists) {
      updated.activeGraphId = entry.graphSwap.fromGraphId;
    } else {
      const fallback = (updated.ownedGraphs ?? [])[0]?.id;
      if (fallback) updated.activeGraphId = fallback;
    }
  }

  // Position + shadow/gunta — fall back to current values when beforeState
  // omits them (an intermediate-cell move that never bumped them).
  updated.typeGraphPosition = { x: entry.fromNode.x, y: entry.fromNode.y };
  updated.shadow = entry.beforeState?.shadow ?? character.shadow;
  updated.guntaValue = entry.beforeState?.guntaValue ?? character.guntaValue;

  // Revert raised stack floors.
  if (entry.beforeState?.stacks) {
    for (const [k, v] of Object.entries(entry.beforeState.stacks)) {
      if (typeof v === 'number') {
        (updated.stacks as unknown as Record<string, number>)[k] = v;
      }
    }
  }
  if (entry.beforeState?.implantsCap !== undefined) {
    updated.origo.implants = entry.beforeState.implantsCap;
  }

  // Remove spaces / keywords this entry added (by id, not by name).
  if (entry.beforeState?.spacesAddedIds?.length) {
    const drop = new Set(entry.beforeState.spacesAddedIds);
    updated.spaces = updated.spaces.filter((s) => !drop.has(s.id));
  }
  if (entry.beforeState?.keywordsAddedIds?.length) {
    const drop = new Set(entry.beforeState.keywordsAddedIds);
    updated.keywords = updated.keywords.filter((k) => !drop.has(k.id));
  }

  // Restore prior keyword stack assignments (rearrange undo).
  if (entry.beforeState?.keywordRearrangements?.length) {
    const map = new Map(
      entry.beforeState.keywordRearrangements.map((r) => [r.keywordId, r.previousStack])
    );
    updated.keywords = updated.keywords.map((k) =>
      map.has(k.id) ? { ...k, stack: map.get(k.id)! } : k
    );
  }

  // Restore prior bond + notes (so swap-then-undo round-trips bring back
  // any notes the player wrote before the swap).
  if (entry.beforeState?.coreBond !== undefined) {
    updated.coreBond = entry.beforeState.coreBond;
    updated.coreBondNotes = entry.beforeState.coreBondNotes ?? '';
  }

  // Restore composition slots (paired with the `stacks` revert above).
  if (entry.beforeState?.stackComposition) {
    const restored = { ...(updated.stackComposition ?? {}) };
    for (const [k, v] of Object.entries(entry.beforeState.stackComposition)) {
      if (v) (restored as Record<string, typeof v>)[k] = v;
    }
    updated.stackComposition = restored as typeof updated.stackComposition;
  }

  // Flip the linked SessionLogEntry back to moved=false and clear the
  // move-detail fields. The session itself stays in the log. For PROMOTE
  // entries also restore the pre-promote label / degree / notes.
  if (entry.sessionLogEntryId) {
    const targetId = entry.sessionLogEntryId;
    const priorSession = entry.beforeState?.priorSession;
    updated.sessionLog = (updated.sessionLog ?? []).map((e) =>
      e.id === targetId
        ? {
            ...e,
            moved: false,
            fromNode: undefined,
            toNode: undefined,
            direction: undefined,
            ...(priorSession
              ? {
                  sessionLabel: priorSession.sessionLabel,
                  highestEncounterDegree: priorSession.highestEncounterDegree,
                  notes: priorSession.notes
                }
              : {})
          }
        : e
    );
  }

  // Drop the rolled-back history entry; re-mark the new tail as
  // reversible — but ONLY if it carries a beforeState snapshot. Legacy
  // entries without one would only revert position/shadow/gunta, silently
  // leaving stack / space / keyword / bond changes orphaned on a chained
  // undo. Better to leave the tail non-reversible than to lie about it.
  const remaining = (updated.advancementHistory ?? []).filter((e) => e.id !== entry.id);
  if (remaining.length > 0) {
    const tail = remaining[remaining.length - 1];
    if (tail.beforeState) {
      remaining[remaining.length - 1] = { ...tail, reversible: true };
    }
  }
  updated.advancementHistory = remaining;
  updated.updatedAt = new Date().toISOString();
  return updated;
}

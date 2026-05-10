<!--
  AdvancementModal.svelte — orchestrates a normal type-graph advancement
  step. Walks the player through the node's effects via NodeEffectsWizard,
  then composes the move-side mutations (position / shadow / gunta) and
  writes both a SessionLogEntry and an AdvancementLogEntry.

  WORKFLOW
  ========
  Triggered when the player clicks a legal-neighbor node in the take-step
  modal. The shared NodeEffectsWizard handles:
    - Effect summary
    - Stack floors (Close / Ranged / Implants cap)
    - New space slots
    - New keyword pick (double / double_filled)
    - Rearrange existing keywords (filled / double_filled)
    - Bond swap (Core, filled / double_filled)
    - Confirm step (with the optional notes textarea rendered here)

  After the wizard's onconfirm fires, this component:
    - Re-validates the move against the live character position + the
      pre-built SessionLogEntry (no banking — rules/52).
    - Updates typeGraphPosition / shadow / guntaValue on the wizard's
      `updated` clone.
    - Appends or promotes the SessionLogEntry into character.sessionLog.
    - Builds the AdvancementLogEntry with kind: 'move' and the
      beforeState the wizard captured.
    - Persists via the parent panel callback.
-->
<script lang="ts">
  import type { SWCharacter, AdvancementLogEntry, SessionLogEntry } from '$lib/models/SWCharacter';
  import type { TypeGraphNode } from '$lib/data/typeGraphs';
  import { isLegalNextNode } from '$lib/data/typeGraphs';
  import { getActiveGraph } from '$lib/utils/graphLibrary';
  import NodeEffectsWizard from './advancement/NodeEffectsWizard.svelte';

  interface Props {
    open: boolean;
    character: SWCharacter;
    targetNode: TypeGraphNode;
    /**
     * The SessionLogEntry that powers this advancement. Pre-built by the
     * panel and threaded through so the modal can write it (with
     * `moved: true` and the from/to/direction fields) alongside the
     * AdvancementLogEntry. Rollback later flips this entry's `moved`
     * back to false.
     */
    sessionLogEntry: SessionLogEntry;
    onclose: () => void;
    onconfirm: (updated: SWCharacter, logEntry: AdvancementLogEntry) => void;
  }

  let { open, character, targetNode, sessionLogEntry, onclose, onconfirm }: Props = $props();

  const fromNode = $derived({
    x: character.typeGraphPosition?.x ?? 0,
    y: character.typeGraphPosition?.y ?? 0
  });

  /** Player annotation — "what was the Shadow Encounter?" */
  let notesText = $state('');
  $effect(() => {
    if (open) notesText = '';
  });

  function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Re-validate the move against the LIVE character position AND the
   * pre-built SessionLogEntry. Per rules/52 strict no-banking, each
   * advancement is exactly one orthogonal step from the position the
   * panel captured when the player opened the take-step modal — if the
   * character moved between the panel's snapshot and the modal's apply
   * (e.g. another tab updated state, or rollback fired), confirming
   * would write inconsistent history. Three checks:
   *   1. The live character position must equal sessionLogEntry.fromNode.
   *   2. The targetNode coords must equal sessionLogEntry.toNode.
   *   3. The target must still be a plotted node on the current graph.
   * If any check fails, refuse to apply.
   */
  function targetIsLegalNeighbor(): boolean {
    const px = character.typeGraphPosition?.x ?? 0;
    const py = character.typeGraphPosition?.y ?? 0;
    const from = sessionLogEntry.fromNode;
    const to = sessionLogEntry.toNode;
    if (!from || !to) return false;
    if (px !== from.x || py !== from.y) return false;
    if (targetNode.x !== to.x || targetNode.y !== to.y) return false;
    return isLegalNextNode(getActiveGraph(character), { x: px, y: py }, targetNode);
  }

  function handleWizardConfirm(
    wizardUpdated: SWCharacter,
    wizardBeforeState: NonNullable<AdvancementLogEntry['beforeState']>
  ) {
    // Re-validate legality against live character position.
    if (!targetIsLegalNeighbor()) {
      console.warn('[AdvancementModal] Target node no longer a legal neighbor; refusing to apply.');
      onclose();
      return;
    }
    // No session-id spend validation — the strict no-banking model
    // (rules/52) trusts the player. Each "Take advancement step" click is
    // one session worth one orthogonal step. This modal is only opened
    // from the panel after the player has already committed to taking
    // the step; we don't second-guess `degree > shadow` at log time.

    // Compose move-side mutations onto the wizard's updated clone.
    const updated: SWCharacter = wizardUpdated;
    const beforeState: NonNullable<AdvancementLogEntry['beforeState']> = {
      ...wizardBeforeState,
      shadow: character.shadow,
      guntaValue: character.guntaValue
    };
    updated.typeGraphPosition = { x: targetNode.x, y: targetNode.y };
    updated.shadow = targetNode.x;
    updated.guntaValue = targetNode.y;

    // Write the SessionLogEntry that powers this advancement. Two cases:
    //   - CREATE: the session id is brand-new (not in sessionLog yet) —
    //     append a new entry.
    //   - PROMOTE: the session id already exists in sessionLog (the
    //     panel reused an existing no-move entry) — REPLACE it in
    //     place, preserving its position in the list (and its
    //     loggedAt).
    // PROMOTE liveness re-validation: the panel checked moved=false and
    // not-tied at openPromoteSession-time, but the modal can be open for
    // a long time while the player walks the wizard. We re-check here
    // to refuse double-promote / orphan writes:
    //   a. The existing entry is moved=false (still promotable).
    //   b. No advancementHistory entry already references this id.
    // If either fails, refuse to apply.
    // Rollback later flips this entry back to `moved: false`, clears
    // the move-detail fields, AND restores priorSession (label/degree/
    // notes) so audit-trail edits round-trip cleanly.
    const existingIdx = (updated.sessionLog ?? []).findIndex(
      (e) => e.id === sessionLogEntry.id
    );
    let priorSessionSnapshot:
      | NonNullable<AdvancementLogEntry['beforeState']>['priorSession']
      | undefined;
    if (existingIdx >= 0) {
      const existing = updated.sessionLog![existingIdx];
      if (existing.moved) {
        console.warn('[AdvancementModal] Promote target already moved; refusing to apply.');
        onclose();
        return;
      }
      const alreadyTied = (updated.advancementHistory ?? []).some(
        (h) => h.sessionLogEntryId === existing.id
      );
      if (alreadyTied) {
        console.warn('[AdvancementModal] Promote target already tied to an advancement; refusing.');
        onclose();
        return;
      }
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

    // Build the human-readable changes list (move + effect lines).
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
          // Provenance: own-background vs cross-pick. The wizard sets
          // kw.source='advancement' for both, so derive from fromBackground.
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

    // Mark prior history non-reversible — only the most recent advancement
    // can be safely undone.
    const priorHistory = (updated.advancementHistory ?? []).map((e) => ({
      ...e,
      reversible: false
    }));
    const logEntry: AdvancementLogEntry = {
      id: newId(),
      kind: 'move',
      fromNode: { x: fromNode.x, y: fromNode.y },
      toNode: { x: targetNode.x, y: targetNode.y },
      appliedAt: new Date().toISOString(),
      changes,
      notes: notesText.trim() || undefined,
      sessionLogEntryId: sessionLogEntry.id,
      reversible: true,
      beforeState
    };
    updated.advancementHistory = [...priorHistory, logEntry];
    updated.updatedAt = new Date().toISOString();

    onconfirm(updated, logEntry);
  }
</script>

<NodeEffectsWizard
  {open}
  {character}
  {targetNode}
  mode="move"
  title={`Advance to (${targetNode.x}, ${targetNode.y})`}
  applyLabel="Apply &amp; advance"
  onconfirm={handleWizardConfirm}
  oncancel={onclose}
>
  {#snippet confirmExtra()}
    <label class="block text-xs text-neutral-400">
      <span>Optional notes (the qualifying session / shadow encounter that earned this step):</span>
      <textarea
        bind:value={notesText}
        rows="2"
        class="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none"
      ></textarea>
    </label>
  {/snippet}
</NodeEffectsWizard>

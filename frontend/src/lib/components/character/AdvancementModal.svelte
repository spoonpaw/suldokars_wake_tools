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
  import { applyNodeAdvancement } from '$lib/utils/advancement';
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

  function handleWizardConfirm(
    wizardUpdated: SWCharacter,
    wizardBeforeState: NonNullable<AdvancementLogEntry['beforeState']>
  ) {
    const result = applyNodeAdvancement({
      character,
      wizardUpdated,
      wizardBeforeState,
      targetNode,
      sessionLogEntry,
      notes: notesText,
      newId,
      now: () => new Date().toISOString()
    });
    if (result.ok === false) {
      console.warn(`[AdvancementModal] Refusing to apply: ${result.reason}`);
      onclose();
      return;
    }
    onconfirm(result.updated, result.logEntry);
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

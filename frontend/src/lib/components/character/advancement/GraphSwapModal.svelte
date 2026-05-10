<!--
  GraphSwapModal.svelte — confirms a graph swap and (when the new graph
  has a node at the character's current coord) applies that node's
  effects without spending a session.

  Triggered when the player picks "Make active" on a non-active OwnedGraph.

  Two cases:

    1. The new graph has NO node at the character's current coord.
       Render a small confirm-only modal — just swaps the active graph;
       no stat/space mutations.

    2. The new graph DOES have a node at the current coord. Mount the
       shared NodeEffectsWizard with mode='graph_swap' so the swap walks
       the same step sequence as a normal advancement. The character
       treats it as if they had just traversed to that node — without
       spending a session.

  All applied changes are recorded in beforeState so the AdvancementPanel
  rollback handler can revert them (including the active graph id swap).
-->
<script lang="ts">
  import type { SWCharacter, AdvancementLogEntry, OwnedGraph } from '$lib/models/SWCharacter';
  import type { TypeGraphNode } from '$lib/data/typeGraphs';
  import { findNodeAt } from '$lib/data/typeGraphs';
  import { Button, Modal, Badge } from '$lib/components/ui';
  import NodeEffectsWizard from './NodeEffectsWizard.svelte';

  interface Props {
    open: boolean;
    character: SWCharacter;
    /** Id of the graph the player wants to make active. */
    toGraphId: string;
    onclose: () => void;
    onConfirm: (updated: SWCharacter, log: AdvancementLogEntry) => void;
  }

  let { open, character, toGraphId, onclose, onConfirm }: Props = $props();

  function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const fromGraphId = $derived(character.activeGraphId ?? '');
  const fromEntry = $derived<OwnedGraph | null>(
    (character.ownedGraphs ?? []).find((g) => g.id === fromGraphId) ?? null
  );
  const toEntry = $derived<OwnedGraph | null>(
    (character.ownedGraphs ?? []).find((g) => g.id === toGraphId) ?? null
  );
  const pos = $derived({
    x: character.typeGraphPosition?.x ?? 0,
    y: character.typeGraphPosition?.y ?? 0
  });
  const appliedNode = $derived<TypeGraphNode | null>(
    toEntry ? findNodeAt(toEntry.graph, pos) : null
  );

  let applying = $state(false);
  $effect(() => {
    if (open) applying = false;
  });

  /**
   * Compose the wizard's `updated` clone + `beforeState` with the
   * graph-swap mutations: flip activeGraphId, build the kind='graph_swap'
   * AdvancementLogEntry, hand back to the parent panel.
   */
  function handleWizardConfirm(
    wizardUpdated: SWCharacter,
    wizardBeforeState: NonNullable<AdvancementLogEntry['beforeState']>
  ) {
    if (!toEntry) {
      onclose();
      return;
    }
    const updated: SWCharacter = wizardUpdated;
    updated.activeGraphId = toGraphId;

    // Build the human-readable changes list — swap line first, then any
    // wizard effects.
    const changes: string[] = [];
    changes.push(
      `Active graph: ${fromEntry?.name ?? '<unknown>'} → ${toEntry.name}`
    );
    if (appliedNode) {
      changes.push(`Node at (${appliedNode.x}, ${appliedNode.y}) on new graph applied.`);
      if (wizardBeforeState.stacks?.close !== undefined) {
        changes.push(`Close ${wizardBeforeState.stacks.close} → ${updated.stacks.close}`);
      }
      if (wizardBeforeState.stacks?.ranged !== undefined) {
        changes.push(`Ranged ${wizardBeforeState.stacks.ranged} → ${updated.stacks.ranged}`);
      }
      if (wizardBeforeState.implantsCap !== undefined) {
        changes.push(
          `Implants cap ${wizardBeforeState.implantsCap} → ${updated.origo.implants}`
        );
      }
      if (wizardBeforeState.spacesAddedIds && wizardBeforeState.spacesAddedIds.length > 0) {
        const n = wizardBeforeState.spacesAddedIds.length;
        changes.push(`Added ${n} empty space slot${n === 1 ? '' : 's'}`);
      }
      if (wizardBeforeState.keywordsAddedIds && wizardBeforeState.keywordsAddedIds.length > 0) {
        for (const id of wizardBeforeState.keywordsAddedIds) {
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
      if (
        wizardBeforeState.keywordRearrangements &&
        wizardBeforeState.keywordRearrangements.length > 0
      ) {
        const moved: string[] = [];
        for (const r of wizardBeforeState.keywordRearrangements) {
          const kw = updated.keywords.find((k) => k.id === r.keywordId);
          if (kw) moved.push(`${kw.name}: ${r.previousStack} → ${kw.stack}`);
        }
        if (moved.length > 0) changes.push(`Rearranged: ${moved.join('; ')}`);
      }
      if (wizardBeforeState.coreBond !== undefined) {
        changes.push(`Bond swap: ${wizardBeforeState.coreBond} → ${updated.coreBond}`);
      }
    } else {
      changes.push('No node at current coord on new graph — no effects applied.');
    }

    const priorHistory = (updated.advancementHistory ?? []).map((h) => ({
      ...h,
      reversible: false
    }));
    const logEntry: AdvancementLogEntry = {
      id: newId(),
      kind: 'graph_swap',
      fromNode: pos,
      toNode: pos,
      appliedAt: new Date().toISOString(),
      changes,
      reversible: true,
      beforeState: wizardBeforeState,
      graphSwap: {
        fromGraphId,
        toGraphId,
        appliedNode: appliedNode ?? undefined
      }
    };
    updated.advancementHistory = [...priorHistory, logEntry];
    updated.updatedAt = new Date().toISOString();

    onConfirm(updated, logEntry);
  }

  /**
   * Confirm path for the no-node case — straight swap, no wizard. Builds
   * an empty beforeState (consistent shape with the wizard path) so the
   * rollback code reads `stacks: {}` either way.
   */
  function confirmSwapNoNode() {
    if (!toEntry || applying) return;
    applying = true;
    const updated: SWCharacter = JSON.parse(JSON.stringify(character));
    updated.activeGraphId = toGraphId;

    const changes: string[] = [
      `Active graph: ${fromEntry?.name ?? '<unknown>'} → ${toEntry.name}`,
      'No node at current coord on new graph — no effects applied.'
    ];
    const priorHistory = (updated.advancementHistory ?? []).map((h) => ({
      ...h,
      reversible: false
    }));
    const logEntry: AdvancementLogEntry = {
      id: newId(),
      kind: 'graph_swap',
      fromNode: pos,
      toNode: pos,
      appliedAt: new Date().toISOString(),
      changes,
      reversible: true,
      beforeState: { stacks: {} },
      graphSwap: { fromGraphId, toGraphId }
    };
    updated.advancementHistory = [...priorHistory, logEntry];
    updated.updatedAt = new Date().toISOString();

    onConfirm(updated, logEntry);
  }
</script>

{#if !toEntry}
  <Modal {open} title="Swap active graph" {onclose}>
    {#snippet children()}
      <p class="text-sm text-neutral-400">Target graph not found.</p>
    {/snippet}
    {#snippet footer()}
      <Button onclick={onclose}>Close</Button>
    {/snippet}
  </Modal>
{:else if appliedNode}
  <NodeEffectsWizard
    {open}
    {character}
    targetNode={appliedNode}
    mode="graph_swap"
    title="Swap active graph"
    applyLabel="Confirm swap"
    onconfirm={handleWizardConfirm}
    oncancel={onclose}
  >
    {#snippet summaryHeader()}
      <p>
        Swap active graph:
        <strong class="text-neutral-100">{fromEntry?.name ?? '<unknown>'}</strong>
        → <strong class="text-cyan-200">{toEntry.name}</strong>
      </p>
      <p>Current position: <strong class="text-neutral-100">({pos.x}, {pos.y})</strong></p>
      <div class="rounded-lg border border-cyan-700/40 bg-cyan-900/10 p-2 text-xs">
        <p class="text-cyan-100">
          <Badge variant="info">node at coord</Badge>
          The new graph has a plotted node at this position. Confirming will
          apply its effects without spending a session — you treat it as if
          you had just traversed to that node.
        </p>
      </div>
    {/snippet}
  </NodeEffectsWizard>
{:else}
  <Modal {open} title="Swap active graph" {onclose}>
    {#snippet children()}
      <div class="space-y-3 text-sm text-neutral-300">
        <p>
          Swap active graph:
          <strong class="text-neutral-100">{fromEntry?.name ?? '<unknown>'}</strong>
          → <strong class="text-cyan-200">{toEntry.name}</strong>
        </p>
        <p>Current position: <strong class="text-neutral-100">({pos.x}, {pos.y})</strong></p>
        <div class="rounded-lg border border-neutral-700 bg-neutral-800/40 p-2 text-xs">
          <Badge variant="warning">no node at coord</Badge>
          <span class="ml-1 text-neutral-300">
            The new graph has no plotted node at ({pos.x}, {pos.y}). The swap
            applies cleanly with no effects on stats or spaces. Your position
            stays the same.
          </span>
        </div>
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={onclose} disabled={applying}>Cancel</Button>
      <Button onclick={confirmSwapNoNode} loading={applying} disabled={applying}>
        Confirm swap
      </Button>
    {/snippet}
  </Modal>
{/if}

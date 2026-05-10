<!--
  GraphLibrary.svelte — list of the character's owned advancement graphs.

  Per the rulebook, a character may own multiple advancement graphs:
    - the default for their type (always present, immutable)
    - 'looted' graphs picked up in play (cloned + edited from a known type)
    - 'custom' graphs the player builds for a specific concept

  This panel renders the library as a list of cards. Each card shows the
  graph name, source badge, node count, and an "Active" indicator. The
  active graph drives advancement (see AdvancementPanel).

  Per-graph buttons:
    - "Make active"  — opens the swap dialog (parent supplies onSwap).
    - "Rename"       — inline rename via prompt-style modal (parent's onRename).
    - "Edit nodes"   — opens CustomGraphEditor (parent's onEditNodes).
                       Hidden for 'default' source (immutable).
    - "Delete"       — refused if active or only one in library; hidden for
                       'default' source.

  Read-only mode: shows the list + active indicator only, no buttons. Used
  by view-mode pages.
-->
<script lang="ts">
  import type { SWCharacter, OwnedGraph } from '$lib/models/SWCharacter';
  import { canDeleteGraph, canEditGraphNodes } from '$lib/utils/graphLibrary';
  import { Button, Card, Badge } from '$lib/components/ui';

  interface Props {
    character: SWCharacter;
    /** Player chose "Make active" on a non-active graph. */
    onMakeActive?: (graphId: string) => void;
    /** Player chose "Rename" on a graph. */
    onRename?: (graphId: string) => void;
    /** Player chose "Edit nodes" on a custom/looted graph. */
    onEditNodes?: (graphId: string) => void;
    /** Player chose "Delete" on a custom/looted graph. */
    onDelete?: (graphId: string) => void;
    /** Player chose "+ Add custom graph". */
    onAddCustom?: () => void;
    /** Player chose "+ Loot a graph" (clone an existing type). */
    onLoot?: () => void;
    /** Read-only mode (view sheet) — hides all action buttons. */
    readOnly?: boolean;
  }

  let {
    character,
    onMakeActive,
    onRename,
    onEditNodes,
    onDelete,
    onAddCustom,
    onLoot,
    readOnly = false
  }: Props = $props();

  const graphs = $derived<OwnedGraph[]>(character.ownedGraphs ?? []);
  const activeId = $derived(character.activeGraphId ?? null);

  function sourceBadge(source: OwnedGraph['source']): { variant: 'success' | 'info' | 'warning'; label: string } {
    switch (source) {
      case 'default':
        return { variant: 'info', label: 'default' };
      case 'looted':
        return { variant: 'success', label: 'looted' };
      case 'custom':
        return { variant: 'warning', label: 'custom' };
    }
  }
</script>

<Card title="Graph library">
  <p class="mb-3 text-xs text-neutral-400">
    Per the rules, characters may pick up new advancement graphs during play.
    Each graph below is one your character owns; advancement runs on whichever
    is currently active. Default graphs cannot be edited or deleted.
  </p>

  {#if graphs.length === 0}
    <p class="text-sm text-neutral-400">
      No graphs in the library yet — this is unusual. Your character should always have at least the default graph for their type.
    </p>
  {:else}
    <ul class="space-y-2">
      {#each graphs as og (og.id)}
        {@const isActive = og.id === activeId}
        {@const badge = sourceBadge(og.source)}
        {@const editable = canEditGraphNodes(character, og.id)}
        {@const deletable = canDeleteGraph(character, og.id)}
        {@const nodeCount = og.graph?.nodes?.length ?? 0}
        <li
          class={`flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-neutral-900/40 p-3 text-sm ${
            isActive ? 'border-cyan-500/60' : 'border-neutral-800'
          }`}
        >
          <div class="flex-1 min-w-0">
            <p class="text-neutral-100">
              <strong>{og.name}</strong>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {#if isActive}
                <Badge variant="success">active</Badge>
              {/if}
            </p>
            <p class="mt-0.5 text-xs text-neutral-400">
              type {og.graph?.type ?? '—'} · {nodeCount} node{nodeCount === 1 ? '' : 's'}
              {#if og.acquiredAt}
                · acquired {new Date(og.acquiredAt).toLocaleDateString()}
              {/if}
            </p>
            {#if og.notes}
              <p class="mt-1 text-xs italic text-neutral-300">"{og.notes}"</p>
            {/if}
          </div>
          {#if !readOnly}
            <div class="flex flex-wrap gap-1">
              {#if !isActive}
                <Button variant="secondary" onclick={() => onMakeActive?.(og.id)}>Make active</Button>
              {/if}
              <Button variant="ghost" onclick={() => onRename?.(og.id)}>Rename</Button>
              {#if editable}
                <Button variant="ghost" onclick={() => onEditNodes?.(og.id)}>Edit nodes</Button>
              {/if}
              {#if og.source !== 'default'}
                {#if deletable}
                  <Button variant="ghost" onclick={() => onDelete?.(og.id)}>Delete</Button>
                {:else}
                  <span
                    class="inline-block"
                    title={isActive
                      ? 'Active graph — switch to another graph first.'
                      : graphs.length <= 1
                        ? 'Only graph in the library — cannot delete.'
                        : 'Cannot delete this graph.'}
                  >
                    <Button variant="ghost" disabled onclick={() => onDelete?.(og.id)}>
                      Delete
                    </Button>
                  </span>
                {/if}
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if !readOnly}
    <div class="mt-3 flex flex-wrap gap-2">
      <Button variant="secondary" onclick={() => onAddCustom?.()}>+ Add custom graph</Button>
      <Button variant="secondary" onclick={() => onLoot?.()}>+ Loot a graph</Button>
    </div>
  {/if}
</Card>

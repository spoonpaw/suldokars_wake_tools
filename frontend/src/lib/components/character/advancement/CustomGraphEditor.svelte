<!--
  CustomGraphEditor.svelte — modal that lets the player edit the nodes of
  a custom or looted advancement graph.

  Default-source graphs are immutable (the parent should not open this
  modal for them). The editor surfaces:
    - Top: name input + notes textarea (graph metadata)
    - Middle: TypeGraphView preview of the graph being edited
    - Below: a node table (x, y, kind, spaces, floors, notes) with edit + delete
    - "+ Add node" button → form for x, y, kind, etc.
    - Save → calls onSave(updatedCharacter)
    - Cancel → no change

  All edits are kept in a working draft (`draft`) so the player can cancel.
  On Save we apply the draft to the character via setGraphNode /
  removeGraphNode / setGraphMeta calls and emit the result.
-->
<script lang="ts">
  import type { SWCharacter, OwnedGraph } from '$lib/models/SWCharacter';
  import type { TypeGraphNode, NodeKind, TypeGraphDef } from '$lib/data/typeGraphs';
  import { TYPE_GRAPH_X_MAX, TYPE_GRAPH_Y_MAX } from '$lib/data/typeGraphs';
  import { setGraphMeta, setGraphNode, removeGraphNode } from '$lib/utils/graphLibrary';
  import TypeGraphView from '../TypeGraphView.svelte';
  import { Button, Modal, Input, NumberInput, Select, TextArea } from '$lib/components/ui';

  interface Props {
    open: boolean;
    character: SWCharacter;
    /** Id of the OwnedGraph being edited. Default-source graphs are refused (modal closes). */
    graphId: string;
    onclose: () => void;
    onSave: (updated: SWCharacter) => void;
  }

  let { open, character, graphId, onclose, onSave }: Props = $props();

  // Look up the graph entry. May be null if id is stale.
  const og = $derived<OwnedGraph | null>(
    (character.ownedGraphs ?? []).find((g) => g.id === graphId) ?? null
  );
  const isDefault = $derived(og?.source === 'default');

  // ============================================
  // WORKING DRAFT — clone the graph on open so Cancel is non-destructive.
  // ============================================
  let draftName = $state('');
  let draftNotes = $state('');
  let draftNodes = $state<TypeGraphNode[]>([]);

  $effect(() => {
    if (open && og) {
      draftName = og.name;
      draftNotes = og.notes ?? '';
      draftNodes = structuredClone(og.graph.nodes ?? []);
      resetNewForm();
      editingIdx = null;
    }
  });

  // ============================================
  // PREVIEW — derive a TypeGraphDef from the working draft.
  // ============================================
  const previewGraph = $derived<TypeGraphDef | null>(
    og
      ? {
          type: og.graph.type,
          origo: og.graph.origo,
          nodes: draftNodes
        }
      : null
  );

  // ============================================
  // ADD / EDIT NODE FORM
  // ============================================
  // `editingIdx === null` → form is in ADD mode.
  // `editingIdx === N`    → form is editing existing draftNodes[N].
  let editingIdx = $state<number | null>(null);

  // Form state — all editable per-node fields.
  let fX = $state(1);
  let fY = $state(1);
  let fKind = $state<NodeKind>('open');
  let fSpacesEnabled = $state(true);
  let fSpaces = $state(1);
  let fCloseFloor = $state<number | undefined>(undefined);
  let fRangedFloor = $state<number | undefined>(undefined);
  let fImplantsFloor = $state<number | undefined>(undefined);
  let fNotes = $state('');

  function resetNewForm() {
    fX = 1;
    fY = 1;
    fKind = 'open';
    fSpacesEnabled = true;
    fSpaces = 1;
    fCloseFloor = undefined;
    fRangedFloor = undefined;
    fImplantsFloor = undefined;
    fNotes = '';
  }

  function loadNodeIntoForm(idx: number) {
    const n = draftNodes[idx];
    if (!n) return;
    editingIdx = idx;
    fX = n.x;
    fY = n.y;
    fKind = n.kind;
    fSpacesEnabled = n.spaces !== null;
    fSpaces = n.spaces ?? 1;
    fCloseFloor = n.closeFloor;
    fRangedFloor = n.rangedFloor;
    fImplantsFloor = n.implantsFloor;
    fNotes = n.notes ?? '';
  }

  /**
   * Validation error for the form. Origo (0,0) is implicit per the model
   * (rules/18 origo body-text values are never plotted), and a graph swap
   * to a coord with a node would otherwise apply node effects "for free"
   * at character start. Block (0,0) explicitly. The form's NumberInput
   * min=0 still applies to non-origo points (e.g. (0,1) or (1,0) are fine).
   */
  const formError = $derived.by(() => {
    if (fX === 0 && fY === 0) return 'Origo (0, 0) cannot be a plotted node — it is implicit.';
    return null;
  });

  function applyForm() {
    if (formError) return;
    const node: TypeGraphNode = {
      x: fX,
      y: fY,
      spaces: fSpacesEnabled ? fSpaces : null,
      kind: fKind,
      ...(fCloseFloor !== undefined && fCloseFloor !== null ? { closeFloor: fCloseFloor } : {}),
      ...(fRangedFloor !== undefined && fRangedFloor !== null ? { rangedFloor: fRangedFloor } : {}),
      ...(fImplantsFloor !== undefined && fImplantsFloor !== null
        ? { implantsFloor: fImplantsFloor }
        : {}),
      ...(fNotes.trim() ? { notes: fNotes.trim() } : {})
    };
    if (editingIdx !== null) {
      // Replace the node at editingIdx — but since (x,y) uniquely identifies
      // a node, we filter by coord first to avoid duplicates if the player
      // changed (x,y) to overlap another existing node.
      const filtered = draftNodes.filter(
        (_, i) => i !== editingIdx && !(draftNodes[i].x === node.x && draftNodes[i].y === node.y)
      );
      draftNodes = [...filtered, node];
    } else {
      const filtered = draftNodes.filter((n) => !(n.x === node.x && n.y === node.y));
      draftNodes = [...filtered, node];
    }
    editingIdx = null;
    resetNewForm();
  }

  function deleteNode(idx: number) {
    draftNodes = draftNodes.filter((_, i) => i !== idx);
    if (editingIdx === idx) {
      editingIdx = null;
      resetNewForm();
    }
  }

  function cancelEditForm() {
    editingIdx = null;
    resetNewForm();
  }

  // ============================================
  // SAVE — apply draft back to the character.
  // ============================================
  function save() {
    if (!og || isDefault) {
      onclose();
      return;
    }
    let updated: SWCharacter = setGraphMeta(character, og.id, {
      name: draftName,
      notes: draftNotes
    });
    // For node edits we have to rebuild the node list. We swap the OwnedGraph's
    // entire `graph.nodes` to the draft (instead of looping setGraphNode for
    // each), since the draft includes ADDs, REMOVEs, and EDITs all at once.
    updated = {
      ...updated,
      ownedGraphs: (updated.ownedGraphs ?? []).map((g) =>
        g.id === og.id
          ? {
              ...g,
              graph: {
                ...g.graph,
                nodes: structuredClone(draftNodes)
              }
            }
          : g
      ),
      updatedAt: new Date().toISOString()
    };
    onSave(updated);
  }

  // Sorted view of the node table — by (y desc, x asc) so it reads top-left
  // to bottom-right like the rendered graph.
  const sortedNodes = $derived(
    draftNodes
      .map((n, idx) => ({ n, idx }))
      .sort((a, b) => {
        if (a.n.y !== b.n.y) return b.n.y - a.n.y;
        return a.n.x - b.n.x;
      })
  );

  const KIND_OPTS = [
    { value: 'open', label: 'open' },
    { value: 'double', label: 'double' },
    { value: 'filled', label: 'filled' },
    { value: 'double_filled', label: 'double_filled' }
  ];
</script>

<Modal {open} title={og ? `Edit graph: ${og.name}` : 'Edit graph'} {onclose}>
  {#snippet children()}
    {#if !og}
      <p class="text-sm text-neutral-400">Graph not found.</p>
    {:else if isDefault}
      <p class="rounded-lg border border-amber-700/40 bg-amber-900/20 p-2 text-sm text-amber-200">
        Default graphs are immutable. Loot or build a custom graph if you want
        to make edits.
      </p>
    {:else}
      <div class="space-y-4 text-sm">
        <!-- ============= METADATA ============= -->
        <div class="space-y-2">
          <Input label="Graph name" bind:value={draftName} />
          <TextArea label="Notes (optional)" bind:value={draftNotes} rows={2} />
        </div>

        <!-- ============= PREVIEW ============= -->
        <div>
          <p class="mb-1 text-xs font-medium text-neutral-300">Preview</p>
          <div class="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
            {#if previewGraph}
              <TypeGraphView graph={previewGraph} currentPosition={{ x: 0, y: 0 }} />
            {/if}
          </div>
        </div>

        <!-- ============= NODE LIST ============= -->
        <div>
          <p class="mb-1 text-xs font-medium text-neutral-300">
            Nodes ({draftNodes.length})
          </p>
          {#if draftNodes.length === 0}
            <p class="rounded-lg bg-neutral-800/40 p-2 text-xs text-neutral-400">
              No nodes yet. Add one with the form below.
            </p>
          {:else}
            <div class="overflow-x-auto rounded-lg border border-neutral-800">
              <table class="w-full text-xs">
                <thead class="bg-neutral-900/60 text-neutral-400">
                  <tr>
                    <th class="px-2 py-1 text-left">x</th>
                    <th class="px-2 py-1 text-left">y</th>
                    <th class="px-2 py-1 text-left">kind</th>
                    <th class="px-2 py-1 text-left">sp</th>
                    <th class="px-2 py-1 text-left">C</th>
                    <th class="px-2 py-1 text-left">R</th>
                    <th class="px-2 py-1 text-left">I</th>
                    <th class="px-2 py-1 text-left">notes</th>
                    <th class="px-2 py-1 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each sortedNodes as row (row.idx)}
                    <tr class="border-t border-neutral-800">
                      <td class="px-2 py-1">{row.n.x}</td>
                      <td class="px-2 py-1">{row.n.y}</td>
                      <td class="px-2 py-1">{row.n.kind.replace('_', ' + ')}</td>
                      <td class="px-2 py-1">{row.n.spaces ?? '—'}</td>
                      <td class="px-2 py-1">{row.n.closeFloor ?? '—'}</td>
                      <td class="px-2 py-1">{row.n.rangedFloor ?? '—'}</td>
                      <td class="px-2 py-1">{row.n.implantsFloor ?? '—'}</td>
                      <td class="px-2 py-1 truncate max-w-[8rem]" title={row.n.notes ?? ''}>
                        {row.n.notes ?? ''}
                      </td>
                      <td class="px-2 py-1 text-right">
                        <Button variant="ghost" onclick={() => loadNodeIntoForm(row.idx)}>edit</Button>
                        <Button variant="ghost" onclick={() => deleteNode(row.idx)}>del</Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- ============= ADD / EDIT NODE FORM ============= -->
        <div class="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <p class="text-xs font-semibold text-neutral-200">
            {editingIdx !== null ? 'Edit node' : 'Add node'}
          </p>
          <div class="grid grid-cols-2 gap-2">
            <NumberInput label="x (Shadow, 0–{TYPE_GRAPH_X_MAX})" value={fX} min={0} max={TYPE_GRAPH_X_MAX} onchange={(v) => (fX = v)} />
            <NumberInput label="y (Gunta, 0–{TYPE_GRAPH_Y_MAX})" value={fY} min={0} max={TYPE_GRAPH_Y_MAX} onchange={(v) => (fY = v)} />
          </div>
          <Select label="Kind" options={KIND_OPTS} value={fKind} onchange={(v) => (fKind = v as NodeKind)} />
          <label class="flex items-center gap-2 text-xs text-neutral-300">
            <input type="checkbox" bind:checked={fSpacesEnabled} />
            <span>Node sets a spaces count (uncheck for null = no change)</span>
          </label>
          {#if fSpacesEnabled}
            <NumberInput label="Spaces" value={fSpaces} min={0} onchange={(v) => (fSpaces = v)} />
          {/if}
          <div class="grid grid-cols-3 gap-2">
            <NumberInput
              label="Close floor"
              value={fCloseFloor ?? 0}
              min={0}
              onchange={(v) => (fCloseFloor = v > 0 ? v : undefined)}
            />
            <NumberInput
              label="Ranged floor"
              value={fRangedFloor ?? 0}
              min={0}
              onchange={(v) => (fRangedFloor = v > 0 ? v : undefined)}
            />
            <NumberInput
              label="Implants floor"
              value={fImplantsFloor ?? 0}
              min={0}
              onchange={(v) => (fImplantsFloor = v > 0 ? v : undefined)}
            />
          </div>
          <p class="text-xs text-neutral-500">Set 0 to omit a floor.</p>
          <TextArea label="Notes (optional)" bind:value={fNotes} rows={2} />
          {#if formError}
            <p class="text-xs text-red-400">{formError}</p>
          {/if}
          <div class="flex flex-wrap gap-2">
            <Button onclick={applyForm} disabled={!!formError}>
              {editingIdx !== null ? 'Save node' : 'Add node'}
            </Button>
            {#if editingIdx !== null}
              <Button variant="ghost" onclick={cancelEditForm}>Cancel edit</Button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={onclose}>Cancel</Button>
    <Button onclick={save} disabled={!og || isDefault}>Save graph</Button>
  {/snippet}
</Modal>

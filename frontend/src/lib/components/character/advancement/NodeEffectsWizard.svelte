<!--
  NodeEffectsWizard.svelte — shared step-walker that applies the effects
  of a TypeGraphNode to a character.

  Used by both AdvancementModal (normal advancement step) and
  GraphSwapModal (swap-into-coord with effects). Walks the same step
  sequence in either case:

    1. Effect summary (always)
    2. Stack floors  (if the node raises any floor above current)
    3. Spaces        (if the node grants more spaces than current)
    4. New keyword   (if node is double / double_filled)
    5. Rearrange     (if node is filled / double_filled)
    6. Bond swap     (if node is filled / double_filled and Core)
    7. Confirm

  On confirm the wizard returns:
    - `updated`: a clone of `character` with all chosen effects applied
                 (BUT NOT the move-side: typeGraphPosition / shadow /
                 guntaValue / activeGraphId — those are owned by the
                 consumer modal).
    - `beforeState`: a snapshot of every field this wizard mutated, in
                     the AdvancementLogEntry['beforeState'] shape.
                     Includes `stacks: {}` even for no-effect nodes so
                     the consumer can layer shadow/guntaValue/priorSession
                     onto it without crashing.

  The consumer then composes its own move-side / swap-side mutations on
  top of `updated` and packages the result into an AdvancementLogEntry.

  Mode-specific copy:
    - 'move'        — talks about advancement, qualifying session, etc.
    - 'graph_swap'  — talks about the graph swap and free node-effect apply.

  An optional `summaryHeader` snippet lets the consumer prepend
  context-specific UI to the summary step (e.g. "swap from graph A to
  graph B"). An optional `confirmExtra` snippet lets the consumer add
  trailing UI to the confirm step (e.g. AdvancementModal's notes
  textarea bound to its own state).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type {
    SWCharacter,
    AdvancementLogEntry,
    CharacterKeyword,
    CharacterSpace
  } from '$lib/models/SWCharacter';
  import { emptyStackComposition, sumComposition } from '$lib/models/SWCharacter';
  import type { TypeGraphNode } from '$lib/data/typeGraphs';
  import type { Stack, Background } from '$lib/models/Enums';
  import { ALL_STACKS, STACK_LABELS } from '$lib/models/Enums';
  import { Button, Modal, Select } from '$lib/components/ui';
  import { BACKGROUNDS_DATA } from '$lib/data/backgrounds';

  interface Props {
    open: boolean;
    character: SWCharacter;
    targetNode: TypeGraphNode;
    /** Mode tweaks copy for advancement vs graph swap. */
    mode: 'move' | 'graph_swap';
    /** Modal title ("Advance to (3,1)" / "Swap active graph"). */
    title: string;
    /** Apply-button label ("Apply & advance" / "Confirm swap"). */
    applyLabel?: string;
    /** Optional UI prepended to the summary step (e.g. swap header). */
    summaryHeader?: Snippet;
    /** Optional UI appended to the confirm step (e.g. notes textarea). */
    confirmExtra?: Snippet;
    onconfirm: (
      updated: SWCharacter,
      beforeState: NonNullable<AdvancementLogEntry['beforeState']>
    ) => void;
    oncancel: () => void;
  }

  let {
    open,
    character,
    targetNode,
    mode,
    title,
    applyLabel = 'Apply',
    summaryHeader,
    confirmExtra,
    onconfirm,
    oncancel
  }: Props = $props();

  // ============================================
  // DERIVED EFFECTS — re-derive whenever inputs change.
  // ============================================
  const closeBefore = $derived(character.stacks.close);
  const closeAfter = $derived(
    targetNode.closeFloor !== undefined
      ? Math.max(closeBefore, targetNode.closeFloor)
      : closeBefore
  );
  const rangedBefore = $derived(character.stacks.ranged);
  const rangedAfter = $derived(
    targetNode.rangedFloor !== undefined
      ? Math.max(rangedBefore, targetNode.rangedFloor)
      : rangedBefore
  );
  const implantsBefore = $derived(character.origo.implants);
  const implantsAfter = $derived(
    targetNode.implantsFloor !== undefined
      ? Math.max(implantsBefore, targetNode.implantsFloor)
      : implantsBefore
  );

  const currentSpaceCount = $derived(character.spaces.length);
  const spaceCountAfter = $derived(
    targetNode.spaces !== null
      ? Math.max(currentSpaceCount, targetNode.spaces)
      : currentSpaceCount
  );
  const spacesToAdd = $derived(Math.max(0, spaceCountAfter - currentSpaceCount));

  const grantsKeyword = $derived(
    targetNode.kind === 'double' || targetNode.kind === 'double_filled'
  );
  const grantsRearrange = $derived(
    targetNode.kind === 'filled' || targetNode.kind === 'double_filled'
  );
  const grantsBondSwap = $derived(character.type === 'core' && grantsRearrange);

  /** True iff the node grants nothing — wizard auto-enables Confirm. */
  const hasNoEffects = $derived(
    closeAfter <= closeBefore &&
      rangedAfter <= rangedBefore &&
      implantsAfter <= implantsBefore &&
      spacesToAdd === 0 &&
      !grantsKeyword &&
      !grantsRearrange &&
      !grantsBondSwap
  );

  // ============================================
  // PLAYER PICKS
  // ============================================
  type SourceChoice = 'background' | 'cross';
  let kwSource = $state<SourceChoice>('background');
  let kwName = $state('');
  let kwFromBackground = $state<Background>('enforcer');
  let kwStack = $state<Stack>('archive');
  $effect(() => {
    if (open) {
      kwSource = 'background';
      kwName = '';
      kwStack = 'archive';
      kwFromBackground = character.background;
    }
  });

  const kwOptions = $derived.by(() => {
    if (kwSource === 'background') {
      const bg = BACKGROUNDS_DATA.find((b) => b.id === character.background);
      return bg?.keywords ?? [];
    }
    return BACKGROUNDS_DATA.flatMap((b) =>
      b.id === character.background ? [] : b.keywords.map((k) => ({ ...k, fromBackground: b.id }))
    );
  });

  let rearrangeMap = $state<Record<string, Stack>>({});
  function initRearrangeMap() {
    const out: Record<string, Stack> = {};
    for (const k of character.keywords) {
      // Implant keywords are excluded from rearrange (rules/17 — non-implanted).
      if (k.source !== 'implant') out[k.id] = k.stack;
    }
    rearrangeMap = out;
  }
  $effect(() => {
    if (open && grantsRearrange) initRearrangeMap();
  });

  let newBond = $state<'holoh' | 'nanite_cloud' | 'subspace_nanites'>('holoh');
  $effect(() => {
    if (open) {
      const current = character.coreBond;
      newBond =
        current === 'holoh' || current === 'nanite_cloud' || current === 'subspace_nanites'
          ? current
          : 'holoh';
    }
  });

  let applying = $state(false);
  $effect(() => {
    if (open) applying = false;
  });

  // ============================================
  // STEP NAVIGATION
  // ============================================
  const STEP_DEFS = $derived.by(() => {
    const steps: { id: string; label: string }[] = [
      { id: 'summary', label: mode === 'graph_swap' ? 'Swap summary' : 'Effect summary' }
    ];
    if (
      closeAfter > closeBefore ||
      rangedAfter > rangedBefore ||
      implantsAfter > implantsBefore
    ) {
      steps.push({ id: 'floors', label: 'Stack floors' });
    }
    if (spacesToAdd > 0) steps.push({ id: 'spaces', label: 'New space slots' });
    if (grantsKeyword) steps.push({ id: 'keyword', label: 'New keyword' });
    if (grantsRearrange) steps.push({ id: 'rearrange', label: 'Rearrange keywords' });
    if (grantsBondSwap) steps.push({ id: 'bond', label: 'Bond swap' });
    steps.push({ id: 'confirm', label: 'Confirm' });
    return steps;
  });

  let stepIdx = $state(0);
  $effect(() => {
    if (open) stepIdx = 0;
  });
  $effect(() => {
    if (stepIdx >= STEP_DEFS.length) stepIdx = Math.max(0, STEP_DEFS.length - 1);
  });

  const currentStep = $derived(STEP_DEFS[stepIdx]?.id ?? 'summary');
  const isLastStep = $derived(stepIdx >= STEP_DEFS.length - 1);
  function gotoNext() {
    if (!isLastStep) stepIdx += 1;
  }
  function gotoBack() {
    if (stepIdx > 0) stepIdx -= 1;
  }

  // ============================================
  // KEYWORD STEP UI HELPERS
  // ============================================
  $effect(() => {
    if (currentStep !== 'keyword') return;
    if (kwName === '' && kwOptions.length > 0) {
      const first = kwOptions[0];
      kwName = first.name;
      kwStack = first.stackHints[0] ?? 'archive';
      if ('fromBackground' in first) {
        kwFromBackground = first.fromBackground as Background;
      }
    }
  });

  /**
   * Pick a keyword option by index — index is unambiguous even when two
   * backgrounds share a keyword name (e.g. "Disguise" exists in both
   * Cultist and Entertainer). Lookup-by-name would silently pick the
   * first match instead of the row the player actually clicked.
   */
  function pickKwOptionByIndex(idx: number) {
    const found = kwOptions[idx];
    if (!found) return;
    kwName = found.name;
    kwStack = found.stackHints[0] ?? 'archive';
    if ('fromBackground' in found) {
      kwFromBackground = found.fromBackground as Background;
    }
  }

  function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ============================================
  // CHANGES SUMMARY for the confirm-step preview list.
  // The wizard does NOT include move/swap-side lines (e.g. position,
  // shadow, gunta, active-graph) — the consumer adds those to the final
  // log entry's `changes`. This list is only for the in-modal review.
  // ============================================
  function buildEffectChanges(): string[] {
    const changes: string[] = [];
    if (closeAfter > closeBefore) changes.push(`Close ${closeBefore} → ${closeAfter}`);
    if (rangedAfter > rangedBefore) changes.push(`Ranged ${rangedBefore} → ${rangedAfter}`);
    if (implantsAfter > implantsBefore) {
      changes.push(`Implants cap ${implantsBefore} → ${implantsAfter}`);
    }
    if (spacesToAdd > 0) {
      changes.push(`Added ${spacesToAdd} empty space slot${spacesToAdd === 1 ? '' : 's'}`);
    }
    if (grantsKeyword && kwName.trim()) {
      changes.push(
        `New keyword: ${kwName.trim()} (${kwStack}, ${kwSource === 'cross' ? 'cross from ' + kwFromBackground : 'own bg'})`
      );
    }
    if (grantsRearrange) {
      const moved: string[] = [];
      for (const k of character.keywords) {
        const ns = rearrangeMap[k.id];
        if (ns && ns !== k.stack) moved.push(`${k.name}: ${k.stack} → ${ns}`);
      }
      if (moved.length > 0) changes.push(`Rearranged: ${moved.join('; ')}`);
    }
    if (grantsBondSwap && newBond !== character.coreBond) {
      changes.push(`Bond swap: ${character.coreBond ?? 'none'} → ${newBond}`);
    }
    if (changes.length === 0) {
      changes.push('No changes to apply — confirm to proceed.');
    }
    return changes;
  }

  // ============================================
  // APPLY — build the updated character + beforeState snapshot.
  // ============================================
  function applyChanges() {
    if (applying) return;
    applying = true;

    const updated: SWCharacter = JSON.parse(JSON.stringify(character));

    const beforeState: NonNullable<AdvancementLogEntry['beforeState']> = {
      stacks: {}
    };

    // Stack floors. The cached `stacks` integer AND the matching
    // composition's `other` slot must move in lock-step — recomputeStacks()
    // overwrites stacks from composition, so without raising the
    // composition slot too, the floor raise gets reverted on the next
    // implant edit. We snapshot the prior composition slot so rollback
    // can restore both halves.
    function raiseFloor(stack: 'close' | 'ranged', before: number, after: number) {
      if (after <= before) return;
      beforeState.stacks![stack] = before;
      const priorComp = updated.stackComposition?.[stack] ?? emptyStackComposition();
      beforeState.stackComposition = {
        ...(beforeState.stackComposition ?? {}),
        [stack]: { ...priorComp }
      };
      updated.stacks[stack] = after;
      const delta = after - before;
      const nextComp = { ...priorComp, other: priorComp.other + delta };
      nextComp.final = sumComposition(nextComp);
      updated.stackComposition = {
        ...(updated.stackComposition ?? {}),
        [stack]: nextComp
      } as SWCharacter['stackComposition'];
    }
    raiseFloor('close', closeBefore, closeAfter);
    raiseFloor('ranged', rangedBefore, rangedAfter);
    if (implantsAfter > implantsBefore) {
      beforeState.implantsCap = implantsBefore;
      updated.origo.implants = implantsAfter;
    }

    // Add empty space slots — record their ids so rollback knows which
    // slots to remove (and not delete pre-existing spaces by accident).
    if (spacesToAdd > 0) {
      const slotEffect =
        mode === 'graph_swap'
          ? 'Empty space slot from graph swap — fill in via the editor.'
          : 'Empty space slot — fill in via the editor or AdvancementModal step.';
      const newSpaces: CharacterSpace[] = Array.from({ length: spacesToAdd }, () => ({
        id: newId(),
        active: false,
        kind: 'other' as const,
        name: '(new — fill in)',
        effect: slotEffect
      }));
      beforeState.spacesAddedIds = newSpaces.map((s) => s.id);
      updated.spaces = [...updated.spaces, ...newSpaces];
    }

    // New keyword.
    if (grantsKeyword && kwName.trim()) {
      const newKw: CharacterKeyword = {
        id: newId(),
        name: kwName.trim(),
        stack: kwStack,
        source: 'advancement',
        fromBackground: kwSource === 'cross' ? kwFromBackground : character.background
      };
      beforeState.keywordsAddedIds = [...(beforeState.keywordsAddedIds ?? []), newKw.id];
      updated.keywords = [...updated.keywords, newKw];
    }

    // Rearrange — snapshot only keywords whose stack actually changes.
    if (grantsRearrange) {
      const rearrangements: { keywordId: string; previousStack: Stack }[] = [];
      updated.keywords = updated.keywords.map((k) => {
        if (k.source === 'implant') return k; // implant keywords are locked
        const ns = rearrangeMap[k.id];
        if (ns && ns !== k.stack) {
          rearrangements.push({ keywordId: k.id, previousStack: k.stack });
          return { ...k, stack: ns };
        }
        return k;
      });
      if (rearrangements.length > 0) beforeState.keywordRearrangements = rearrangements;
    }

    // Bond swap.
    if (grantsBondSwap && newBond !== character.coreBond) {
      beforeState.coreBond = (character.coreBond ?? 'none') as NonNullable<
        AdvancementLogEntry['beforeState']
      >['coreBond'];
      // Snapshot prior notes too — empty string + undefined both round-trip
      // as `''` to satisfy the bound TextArea contract.
      beforeState.coreBondNotes = character.coreBondNotes ?? '';
      updated.coreBond = newBond;
      const swapNoteContext =
        mode === 'graph_swap' ? 'graph swap' : 'advancement node';
      updated.coreBondNotes = `Bond swapped at ${swapNoteContext} (${targetNode.x}, ${targetNode.y}).`;
    }

    onconfirm(updated, beforeState);
  }

  function cancel() {
    if (applying) return;
    oncancel();
  }

  const STACK_OPTS = ALL_STACKS.map((s) => ({ value: s, label: STACK_LABELS[s] }));
  const BOND_OPTS = [
    { value: 'holoh', label: 'The HoloH' },
    { value: 'nanite_cloud', label: 'A Nanite Cloud' },
    { value: 'subspace_nanites', label: 'Subspace Nanites' }
  ];
</script>

<Modal {open} {title} onclose={cancel}>
  {#snippet children()}
    <!-- Step pill navigator -->
    <ol class="mb-3 flex flex-wrap gap-1 text-xs">
      {#each STEP_DEFS as s, i (s.id)}
        <li>
          <button
            type="button"
            onclick={() => (stepIdx = i)}
            class={`rounded-full border px-2 py-0.5 transition ${
              i === stepIdx
                ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        </li>
      {/each}
    </ol>

    <!-- =====================================================
         STEP: Summary (effect summary OR swap summary header + effect)
         ===================================================== -->
    {#if currentStep === 'summary'}
      <div class="space-y-2 text-sm text-neutral-300">
        {#if summaryHeader}
          {@render summaryHeader()}
        {/if}
        {#if hasNoEffects}
          <p class="rounded-lg bg-neutral-800/40 p-2 text-xs text-neutral-400">
            No node effects to apply at ({targetNode.x}, {targetNode.y}).
            Confirm to proceed.
          </p>
        {:else}
          <p>
            <strong class="text-neutral-100">Node kind:</strong>
            <span class="capitalize">{targetNode.kind.replace('_', ' + ')}</span>
          </p>
          {#if targetNode.spaces !== null}
            <p><strong class="text-neutral-100">Spaces:</strong> {targetNode.spaces}</p>
          {/if}
          {#if targetNode.closeFloor !== undefined}
            <p>
              <strong class="text-neutral-100">Close floor:</strong> C{targetNode.closeFloor}
              {closeAfter > closeBefore
                ? ` (currently ${closeBefore} — will rise to ${closeAfter})`
                : ` (already ${closeBefore} ≥ ${targetNode.closeFloor}, no change)`}
            </p>
          {/if}
          {#if targetNode.rangedFloor !== undefined}
            <p>
              <strong class="text-neutral-100">Ranged floor:</strong> R{targetNode.rangedFloor}
              {rangedAfter > rangedBefore
                ? ` (currently ${rangedBefore} — will rise to ${rangedAfter})`
                : ` (already ${rangedBefore} ≥ ${targetNode.rangedFloor}, no change)`}
            </p>
          {/if}
          {#if targetNode.implantsFloor !== undefined}
            <p>
              <strong class="text-neutral-100">Implants cap floor:</strong> I{targetNode.implantsFloor}
              {implantsAfter > implantsBefore
                ? ` (currently ${implantsBefore} — will rise to ${implantsAfter})`
                : ` (already ${implantsBefore} ≥ ${targetNode.implantsFloor}, no change)`}
            </p>
          {/if}
          {#if grantsKeyword}
            <p class="text-cyan-200">★ New keyword (own background, or cross-pick from another).</p>
          {/if}
          {#if grantsRearrange}
            <p class="text-amber-200">★ Rearrange — move non-implanted keywords to different stacks.</p>
          {/if}
          {#if grantsBondSwap}
            <p class="text-violet-200">★ Bond swap (Core) — switch HoloH / Nanite Cloud / Subspace Nanites.</p>
          {/if}
          {#if targetNode.notes}
            <p class="mt-2 rounded-lg bg-neutral-800/60 px-3 py-2 text-xs text-neutral-400">{targetNode.notes}</p>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- =====================================================
         STEP: Stack floors preview
         ===================================================== -->
    {#if currentStep === 'floors'}
      <div class="space-y-3 text-sm text-neutral-300">
        <p>The following stacks will be raised to the node's floor (only if currently below):</p>
        <table class="w-full text-left">
          <thead class="text-xs uppercase text-neutral-500">
            <tr><th>Stack</th><th>Before</th><th>After</th></tr>
          </thead>
          <tbody>
            {#if targetNode.closeFloor !== undefined}
              <tr class="border-t border-neutral-800"><td>Close</td><td>{closeBefore}</td><td class="text-cyan-200">{closeAfter}</td></tr>
            {/if}
            {#if targetNode.rangedFloor !== undefined}
              <tr class="border-t border-neutral-800"><td>Ranged</td><td>{rangedBefore}</td><td class="text-cyan-200">{rangedAfter}</td></tr>
            {/if}
            {#if targetNode.implantsFloor !== undefined}
              <tr class="border-t border-neutral-800"><td>Implants cap</td><td>{implantsBefore}</td><td class="text-cyan-200">{implantsAfter}</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- =====================================================
         STEP: New space slots
         ===================================================== -->
    {#if currentStep === 'spaces'}
      <div class="space-y-2 text-sm text-neutral-300">
        <p>
          You currently have <strong>{currentSpaceCount}</strong> space slot(s).
          The node calls for <strong>{targetNode.spaces}</strong>.
        </p>
        <p>
          Confirming will append <strong class="text-cyan-200">{spacesToAdd}</strong> empty slot(s)
          to your character. Fill them in later via the editor (formula / equipment / bested-enemy memory).
        </p>
      </div>
    {/if}

    <!-- =====================================================
         STEP: New keyword (own bg / cross)
         ===================================================== -->
    {#if currentStep === 'keyword'}
      <div class="space-y-3 text-sm text-neutral-300">
        <p>Pick a new keyword. You may pick one from your own background or cross-pick from another.</p>
        <div class="flex gap-2">
          <Button
            variant={kwSource === 'background' ? 'primary' : 'secondary'}
            onclick={() => {
              kwSource = 'background';
              kwName = '';
            }}
          >Own background ({character.background})</Button>
          <Button
            variant={kwSource === 'cross' ? 'primary' : 'secondary'}
            onclick={() => {
              kwSource = 'cross';
              kwName = '';
            }}
          >Cross-pick</Button>
        </div>
        <div class="max-h-48 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
          {#each kwOptions as k, idx (k.name + ('fromBackground' in k ? '-' + k.fromBackground : ''))}
            {@const fromBg = 'fromBackground' in k ? (k.fromBackground as Background) : character.background}
            {@const isPicked = kwName === k.name && kwFromBackground === fromBg}
            <button
              type="button"
              onclick={() => pickKwOptionByIndex(idx)}
              class={`block w-full rounded px-2 py-1 text-left text-sm transition ${
                isPicked
                  ? 'bg-cyan-900/40 text-cyan-100'
                  : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-cyan-200'
              }`}
            >
              {k.name}
              <span class="text-neutral-500">
                ({k.stackHints.join(', ')}){'fromBackground' in k ? ` — ${k.fromBackground}` : ''}
              </span>
            </button>
          {/each}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-xs text-neutral-400">
            <span>Keyword name</span>
            <input
              type="text"
              bind:value={kwName}
              class="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <Select label="Place under stack" options={STACK_OPTS} value={kwStack as string} onchange={(v) => (kwStack = v as Stack)} />
        </div>
      </div>
    {/if}

    <!-- =====================================================
         STEP: Rearrange existing keywords
         ===================================================== -->
    {#if currentStep === 'rearrange'}
      <div class="space-y-2 text-sm text-neutral-300">
        <p>Move any non-implanted keyword to a different stack. (Implant keywords stay put.)</p>
        {#if Object.keys(rearrangeMap).length === 0}
          <p class="rounded bg-neutral-800/40 p-2 text-neutral-400">No keywords to rearrange.</p>
        {:else}
          <ul class="space-y-2">
            {#each character.keywords as k (k.id)}
              {#if k.source !== 'implant'}
                <li class="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-neutral-800/40 p-2">
                  <span class="font-medium text-neutral-100">{k.name}</span>
                  <Select
                    options={STACK_OPTS}
                    value={rearrangeMap[k.id] as string}
                    onchange={(v) => (rearrangeMap = { ...rearrangeMap, [k.id]: v as Stack })}
                  />
                </li>
              {/if}
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <!-- =====================================================
         STEP: Bond swap (Core only)
         ===================================================== -->
    {#if currentStep === 'bond'}
      <div class="space-y-3 text-sm text-neutral-300">
        <p>Core characters may switch deep-bond at any black-fill node.</p>
        <p>Current bond: <strong class="text-neutral-100">{character.coreBond ?? 'none'}</strong></p>
        <Select label="New bond" options={BOND_OPTS} value={newBond as string} onchange={(v) => (newBond = v as typeof newBond)} />
        {#if mode === 'move'}
          <p class="text-xs text-neutral-500">
            Switching breaks the previous bond. If switching from Nanite Cloud, the major cloud parts ways and the beginner cloud reemerges only on a future re-bond.
          </p>
        {/if}
      </div>
    {/if}

    <!-- =====================================================
         STEP: Confirm summary + apply
         ===================================================== -->
    {#if currentStep === 'confirm'}
      <div class="space-y-3 text-sm text-neutral-300">
        <p class="text-neutral-200">Effects about to be applied:</p>
        <ul class="space-y-1 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs">
          {#each buildEffectChanges() as change}
            <li class="text-neutral-300">· {change}</li>
          {/each}
        </ul>
        {#if confirmExtra}
          {@render confirmExtra()}
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {@const requiresKwPick = grantsKeyword && !kwName.trim()}
    <Button variant="ghost" onclick={cancel} disabled={applying}>Cancel</Button>
    <Button variant="ghost" onclick={gotoBack} disabled={stepIdx === 0 || applying}>Back</Button>
    {#if !isLastStep}
      <Button onclick={gotoNext} disabled={applying}>Next</Button>
    {:else if requiresKwPick}
      <span class="inline-block" title="Pick a keyword first — this node grants one.">
        <Button onclick={applyChanges} loading={applying} disabled>{applyLabel}</Button>
      </span>
    {:else}
      <Button onclick={applyChanges} loading={applying} disabled={applying}>{applyLabel}</Button>
    {/if}
  {/snippet}
</Modal>

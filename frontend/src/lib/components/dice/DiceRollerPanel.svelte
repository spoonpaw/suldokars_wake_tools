<script lang="ts">
  import { Button, NumberInput, Toggle } from '$lib/components/ui';
  import {
    invertedRoll,
    cleanRoll,
    doubleRoll,
    halfRoll,
    explodingD20,
    odyn,
    type InvertedRollResult,
    type ExplodingRollResult,
    type OdynResult,
    type RollOutcome
  } from '$lib/utils/dice';

  let stack = $state(5);
  let dn = $state(15);
  let isApt = $state(false);

  type Entry =
    | { kind: 'inverted'; result: InvertedRollResult; label: string }
    | { kind: 'double'; rolls: [InvertedRollResult, InvertedRollResult]; best: InvertedRollResult }
    | { kind: 'half'; rolls: [InvertedRollResult, InvertedRollResult]; worst: InvertedRollResult }
    | { kind: 'exploding'; result: ExplodingRollResult }
    | { kind: 'odyn'; result: OdynResult };

  let log = $state<Entry[]>([]);

  function add(e: Entry) {
    log = [e, ...log].slice(0, 30);
  }

  function rollInverted() {
    add({ kind: 'inverted', result: invertedRoll(stack, dn, isApt), label: 'Inverted' });
  }
  function rollClean() {
    add({ kind: 'inverted', result: cleanRoll(dn), label: 'Clean' });
  }
  function rollDouble() {
    const r = doubleRoll(stack, dn, isApt);
    add({ kind: 'double', rolls: r.rolls, best: r.best });
  }
  function rollHalf() {
    const r = halfRoll(stack, dn, isApt);
    add({ kind: 'half', rolls: r.rolls, worst: r.worst });
  }
  function rollExploding() {
    add({ kind: 'exploding', result: explodingD20() });
  }
  function rollOdyn() {
    add({ kind: 'odyn', result: odyn() });
  }
  function clearLog() {
    log = [];
  }

  function outcomeColor(o: RollOutcome): string {
    switch (o) {
      case 'crit':
        return 'text-emerald-300';
      case 'special':
        return 'text-amber-300';
      case 'success':
        return 'text-cyan-300';
      case 'failure':
        return 'text-neutral-300';
      case 'fumble':
        return 'text-red-400';
    }
  }
</script>

<section class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
  <h2 class="mb-3 text-lg font-semibold text-neutral-100">Suldokar's Wake Dice</h2>

  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
    <NumberInput label="Stack" bind:value={stack} min={0} max={20} />
    <NumberInput label="DN" bind:value={dn} min={0} max={30} />
    <div class="flex items-end">
      <Toggle label="Apt (crit on 19+20)" bind:checked={isApt} />
    </div>
  </div>

  <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
    <Button onclick={rollInverted}>Inverted</Button>
    <Button variant="secondary" onclick={rollClean}>Clean</Button>
    <Button variant="secondary" onclick={rollDouble}>Double</Button>
    <Button variant="secondary" onclick={rollHalf}>Half</Button>
    <Button variant="secondary" onclick={rollExploding}>Exploding d20</Button>
    <Button variant="secondary" onclick={rollOdyn}>Odyn</Button>
  </div>
</section>

<section class="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
  <div class="mb-3 flex items-center justify-between">
    <h3 class="font-semibold text-neutral-200">Recent rolls</h3>
    <Button variant="ghost" size="sm" onclick={clearLog} disabled={log.length === 0}>Clear</Button>
  </div>

  {#if log.length === 0}
    <p class="text-sm text-neutral-500">No rolls yet. Spin one above.</p>
  {:else}
    <ul class="space-y-2 text-sm">
      {#each log as entry, i (i)}
        <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          {#if entry.kind === 'inverted'}
            <div class="flex items-center justify-between">
              <span class="text-neutral-400">{entry.label}</span>
              <span class="font-mono text-lg text-neutral-100">d20 → {entry.result.d20}</span>
            </div>
            <p class={`mt-1 ${outcomeColor(entry.result.outcome)}`}>{entry.result.description}</p>
          {:else if entry.kind === 'double'}
            <p class="text-neutral-400">Double roll (best of two)</p>
            <p class="font-mono text-neutral-100">d20 → {entry.rolls[0].d20} & {entry.rolls[1].d20}</p>
            <p class={outcomeColor(entry.best.outcome)}>{entry.best.description}</p>
          {:else if entry.kind === 'half'}
            <p class="text-neutral-400">Half roll (worst of two)</p>
            <p class="font-mono text-neutral-100">d20 → {entry.rolls[0].d20} & {entry.rolls[1].d20}</p>
            <p class={outcomeColor(entry.worst.outcome)}>{entry.worst.description}</p>
          {:else if entry.kind === 'exploding'}
            <p class="text-neutral-400">Exploding d20</p>
            <p class="font-mono text-neutral-100">{entry.result.rolls.join(' + ')} = {entry.result.total}</p>
          {:else if entry.kind === 'odyn'}
            <p class="text-neutral-400">Odyn roll</p>
            <p class="font-mono text-neutral-100">
              d20:{entry.result.d20} d12:{entry.result.d12} d10:{entry.result.d10}
              d8:{entry.result.d8} d6:{entry.result.d6} d4:{entry.result.d4}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

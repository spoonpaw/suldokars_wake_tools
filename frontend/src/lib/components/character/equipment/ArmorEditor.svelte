<script lang="ts">
  /**
   * ArmorEditor — collapsible card for one CharacterArmor entry. Header
   * shows the equipped pill, name, key chrome (strength / weakness / slots,
   * and shield/helmet/Prime-only badges). Edit pane uses a 2-col field grid.
   */
  import { untrack } from 'svelte';
  import type { CharacterArmor } from '$lib/models';
  import { Input, Toggle, NumberInput, TextArea } from '$lib/components/ui';
  import { formatSlots } from '$lib/utils/equipment';

  interface Props {
    armor: CharacterArmor;
    ondelete: () => void;
    startExpanded?: boolean;
  }

  let { armor = $bindable(), ondelete, startExpanded = false }: Props = $props();

  // See WeaponEditor — `untrack` makes the "initial value only" intent explicit.
  let expanded = $state(untrack(() => startExpanded));
</script>

<div class="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
  <!--
    Header is a real <button> for keyboard accessibility. Equipped pill is a
    span with role="switch" + manual key handling so the inner control
    doesn't nest a <button> inside a <button> (HTML invalid).
  -->
  <button
    type="button"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
    class="w-full text-left p-3 hover:bg-neutral-800/50 transition cursor-pointer"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <span
          role="switch"
          tabindex="0"
          aria-checked={armor.equipped}
          onclick={(e) => { e.stopPropagation(); armor.equipped = !armor.equipped; }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              armor.equipped = !armor.equipped;
            }
          }}
          class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer {armor.equipped ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-neutral-700/50 text-neutral-500 border border-neutral-600'}"
        >
          {#if armor.equipped}
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            Equipped
          {:else}
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>
            Not equipped
          {/if}
        </span>
        <span class="font-semibold text-neutral-100">{armor.name || 'Unnamed armor'}</span>
        {#if armor.isShield}
          <span class="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Shield</span>
        {/if}
        {#if armor.isHelmet}
          <span class="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Helmet</span>
        {/if}
        {#if armor.primeOnly}
          <span class="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">§ Prime-only</span>
        {/if}
      </div>

      <svg
        class="w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 {expanded ? 'rotate-180' : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <div class="flex flex-wrap gap-2 mt-2 text-xs tabular-nums">
      <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{formatSlots(armor.slots)}</span>
      {#if armor.cost > 0}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{armor.cost.toLocaleString()} P</span>
      {/if}
      {#if armor.strength}
        <span class="px-2 py-1 rounded bg-green-500/10 text-green-300">Strength: {armor.strength}</span>
      {/if}
      {#if armor.weakness}
        <span class="px-2 py-1 rounded bg-red-500/10 text-red-300">Weakness: {armor.weakness}</span>
      {/if}
    </div>

    {#if armor.notes}
      <p class="mt-2 text-xs text-neutral-400">{armor.notes}</p>
    {/if}
  </button>

  {#if expanded}
    <div class="border-t border-neutral-800 p-4 space-y-4">
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Input label="Name" placeholder="Armor name" bind:value={armor.name} />
        <NumberInput label="Slots" value={armor.slots} min={0} step={0.5} showControls={false} onchange={(v) => (armor.slots = v)} />
      </div>

      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Input label="Strength (resists)" placeholder="e.g. Energy" bind:value={armor.strength as string} />
        <Input label="Weakness (vulnerable)" placeholder="e.g. Bludgeoning" bind:value={armor.weakness as string} />
      </div>

      <div class="grid gap-3 grid-cols-2">
        <NumberInput label="Cost (P)" value={armor.cost} min={0} showControls={false} onchange={(v) => (armor.cost = v)} />
      </div>

      <TextArea label="Notes" rows={2} placeholder="Notes — design, finish, stitched runes…" bind:value={armor.notes as string} />

      <div class="flex flex-wrap items-center gap-4">
        <Toggle label="Equipped" bind:checked={armor.equipped} />
        <Toggle label="Shield" bind:checked={armor.isShield as boolean} />
        <Toggle label="Helmet" bind:checked={armor.isHelmet as boolean} />
        <Toggle label="§ Prime-only" bind:checked={armor.primeOnly as boolean} />
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          onclick={ondelete}
          class="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-900/50 rounded-lg hover:border-red-700 hover:bg-red-900/20 transition"
        >
          Remove armor
        </button>
      </div>
    </div>
  {/if}
</div>

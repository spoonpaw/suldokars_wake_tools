<script lang="ts">
  /**
   * GearEditor — collapsible card for one EquipmentItem (inventory entry).
   * Header shows the name with a location badge, slot count, and cost.
   * Edit pane offers location/slot/cost/energyDraw/notes inputs.
   */
  import { untrack } from 'svelte';
  import type { EquipmentItem } from '$lib/models';
  import { Input, Select, NumberInput, TextArea } from '$lib/components/ui';
  import { formatSlots } from '$lib/utils/equipment';
  import { ammoTotal } from '$lib/utils/computed';

  interface Props {
    item: EquipmentItem;
    ondelete: () => void;
    startExpanded?: boolean;
  }

  let { item = $bindable(), ondelete, startExpanded = false }: Props = $props();

  // See WeaponEditor — `untrack` makes the "initial value only" intent explicit.
  let expanded = $state(untrack(() => startExpanded));

  const LOCATION_OPTS = [
    { value: 'worn', label: 'Worn (slots 1-9)' },
    { value: 'slot10', label: 'Slot 10' },
    { value: 'backpack', label: 'In backpack' },
    { value: 'no_slot', label: 'No-slot / worn' },
    { value: 'mission', label: 'Given by mission' },
    { value: 'storage', label: 'Storage' },
    { value: 'other', label: 'Other' }
  ];

  const LOCATION_LABEL: Record<EquipmentItem['location'], string> = {
    worn: 'Worn',
    slot10: 'Slot 10',
    backpack: 'Backpack',
    no_slot: 'No-slot',
    mission: 'Mission',
    storage: 'Storage',
    other: 'Other'
  };

  const totalAmmo = $derived(ammoTotal(item));
  const hasAmmo = $derived((item.ammoLoaded ?? 0) > 0 || (item.ammoSpare ?? 0) > 0);
</script>

<div class="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
  <!-- Header is a real <button> so keyboard users (Tab + Enter/Space) can expand the card. -->
  <button
    type="button"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
    class="w-full text-left p-3 hover:bg-neutral-800/50 transition cursor-pointer"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <span class="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{LOCATION_LABEL[item.location]}</span>
        <span class="font-semibold text-neutral-100">{item.name || 'Unnamed item'}</span>
        {#if item.freePick}
          <span class="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">free pick</span>
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
      <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{formatSlots(item.slots)}</span>
      {#if item.cost > 0}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{item.cost.toLocaleString()} P</span>
      {/if}
      {#if item.energyDraw}
        <span class="px-2 py-1 rounded bg-amber-500/10 text-amber-300">{item.energyDraw}</span>
      {/if}
      {#if hasAmmo}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">ammo {totalAmmo}</span>
      {/if}
    </div>

    {#if item.notes}
      <p class="mt-2 text-xs text-neutral-400">{item.notes}</p>
    {/if}
  </button>

  {#if expanded}
    <div class="border-t border-neutral-800 p-4 space-y-4">
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Input label="Name" placeholder="Item name" bind:value={item.name} />
        <Select label="Location" options={LOCATION_OPTS} bind:value={item.location as string} />
      </div>

      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <NumberInput label="Slots" value={item.slots} min={0} step={0.5} showControls={false} onchange={(v) => (item.slots = v)} />
        <NumberInput label="Cost (P)" value={item.cost} min={0} showControls={false} onchange={(v) => (item.cost = v)} />
        <!--
          Energy draw is a free-form string in the model so the catalog can
          carry any cadence (4e/d, 5e/d, 30e/d for vehicles, etc.). A select
          would have wiped non-listed values on change. Empty string clears
          the field.
        -->
        <Input label="Energy draw" placeholder="e.g. 1e/d, 2e/w" value={item.energyDraw ?? ''}
          onchange={(v: string) => (item.energyDraw = v.trim() || undefined)}
        />
      </div>

      <div class="grid gap-3 grid-cols-2">
        <NumberInput label="Ammo loaded" value={item.ammoLoaded ?? 0} min={0} showControls={false} onchange={(v) => (item.ammoLoaded = v || undefined)} />
        <NumberInput label="Ammo spare" value={item.ammoSpare ?? 0} min={0} showControls={false} onchange={(v) => (item.ammoSpare = v || undefined)} />
      </div>

      <TextArea label="Notes" rows={2} placeholder="Notes — qualities, charge level, who gifted it…" bind:value={item.notes as string} />

      <div class="flex justify-end">
        <button
          type="button"
          onclick={ondelete}
          class="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-900/50 rounded-lg hover:border-red-700 hover:bg-red-900/20 transition"
        >
          Remove item
        </button>
      </div>
    </div>
  {/if}
</div>

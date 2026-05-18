<script lang="ts">
  /**
   * GearEditor — collapsible card for one EquipmentItem (inventory entry).
   * Header shows the name with a location badge, slot count, and cost.
   * Edit pane offers location/slot/cost/energyDraw/notes inputs.
   */
  import { untrack } from 'svelte';
  import type { EquipmentItem, EquipmentLocation } from '$lib/models';
  import { Input, Select, Toggle, NumberInput, TextArea } from '$lib/components/ui';
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
  const carriedState = $derived(item.stashed ? 'Stashed' : item.equipped ? 'Equipped' : 'Carried');
  const carriedStateClass = $derived(
    item.stashed
      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
      : item.equipped
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-neutral-700/50 text-neutral-400 border border-neutral-600'
  );
  const grantsSlots = $derived(!item.stashed && item.equipped && item.isContainer && (item.containerSlots ?? 0) > 0);

  function defaultCarriedLocation(): EquipmentLocation {
    if (item.slots === 0) return 'no_slot';
    if (item.isContainer) return 'slot10';
    return 'worn';
  }

  function setEquipped(next: boolean) {
    item.equipped = next;
    if (next) {
      item.stashed = false;
      if (item.location === 'storage') item.location = defaultCarriedLocation();
    }
  }

  function setStashed(next: boolean) {
    item.stashed = next;
    if (next) {
      item.equipped = false;
      item.location = 'storage';
    } else if (item.location === 'storage') {
      item.location = defaultCarriedLocation();
    }
  }

  function setLocation(value: string) {
    item.location = value as EquipmentLocation;
    if (item.location === 'storage') {
      item.stashed = true;
      item.equipped = false;
    } else {
      item.stashed = false;
    }
  }

  function setContainer(next: boolean) {
    item.isContainer = next;
    if (next && !item.containerSlots) item.containerSlots = /carrier bot/i.test(item.name) ? 10 : 5;
    if (!next) item.containerSlots = 0;
  }
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
        <span class="text-xs px-1.5 py-0.5 rounded {carriedStateClass}">{carriedState}</span>
        <span class="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{LOCATION_LABEL[item.location]}</span>
        <span class="font-semibold text-neutral-100">{item.name || 'Unnamed item'}</span>
        {#if item.freePick}
          <span class="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">free pick</span>
        {/if}
        {#if item.isContainer}
          <span class="text-xs px-1.5 py-0.5 rounded {grantsSlots ? 'bg-cyan-500/20 text-cyan-300' : 'bg-neutral-800/70 text-neutral-400'}">
            +{item.containerSlots ?? 0} slots
          </span>
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
      {#if item.isContainer && !grantsSlots}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-500">container inactive</span>
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
        <Select label="Location" options={LOCATION_OPTS} value={item.location} disabled={item.stashed} onchange={setLocation} />
      </div>

      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
          <Toggle label="Equipped" checked={item.equipped} onchange={setEquipped} />
          <p class="mt-1 text-xs text-neutral-500">Ready or actively in use.</p>
        </div>
        <div class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
          <Toggle label="Stashed" checked={item.stashed} onchange={setStashed} />
          <p class="mt-1 text-xs text-neutral-500">Off-character; does not use slots.</p>
        </div>
        <div class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
          <Toggle label="Container" checked={item.isContainer ?? false} onchange={setContainer} />
          <p class="mt-1 text-xs text-neutral-500">Adds capacity only when equipped.</p>
        </div>
        <NumberInput
          label="Slots granted"
          value={item.containerSlots ?? 0}
          min={0}
          step={0.5}
          showControls={false}
          disabled={!item.isContainer}
          onchange={(v) => (item.containerSlots = v)}
        />
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
        <Input
          label="Energy draw"
          placeholder="e.g. 1e/d, 2e/w"
          value={item.energyDraw ?? ''}
          onchange={(v: string) => (item.energyDraw = v.trim() || undefined)}
        />
      </div>

      <div class="grid gap-3 grid-cols-2">
        <NumberInput
          label="Ammo loaded"
          value={item.ammoLoaded ?? 0}
          min={0}
          showControls={false}
          onchange={(v) => (item.ammoLoaded = v || undefined)}
        />
        <NumberInput
          label="Ammo spare"
          value={item.ammoSpare ?? 0}
          min={0}
          showControls={false}
          onchange={(v) => (item.ammoSpare = v || undefined)}
        />
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

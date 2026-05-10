<script lang="ts">
  /**
   * AddEquipmentModal — searchable catalog picker for SW equipment.
   *
   * Six tabs across the top:
   *   Weapons / Armor / Gear / Vehicles / Pets / Custom
   *
   * The first five list the matching catalog (`WEAPONS_DATA` etc.) filtered
   * by the search input. Click a row → calls the matching `onadd*` callback
   * with a freshly-built character item (id generated, all stats copied).
   * The Custom tab spawns a blank record so the player can free-form a
   * weapon / armor / gear that's not in the catalog.
   *
   * Vehicles and Pets are stored as inventory items (no first-class slot
   * on the character schema yet) — see helpers in utils/equipment.ts.
   */
  import { Modal, Input } from '$lib/components/ui';
  import {
    WEAPONS_DATA,
    ARMOR_DATA,
    GEAR_DATA,
    VEHICLES_DATA,
    PETS_DATA
  } from '$lib/data';
  import {
    weaponFromDef,
    armorFromDef,
    gearFromDef,
    vehicleFromDef,
    petFromDef,
    blankWeapon,
    blankArmor,
    blankGear,
    formatSlots,
    formatCost
  } from '$lib/utils/equipment';
  import type { CharacterWeapon, CharacterArmor, EquipmentItem } from '$lib/models';

  type Tab = 'weapons' | 'armor' | 'gear' | 'vehicles' | 'pets' | 'custom';
  type CustomKind = 'weapon' | 'armor' | 'gear';

  interface Props {
    open: boolean;
    onclose: () => void;
    /** Default tab on open; lets the parent surface "Add weapon" vs "Add armor" buttons. */
    initialTab?: Tab;
    onaddweapon?: (w: CharacterWeapon) => void;
    onaddarmor?: (a: CharacterArmor) => void;
    onaddgear?: (g: EquipmentItem) => void;
  }

  let {
    open,
    onclose,
    initialTab = 'weapons',
    onaddweapon,
    onaddarmor,
    onaddgear
  }: Props = $props();

  // tab/search/customKind are reset every time the modal opens via the
  // $effect below, so a literal default is fine here. The $effect is the
  // canonical source of truth — whatever `initialTab` currently is at
  // open-time wins.
  let tab = $state<Tab>('weapons');
  let search = $state('');
  let customKind = $state<CustomKind>('weapon');

  // Reset state on each open so re-opening starts at the requested tab
  // and a fresh search instead of inheriting the last view.
  $effect(() => {
    if (open) {
      tab = initialTab;
      search = '';
      customKind = initialTab === 'armor' ? 'armor' : initialTab === 'gear' ? 'gear' : 'weapon';
    }
  });

  const matches = (s: string) => s.toLowerCase().includes(search.toLowerCase().trim());

  const filteredWeapons = $derived(WEAPONS_DATA.filter((w) => matches(w.name) || w.specials.some(matches)));
  const filteredArmor = $derived(ARMOR_DATA.filter((a) => matches(a.name) || matches(a.strength) || matches(a.weakness)));
  const filteredGear = $derived(GEAR_DATA.filter((g) => matches(g.name) || (g.notes ? matches(g.notes) : false)));
  const filteredVehicles = $derived(VEHICLES_DATA.filter((v) => matches(v.name) || matches(v.use)));
  const filteredPets = $derived(PETS_DATA.filter((p) => matches(p.name) || matches(p.use)));

  function pickWeapon(def: typeof WEAPONS_DATA[number]) {
    const w = weaponFromDef(def);
    onaddweapon?.(w);
    onclose();
  }

  function pickArmor(def: typeof ARMOR_DATA[number]) {
    const a = armorFromDef(def);
    onaddarmor?.(a);
    onclose();
  }

  function pickGear(def: typeof GEAR_DATA[number]) {
    const g = gearFromDef(def);
    onaddgear?.(g);
    onclose();
  }

  function pickVehicle(def: typeof VEHICLES_DATA[number]) {
    const v = vehicleFromDef(def);
    onaddgear?.(v);
    onclose();
  }

  function pickPet(def: typeof PETS_DATA[number]) {
    const p = petFromDef(def);
    onaddgear?.(p);
    onclose();
  }

  function addCustom() {
    if (customKind === 'weapon') {
      onaddweapon?.(blankWeapon());
    } else if (customKind === 'armor') {
      onaddarmor?.(blankArmor());
    } else {
      onaddgear?.(blankGear());
    }
    onclose();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'weapons', label: 'Weapons' },
    { id: 'armor', label: 'Armor' },
    { id: 'gear', label: 'Gear' },
    { id: 'vehicles', label: 'Vehicles' },
    { id: 'pets', label: 'Pets' },
    { id: 'custom', label: 'Custom' }
  ];
</script>

<Modal {open} title="Add equipment" {onclose}>
  <!-- Tabs -->
  <div class="flex flex-wrap gap-1 mb-3">
    {#each TABS as t (t.id)}
      <button
        type="button"
        onclick={() => (tab = t.id)}
        class={`rounded-full border px-3 py-1 text-xs transition ${tab === t.id ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500 hover:text-neutral-100'}`}
      >
        {t.label}
      </button>
    {/each}
  </div>

  {#if tab !== 'custom'}
    <Input placeholder="Search by name…" bind:value={search} />
  {/if}

  <div class="mt-3 max-h-[60vh] overflow-y-auto space-y-2 pr-1">
    {#if tab === 'weapons'}
      {#each filteredWeapons as def (def.id)}
        <button
          type="button"
          onclick={() => pickWeapon(def)}
          class="w-full p-3 text-left rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 hover:border-cyan-600 transition"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium text-neutral-100">{def.name}</span>
            <span class="text-sm text-cyan-400 tabular-nums">{def.damage} {def.damageType}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            <span>{formatSlots(def.slots)}</span>
            <span>{def.range.replace('_', ' ')}</span>
            {#if def.clip}<span>clip {def.clip}</span>{/if}
            <span>{formatCost(def.cost)}</span>
            <span>kit {def.kit}</span>
            {#if def.specials.length > 0}
              <span class="text-yellow-300">{def.specials.join(', ')}</span>
            {/if}
          </div>
          {#if def.notes}
            <p class="mt-1 text-xs text-neutral-400">{def.notes}</p>
          {/if}
        </button>
      {:else}
        <p class="py-6 text-center text-sm text-neutral-500">No weapons match "{search}".</p>
      {/each}
    {:else if tab === 'armor'}
      {#each filteredArmor as def (def.id)}
        <button
          type="button"
          onclick={() => pickArmor(def)}
          class="w-full p-3 text-left rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 hover:border-cyan-600 transition"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium text-neutral-100">{def.name}{def.primeOnly ? ' §' : ''}</span>
            <span class="text-sm text-cyan-400 tabular-nums">{formatSlots(def.slots)}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            {#if def.strength}<span class="text-green-300">strength: {def.strength}</span>{/if}
            {#if def.weakness}<span class="text-red-300">weakness: {def.weakness}</span>{/if}
            {#if def.kit}<span>kit {def.kit}</span>{/if}
            <span>{formatCost(def.cost)}</span>
          </div>
          <p class="mt-1 text-xs text-neutral-400">{def.notes}</p>
        </button>
      {:else}
        <p class="py-6 text-center text-sm text-neutral-500">No armor matches "{search}".</p>
      {/each}
    {:else if tab === 'gear'}
      {#each filteredGear as def (def.id)}
        <button
          type="button"
          onclick={() => pickGear(def)}
          class="w-full p-3 text-left rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 hover:border-cyan-600 transition"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium text-neutral-100">{def.name}</span>
            <span class="text-sm text-cyan-400 tabular-nums">{formatCost(def.cost)}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            <span>{formatSlots(def.slots)}</span>
            {#if def.kit}<span>kit {def.kit}</span>{/if}
            {#if def.energy}<span class="text-amber-300">{def.energy}</span>{/if}
          </div>
          {#if def.notes}
            <p class="mt-1 text-xs text-neutral-400">{def.notes}</p>
          {/if}
        </button>
      {:else}
        <p class="py-6 text-center text-sm text-neutral-500">No gear matches "{search}".</p>
      {/each}
    {:else if tab === 'vehicles'}
      {#each filteredVehicles as def (def.id)}
        <button
          type="button"
          onclick={() => pickVehicle(def)}
          class="w-full p-3 text-left rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 hover:border-cyan-600 transition"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium text-neutral-100">{def.name}</span>
            <span class="text-sm text-cyan-400 tabular-nums">{formatCost(def.cost)}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            <span>{def.use}</span>
            <span class="capitalize">{def.category}</span>
            {#if def.energyPerDay > 0}<span class="text-amber-300">{def.energyPerDay} e/day</span>{/if}
          </div>
          {#if def.notes}
            <p class="mt-1 text-xs text-neutral-400">{def.notes}</p>
          {/if}
        </button>
      {:else}
        <p class="py-6 text-center text-sm text-neutral-500">No vehicles match "{search}".</p>
      {/each}
    {:else if tab === 'pets'}
      {#each filteredPets as def (def.id)}
        <button
          type="button"
          onclick={() => pickPet(def)}
          class="w-full p-3 text-left rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 hover:border-cyan-600 transition"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium text-neutral-100">{def.name}</span>
            <span class="text-sm text-cyan-400 tabular-nums">{formatCost(def.cost)}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            <span>{def.use}</span>
            {#if def.upkeepPerWeek > 0}<span>upkeep {def.upkeepPerWeek} P/week</span>{/if}
          </div>
          {#if def.notes}
            <p class="mt-1 text-xs text-neutral-400">{def.notes}</p>
          {/if}
        </button>
      {:else}
        <p class="py-6 text-center text-sm text-neutral-500">No pets match "{search}".</p>
      {/each}
    {:else}
      <!-- Custom -->
      <div class="py-4 space-y-3">
        <p class="text-sm text-neutral-300">
          Add a blank item and fill it in yourself. The card opens expanded so all
          fields are immediately visible.
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={() => (customKind = 'weapon')}
            class={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${customKind === 'weapon' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500'}`}
          >
            Weapon
          </button>
          <button
            type="button"
            onclick={() => (customKind = 'armor')}
            class={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${customKind === 'armor' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500'}`}
          >
            Armor
          </button>
          <button
            type="button"
            onclick={() => (customKind = 'gear')}
            class={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${customKind === 'gear' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500'}`}
          >
            Gear
          </button>
        </div>
        <button
          type="button"
          onclick={addCustom}
          class="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 transition"
        >
          Create blank {customKind}
        </button>
      </div>
    {/if}
  </div>
</Modal>

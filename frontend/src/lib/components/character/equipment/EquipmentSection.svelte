<script lang="ts">
  /**
   * EquipmentSection — top-level wrapper for the Equipment tab in BOTH view
   * and edit modes (driven by `mode` prop). Renders three sections:
   *   - Weapons
   *   - Armor
   *   - Inventory (gear + kits + visible vehicle/pet records)
   *
   * In view mode each section lists items as compact read-only rows. In edit
   * mode each item gets its expandable {Weapon,Armor,Gear}Editor card and
   * each section grows an "Add" button that opens the AddEquipmentModal
   * pre-targeted to the matching tab.
   *
   * The slots-used summary line appears at the bottom in both modes —
   * matches the legacy layout the players are used to.
   */
  import { tick } from 'svelte';
  import type { SWCharacter, CharacterWeapon, CharacterArmor, EquipmentItem } from '$lib/models';
  import { Card, EmptyState } from '$lib/components/ui';
  import { ammoTotal, encumbranceStatus, totalSlots, usedSlots } from '$lib/utils/computed';
  import { formatSlots } from '$lib/utils/equipment';
  import WeaponEditor from './WeaponEditor.svelte';
  import ArmorEditor from './ArmorEditor.svelte';
  import GearEditor from './GearEditor.svelte';
  import AddEquipmentModal from './AddEquipmentModal.svelte';

  type Mode = 'view' | 'edit';

  interface Props {
    character: SWCharacter;
    mode: Mode;
  }

  let { character = $bindable(), mode }: Props = $props();

  let modalOpen = $state(false);
  let modalInitialTab = $state<'weapons' | 'armor' | 'gear' | 'kits' | 'vehicles' | 'pets' | 'custom'>('weapons');
  // Track newly added items so their editor card opens expanded immediately —
  // makes the catalog → tweak flow seamless. CLEARED ON THE NEXT MICROTASK
  // so a later remount (tab switch in the parent) doesn't reopen cards the
  // player collapsed in between. The card's local `expanded` state captures
  // the initial value via `untrack`, so by the time the set is empty again
  // the freshly-added card is already showing expanded; the set only matters
  // for the very first render.
  let freshlyAddedIds = $state<Set<string>>(new Set());

  async function markFresh(id: string) {
    freshlyAddedIds = new Set([...freshlyAddedIds, id]);
    // Clear AFTER the next render commit so the just-mounted editor card
    // reads `true` from the set when its $state initializer fires, then
    // we drop the id so a later remount (e.g. parent tab switch) starts
    // collapsed. `tick()` resolves once Svelte has flushed the DOM.
    await tick();
    const next = new Set(freshlyAddedIds);
    next.delete(id);
    freshlyAddedIds = next;
  }

  function openAdd(tab: typeof modalInitialTab) {
    modalInitialTab = tab;
    modalOpen = true;
  }

  function addWeapon(w: CharacterWeapon) {
    character.weapons = [...character.weapons, w];
    markFresh(w.id);
  }
  function removeWeapon(id: string) {
    character.weapons = character.weapons.filter((w) => w.id !== id);
  }

  function addArmor(a: CharacterArmor) {
    character.armor = [...character.armor, a];
    markFresh(a.id);
  }
  function removeArmor(id: string) {
    character.armor = character.armor.filter((a) => a.id !== id);
  }

  function addInventory(g: EquipmentItem) {
    character.inventory = [...character.inventory, g];
    markFresh(g.id);
  }
  function removeInventory(id: string) {
    character.inventory = character.inventory.filter((i) => i.id !== id);
  }

  // Derived for the bottom summary line.
  const slotsUsed = $derived(usedSlots(character));
  const slotsCap = $derived(totalSlots(character));
  const enc = $derived(encumbranceStatus(character));
  const encColor = $derived(enc === 'ok' ? 'text-neutral-400' : enc === 'overloaded' ? 'text-amber-300' : 'text-red-400');
  const encLabel = $derived(enc === 'severely_overloaded' ? 'severely overloaded' : enc);
  const activeContainerNetSlots = $derived(
    character.inventory.reduce((sum, item) => {
      if (item.stashed || !item.equipped || !item.isContainer) return sum;
      return sum + Math.max(0, (item.containerSlots ?? 0) - item.slots);
    }, 0)
  );

  const LOCATION_LABEL: Record<EquipmentItem['location'], string> = {
    worn: 'Worn',
    slot10: 'Slot 10',
    backpack: 'In backpack',
    no_slot: 'No slot',
    mission: 'Mission',
    storage: 'Storage',
    other: 'Other'
  };

  function carryState(item: { equipped?: boolean; stashed?: boolean }): string {
    if (item.stashed) return 'Stashed';
    if (item.equipped) return 'Equipped';
    return 'Carried';
  }

  function carryStateClass(item: { equipped?: boolean; stashed?: boolean }): string {
    if (item.stashed) return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    if (item.equipped) return 'bg-green-500/15 text-green-300 border-green-500/30';
    return 'bg-neutral-800 text-neutral-400 border-neutral-700';
  }

  function locationLabel(location: EquipmentItem['location']): string {
    return LOCATION_LABEL[location] ?? 'Other';
  }

  function containerLabel(item: EquipmentItem): string {
    const slots = item.containerSlots ?? 0;
    if (!item.isContainer) return '';
    if (!item.stashed && item.equipped) return `Container holds ${formatSlots(slots)}`;
    return `Container holds ${formatSlots(slots)} when equipped`;
  }

  function containerClass(item: EquipmentItem): string {
    if (item.stashed || !item.equipped) return 'bg-neutral-800 text-neutral-400';
    return 'bg-cyan-500/15 text-cyan-300';
  }
</script>

<div class="space-y-4">
  <!-- WEAPONS -->
  <Card title="Weapons">
    {#if character.weapons.length === 0}
      {#if mode === 'edit'}
        <EmptyState title="No weapons yet" message="Pick from the catalog or add a custom weapon." />
      {:else}
        <p class="text-sm text-neutral-500">No weapons.</p>
      {/if}
    {:else if mode === 'edit'}
      <div class="space-y-3">
        {#each character.weapons as _w, i (character.weapons[i].id)}
          <WeaponEditor
            bind:weapon={character.weapons[i]}
            startExpanded={freshlyAddedIds.has(character.weapons[i].id)}
            ondelete={() => removeWeapon(character.weapons[i].id)}
          />
        {/each}
      </div>
    {:else}
      <ul class="space-y-2">
        {#each character.weapons as w (w.id)}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="flex flex-wrap items-center gap-2 font-semibold text-neutral-100">
                <span class="text-xs px-1.5 py-0.5 rounded border font-medium {carryStateClass(w)}">{carryState(w)}</span>
                {w.name}
              </span>
              <span class="text-sm text-cyan-300 tabular-nums">{w.damage} {w.damageType}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400 tabular-nums">
              <span>{formatSlots(w.slots)}</span>
              <span>{w.range.replace('_', ' ')}</span>
              {#if w.clip}<span>clip {w.clip} · ammo {ammoTotal(w)}</span>{/if}
              {#if w.specials && w.specials.length > 0}<span class="text-yellow-300">{w.specials.join(', ')}</span>{/if}
            </div>
            {#if w.notes}<p class="mt-1 text-xs text-neutral-500">{w.notes}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if mode === 'edit'}
      <button
        type="button"
        onclick={() => openAdd('weapons')}
        class="mt-3 w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add weapon
      </button>
    {/if}
  </Card>

  <!-- ARMOR -->
  <Card title="Armor">
    {#if character.armor.length === 0}
      {#if mode === 'edit'}
        <EmptyState title="No armor yet" message="Pick from the catalog or add a custom armor piece." />
      {:else}
        <p class="text-sm text-neutral-500">No armor.</p>
      {/if}
    {:else if mode === 'edit'}
      <div class="space-y-3">
        {#each character.armor as _a, i (character.armor[i].id)}
          <ArmorEditor
            bind:armor={character.armor[i]}
            startExpanded={freshlyAddedIds.has(character.armor[i].id)}
            ondelete={() => removeArmor(character.armor[i].id)}
          />
        {/each}
      </div>
    {:else}
      <ul class="space-y-2">
        {#each character.armor as a (a.id)}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="flex flex-wrap items-center gap-2 font-semibold text-neutral-100">
                <span class="text-xs px-1.5 py-0.5 rounded border font-medium {carryStateClass(a)}">{carryState(a)}</span>
                {a.name}
                {#if a.isShield}<span class="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">Shield</span>{/if}
                {#if a.isHelmet}<span class="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">Helmet</span>{/if}
                {#if a.primeOnly}<span class="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Prime-only</span>{/if}
              </span>
              <span class="text-sm text-cyan-300 tabular-nums">{formatSlots(a.slots)}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
              {#if a.strength}<span class="text-green-300">strength: {a.strength}</span>{/if}
              {#if a.weakness}<span class="text-red-300">weakness: {a.weakness}</span>{/if}
            </div>
            {#if a.notes}<p class="mt-1 text-xs text-neutral-500">{a.notes}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if mode === 'edit'}
      <button
        type="button"
        onclick={() => openAdd('armor')}
        class="mt-3 w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add armor
      </button>
    {/if}
  </Card>

  <!-- INVENTORY (gear + kits + visible vehicle/pet records) -->
  <Card title="Inventory">
    {#if character.inventory.length === 0}
      {#if mode === 'edit'}
        <EmptyState title="Empty" message="Pick gear, kits, vehicles, or pets from the catalog, or add a custom item." />
      {:else}
        <p class="text-sm text-neutral-500">Empty.</p>
      {/if}
    {:else if mode === 'edit'}
      <div class="space-y-3">
        {#each character.inventory as _i, idx (character.inventory[idx].id)}
          <GearEditor
            bind:item={character.inventory[idx]}
            startExpanded={freshlyAddedIds.has(character.inventory[idx].id)}
            ondelete={() => removeInventory(character.inventory[idx].id)}
          />
        {/each}
      </div>
    {:else}
      <ul class="space-y-2">
        {#each character.inventory as i (i.id)}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="flex flex-wrap items-center gap-2 font-semibold text-neutral-100">
                <span class="text-xs px-1.5 py-0.5 rounded border font-medium {carryStateClass(i)}">{carryState(i)}</span>
                <span class="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{locationLabel(i.location)}</span>
                {i.name}
                {#if i.isContainer}
                  <span class="text-xs px-1.5 py-0.5 rounded {containerClass(i)}">{containerLabel(i)}</span>
                {/if}
              </span>
              <span class="text-sm text-cyan-300 tabular-nums">{formatSlots(i.slots)}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400 tabular-nums">
              {#if i.cost > 0}<span>{i.cost.toLocaleString()} P</span>{/if}
              {#if i.energyDraw}<span class="text-amber-300">{i.energyDraw}</span>{/if}
              {#if (i.ammoLoaded ?? 0) > 0 || (i.ammoSpare ?? 0) > 0}<span>ammo {ammoTotal(i)}</span>{/if}
            </div>
            {#if i.notes}<p class="mt-1 text-xs text-neutral-500">{i.notes}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if mode === 'edit'}
      <div class="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onclick={() => openAdd('gear')}
          class="py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg
          >
          Add gear
        </button>
        <button
          type="button"
          onclick={() => openAdd('kits')}
          class="py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg
          >
          Add kit
        </button>
        <button
          type="button"
          onclick={() => openAdd('vehicles')}
          class="py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg
          >
          Add vehicle / drone
        </button>
        <button
          type="button"
          onclick={() => openAdd('pets')}
          class="py-2 text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-neutral-700 rounded-lg hover:border-cyan-500 transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg
          >
          Add pet
        </button>
      </div>
    {/if}
  </Card>

  <!-- Slot summary -->
  <p class={`text-sm ${encColor}`}>
    Slots: <strong class="text-neutral-200 tabular-nums">{slotsUsed} / {slotsCap}</strong> ({encLabel})
    {#if activeContainerNetSlots > 0}
      <span class="text-neutral-500"> · {formatSlots(activeContainerNetSlots)} net from equipped containers</span>
    {/if}
  </p>
</div>

{#if mode === 'edit'}
  <AddEquipmentModal
    open={modalOpen}
    initialTab={modalInitialTab}
    onclose={() => (modalOpen = false)}
    onaddweapon={addWeapon}
    onaddarmor={addArmor}
    onaddgear={addInventory}
  />
{/if}

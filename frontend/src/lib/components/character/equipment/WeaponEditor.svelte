<script lang="ts">
  /**
   * WeaponEditor — collapsible card for one CharacterWeapon. Header shows
   * the equipped pill, name, key stats (damage, slots, range, ammo), and a
   * chevron that toggles the edit pane open. Edit pane uses a 3-col field
   * grid that collapses to 1 col on narrow screens. Ammo loaded/spare are
   * sub-fielded for clarity.
   */
  import { untrack } from 'svelte';
  import type { CharacterWeapon } from '$lib/models';
  import { Input, Select, Toggle, NumberInput, TextArea } from '$lib/components/ui';
  import { ammoTotal } from '$lib/utils/computed';
  import { formatSlots } from '$lib/utils/equipment';

  interface Props {
    weapon: CharacterWeapon;
    ondelete: () => void;
    /** Whether the card starts expanded (e.g. a freshly added blank). */
    startExpanded?: boolean;
  }

  let { weapon = $bindable(), ondelete, startExpanded = false }: Props = $props();

  // Initial expansion is set once from `startExpanded` (e.g. true for a
  // freshly-added blank). Subsequent toggles are local to this card —
  // wrapping the prop read in `untrack` silences Svelte's "reference only
  // captures the initial value" hint since that's exactly the behaviour
  // we want.
  let expanded = $state(untrack(() => startExpanded));

  // Centralised opt lists — same vocabulary as CharacterEditForm previously
  // used so the data round-trips cleanly with old characters.
  const DAMAGE_OPTS = ['d3', 'd4', 'd6', 'd8', 'd10', 'd12', 'special', 'none'].map((d) => ({ value: d, label: d }));
  const DAMAGE_TYPE_OPTS = ['slashing', 'piercing', 'bludgeoning', 'kinetic', 'energy', 'non-injuring', 'varies'].map((d) => ({
    value: d,
    label: d
  }));
  const RANGE_OPTS = [
    { value: 'melee', label: 'Melee' },
    { value: 'room', label: 'Room' },
    { value: 'range', label: 'Range' },
    { value: 'long_range', label: 'Long range' }
  ];

  const totalAmmo = $derived(ammoTotal(weapon));
  const specialsText = $derived((weapon.specials ?? []).join(', '));
  // Local buffer for the comma-separated input so trailing commas don't
  // get eaten mid-typing. Initialised once from the array; the editor
  // commits to weapon.specials inside onchange. We do NOT $derive the
  // buffer from specialsText (that'd snap the cursor on every keystroke),
  // but we re-sync if the underlying weapon id changes — i.e. the editor
  // is bound to a different weapon (parent reordering, swap, etc.).
  let specialsBuffer = $state(untrack(() => specialsText));
  let lastSyncedId = $state(weapon.id);
  $effect(() => {
    if (weapon.id !== lastSyncedId) {
      specialsBuffer = (weapon.specials ?? []).join(', ');
      lastSyncedId = weapon.id;
    }
  });

  const carriedState = $derived(weapon.stashed ? 'Stashed' : weapon.equipped ? 'Equipped' : 'Carried');
  const carriedStateClass = $derived(
    weapon.stashed
      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
      : weapon.equipped
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-neutral-700/50 text-neutral-400 border border-neutral-600'
  );

  function setEquipped(next: boolean) {
    weapon.equipped = next;
    if (next) weapon.stashed = false;
  }

  function setStashed(next: boolean) {
    weapon.stashed = next;
    if (next) weapon.equipped = false;
  }
</script>

<div class="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
  <!--
    Header is a real <button> so keyboard users (Tab + Enter/Space) can
    expand the card. The state pill below is a role="switch" span with
    `stopPropagation` so toggling Equipped doesn't also flip expansion.
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
          aria-checked={weapon.equipped}
          onclick={(e) => {
            e.stopPropagation();
            setEquipped(!weapon.equipped);
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setEquipped(!weapon.equipped);
            }
          }}
          class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer {carriedStateClass}"
        >
          {#if weapon.equipped}
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
              ><path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              /></svg
            >
          {:else}
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              ><circle cx="12" cy="12" r="10" stroke-width="2" /></svg
            >
          {/if}
          {carriedState}
        </span>
        <span class="font-semibold text-neutral-100">{weapon.name || 'Unnamed weapon'}</span>
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

    <!-- Stats row -->
    <div class="flex flex-wrap gap-2 mt-2 text-xs tabular-nums">
      <span class="px-2 py-1 rounded bg-neutral-800 text-cyan-400 font-semibold">{weapon.damage} {weapon.damageType}</span>
      <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{formatSlots(weapon.slots)}</span>
      <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{weapon.range.replace('_', ' ')}</span>
      {#if weapon.clip}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">clip {weapon.clip} · ammo {totalAmmo}</span>
      {/if}
      {#if weapon.cost > 0}
        <span class="px-2 py-1 rounded bg-neutral-800/50 text-neutral-400">{weapon.cost} P</span>
      {/if}
    </div>

    {#if specialsText}
      <div class="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
        <span class="font-medium">Specials:</span>
        {specialsText}
      </div>
    {/if}

    {#if weapon.notes}
      <p class="mt-2 text-xs text-neutral-400">{weapon.notes}</p>
    {/if}
  </button>

  <!-- Expanded edit pane -->
  {#if expanded}
    <div class="border-t border-neutral-800 p-4 space-y-4">
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Input label="Name" placeholder="Weapon name" bind:value={weapon.name} />
        <Select label="Damage" options={DAMAGE_OPTS} bind:value={weapon.damage as string} />
      </div>

      <div class="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Select label="Type" options={DAMAGE_TYPE_OPTS} bind:value={weapon.damageType as string} />
        <Select label="Range" options={RANGE_OPTS} bind:value={weapon.range as string} />
        <NumberInput label="Slots" value={weapon.slots} min={0} step={0.5} showControls={false} onchange={(v) => (weapon.slots = v)} />
        <NumberInput label="Cost (P)" value={weapon.cost} min={0} showControls={false} onchange={(v) => (weapon.cost = v)} />
      </div>

      <div class="grid gap-3 grid-cols-3">
        <NumberInput label="Clip" value={weapon.clip ?? 0} min={0} showControls={false} onchange={(v) => (weapon.clip = v)} />
        <NumberInput label="Loaded" value={weapon.ammoLoaded ?? 0} min={0} showControls={false} onchange={(v) => (weapon.ammoLoaded = v)} />
        <NumberInput label="Spare" value={weapon.ammoSpare ?? 0} min={0} showControls={false} onchange={(v) => (weapon.ammoSpare = v)} />
      </div>

      <!--
        Specials is an array on the model but comma-separated text in the UI.
        We KEEP a local string buffer so the user can type a trailing ", "
        without our split/filter dropping it and snapping the cursor. The
        committed array is rebuilt on every keystroke so the header summary
        reflects the value, but the input box reads from the buffer.
      -->
      <Input
        label="Specials (comma-separated)"
        placeholder="Burst, Silencer"
        bind:value={specialsBuffer}
        onchange={(v: string) => {
          specialsBuffer = v;
          const parts = v
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          weapon.specials = parts.length > 0 ? parts : [];
        }}
      />

      <TextArea label="Notes" rows={2} placeholder="Notes — location, condition, marks…" bind:value={weapon.notes as string} />

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-4">
          <Toggle label="Equipped" checked={weapon.equipped} onchange={setEquipped} />
          <Toggle label="Stashed" checked={weapon.stashed} onchange={setStashed} />
        </div>
        <button
          type="button"
          onclick={ondelete}
          class="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-900/50 rounded-lg hover:border-red-700 hover:bg-red-900/20 transition"
        >
          Remove weapon
        </button>
      </div>
    </div>
  {/if}
</div>

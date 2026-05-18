<!--
  HarmTrackerPanel.svelte — full harm tracker (rules/46 + 50 + 51).

  Composes:
    - HarmMeter (visualization)
    - Status badge
    - Damage in (presets + custom)
    - Heal (-1 / -d6 long rest stub / -d6 quick rest stub)
    - End-roll trigger (when pending or forced)
    - Suspend / unsuspend
    - Quick reset

  Modals deferred to a follow-up: True Grit Ghost, dying timer reveal,
  medifact picker, coma cron, detrimental-keyword skip-aid. The state
  machine is wired so adding those is a matter of new buttons + event
  handlers; the underlying transitions all already work.
-->
<script lang="ts">
  import type { SWCharacter, HarmStatus } from '$lib/models/SWCharacter';
  import {
    endRollDN,
    isEndRollRequired,
    isForcedRoll,
    canSuspend,
    applyPhysicalHarm,
    applyNaniteHarm,
    healPhysicalHarm,
    healNaniteHarm,
    endRollPass,
    endRollFail,
    suspendEndRoll,
    resetHarm,
    statusBadge
  } from '$lib/utils/computed';
  import HarmMeter from './HarmMeter.svelte';
  import { Card, Button, Select, TextArea } from '$lib/components/ui';

  interface Props {
    character: SWCharacter;
    /** Read-only mode — used by the view sheet. Hides all action buttons. */
    readOnly?: boolean;
    /** Fired after each mutation so callers (e.g. view page) can persist. */
    onMutate?: () => void;
  }

  let { character = $bindable(), readOnly = false, onMutate }: Props = $props();
  function notify() {
    onMutate?.();
  }

  // ---- Single damage input ----
  let amount = $state(1);

  // ---- Derived ----
  const bulk = $derived(character.stacks.bulk);
  const dn = $derived(endRollDN(character.harm));
  const requireRoll = $derived(isEndRollRequired(character.harm, bulk));
  const forced = $derived(isForcedRoll(character.harm));
  const suspendOk = $derived(canSuspend(character.harm));
  const badge = $derived(statusBadge(character.harm.status));
  const statusNote = $derived((character.harm.statusNote ?? '').trim());

  const STATUS_OPTIONS: { value: HarmStatus; label: string }[] = [
    { value: 'unharmed', label: 'Unharmed' },
    { value: 'harmed', label: 'Harmed' },
    { value: 'end-roll-pending', label: 'End roll pending' },
    { value: 'suspended', label: 'End roll suspended' },
    { value: 'injured', label: 'Injured' },
    { value: 'injured-knocked-down', label: 'Injured + knocked down' },
    { value: 'injured-knocked-out', label: 'Injured + knocked out' },
    { value: 'dying', label: 'Dying' },
    { value: 'comatose', label: 'Comatose' },
    { value: 'dead', label: 'Dead' }
  ];

  // Tone → Tailwind colour helper.
  const toneClasses: Record<string, string> = {
    ok: 'bg-emerald-700 text-white',
    warn: 'bg-amber-700 text-white',
    danger: 'bg-orange-700 text-white',
    critical: 'bg-red-700 text-white'
  };

  // ---- Action wrappers ----
  function dmg(n: number) {
    character.harm = applyPhysicalHarm(character, n);
    amount = 0;
    notify();
  }
  function nano(n: number) {
    // No dice in the harm tracker — coma-days roll is left for the GM.
    character.harm = applyNaniteHarm(character, n);
    amount = 0;
    notify();
  }
  function heal(n: number) {
    character.harm = healPhysicalHarm(character, n);
    amount = 0;
    notify();
  }
  function healNano(n: number) {
    character.harm = healNaniteHarm(character, n);
    amount = 0;
    notify();
  }
  function pass() {
    character.harm = endRollPass(character);
    notify();
  }
  function fail() {
    // No dice in the harm tracker — dying d20 timer is for the GM to roll.
    character.harm = endRollFail(character);
    notify();
  }
  function suspend() {
    character.harm = suspendEndRoll(character);
    notify();
  }
  function setStatus(value: string) {
    const status = value as HarmStatus;
    character.harm.status = status;
    character.harm.endRollSuspended = status === 'suspended';
    if (status === 'suspended') character.harm.suspendedAtHarm = character.harm.harmTaken;
    if (status === 'dying' && !character.harm.dyingTimerUnit)
      character.harm.dyingTimerUnit = character.type === 'prime' ? 'minute' : 'round';
    if (status !== 'dying') {
      character.harm.dyingTimer = null;
      character.harm.dyingTimerUnit = null;
    }
    notify();
  }
  function setStatusNote(value: string) {
    character.harm.statusNote = value;
    notify();
  }
  function reset() {
    character.harm = resetHarm(character);
    notify();
  }
</script>

<Card title="Harm tracker">
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <span class={`rounded-full px-3 py-1 text-xs font-bold uppercase ${toneClasses[badge.tone]}`}>
        {badge.label}
      </span>
      {#if requireRoll}
        <span class="rounded-full bg-red-900/40 px-3 py-1 text-xs font-medium text-red-200">
          End roll DN <strong>{dn}</strong>{forced ? ' · FORCED (no suspend)' : ''}
        </span>
      {/if}
      {#if character.harm.naniteTaken > 0}
        <span class="rounded-full bg-cyan-900/40 px-3 py-1 text-xs font-medium text-cyan-200"> ⚠ Nanite harm raises hit risk </span>
      {/if}
      {#if character.harm.endRollSuspended}
        <span class="rounded-full bg-amber-900/40 px-3 py-1 text-xs font-medium text-amber-200">
          Roll suspended @ {character.harm.suspendedAtHarm}
        </span>
      {/if}
      {#if character.harm.status === 'dying'}
        <span class="rounded-full bg-red-900/40 px-3 py-1 text-xs font-medium text-red-200">
          Dying — ??? {character.harm.dyingTimerUnit}{character.harm.dyingTimerUnit === 'minute' ? 's' : 's'} (GM rolls)
        </span>
      {/if}
      {#if character.harm.status === 'comatose'}
        <span class="rounded-full bg-cyan-900/40 px-3 py-1 text-xs font-medium text-cyan-200">
          Coma · {character.harm.comaDays ?? '?'} days · daily DN 20 Ghost
        </span>
      {/if}
      {#if statusNote}
        <span class="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">{statusNote}</span>
      {/if}
    </div>
  </div>

  <HarmMeter harm={character.harm} bulkScore={bulk} />

  {#if !readOnly}
    <div class="mt-4 space-y-3">
      <div class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
        <div class="grid gap-3 grid-cols-1 sm:grid-cols-[minmax(12rem,16rem)_1fr]">
          <Select label="Status" options={STATUS_OPTIONS} value={character.harm.status} onchange={setStatus} />
          <TextArea
            label="Status note"
            rows={2}
            value={character.harm.statusNote ?? ''}
            placeholder="True Grit, aid, bleeding, injury, GM ruling…"
            onchange={setStatusNote}
          />
        </div>
      </div>

      <div>
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Apply harm</p>
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="0"
            bind:value={amount}
            class="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center text-sm text-neutral-100 focus:border-cyan-600 focus:outline-none"
          />
          <Button variant="secondary" onclick={() => dmg(amount)} disabled={amount <= 0}>+ Physical</Button>
          <Button variant="ghost" onclick={() => heal(amount)} disabled={amount <= 0}>− Physical</Button>
          <Button variant="secondary" onclick={() => nano(amount)} disabled={amount <= 0}>+ Nanite</Button>
          <Button variant="ghost" onclick={() => healNano(amount)} disabled={amount <= 0}>− Nanite</Button>
          <Button variant="ghost" onclick={reset}>Reset to unharmed</Button>
        </div>
      </div>

      <!-- End roll resolution stays here — only renders when an end roll is pending. -->
      {#if requireRoll}
        <div class="rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300">
            End roll required — DN {dn}{forced ? ' · forced' : ''}
          </p>
          <p class="mb-2 text-xs text-neutral-300">
            Roll a clean d20. <strong>{dn}</strong> or under = pass (clear physical). Over = ended.
            {forced ? 'No suspend at 20. Spend a Gunta to convert to a Bulk action roll.' : ''}
          </p>
          <div class="flex flex-wrap gap-1">
            <Button variant="primary" onclick={pass}>End roll: passed</Button>
            <Button variant="secondary" onclick={fail}>End roll: failed</Button>
            {#if suspendOk}
              <Button variant="ghost" onclick={suspend}>Suspend</Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</Card>

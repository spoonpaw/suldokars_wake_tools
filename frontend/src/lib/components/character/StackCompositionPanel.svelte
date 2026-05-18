<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { recomputeStacks, type StackComposition, type SWCharacter } from '$lib/models';
  import { ALL_STACKS, STACK_DESCRIPTIONS, STACK_LABELS, type Stack } from '$lib/models/Enums';

  interface Props {
    character: SWCharacter;
    editable?: boolean;
    title?: string;
  }

  let { character = $bindable(), editable = false, title = 'Stacks & Combat' }: Props = $props();

  type ContributionSlot = 'base' | 'lifeFormBonus' | 'backgroundBonus' | 'implantBonus' | 'other';

  const CONTRIBUTIONS: { slot: ContributionSlot; label: string; signed: boolean }[] = [
    { slot: 'base', label: 'Base', signed: false },
    { slot: 'lifeFormBonus', label: 'Life-form', signed: true },
    { slot: 'backgroundBonus', label: 'Background', signed: true },
    { slot: 'implantBonus', label: 'Implant', signed: true },
    { slot: 'other', label: 'Other', signed: true }
  ];

  function compositionFor(stack: Stack): StackComposition {
    return (
      character.stackComposition?.[stack] ?? {
        base: 0,
        lifeFormBonus: 0,
        backgroundBonus: 0,
        implantBonus: 0,
        other: 0,
        final: character.stacks[stack]
      }
    );
  }

  function formatContribution(value: number, signed: boolean): string {
    if (!signed || value === 0) return String(value);
    return `${value > 0 ? '+' : ''}${value}`;
  }

  function setComposition(stack: Stack, slot: ContributionSlot, value: number) {
    const existing = compositionFor(stack);
    character.stackComposition = {
      ...character.stackComposition,
      [stack]: { ...existing, [slot]: value }
    } as SWCharacter['stackComposition'];
    character = recomputeStacks(character);
  }

  function handleNumberInput(event: Event, stack: Stack, slot: ContributionSlot) {
    const input = event.currentTarget as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    setComposition(stack, slot, Number.isFinite(value) ? value : 0);
  }
</script>

<Card {title}>
  <p class="mb-3 text-xs text-neutral-500">Base + Life-form + Background + Implant + Other = Final.</p>

  <div class="hidden overflow-x-auto md:block">
    <table class="w-full min-w-[680px] text-sm tabular-nums">
      <thead>
        <tr class="border-b border-neutral-800 text-xs uppercase text-neutral-500">
          <th class="py-2 pr-3 text-left font-medium">Stack</th>
          {#each CONTRIBUTIONS as contribution}
            <th class="px-1 py-2 text-center font-medium">{contribution.label}</th>
          {/each}
          <th class="py-2 pl-3 text-right font-medium">Final</th>
        </tr>
      </thead>
      <tbody>
        {#each ALL_STACKS as stack, idx (stack)}
          {@const isCombat = stack === 'close' || stack === 'ranged'}
          {@const prevIsCombat = idx > 0 && (ALL_STACKS[idx - 1] === 'close' || ALL_STACKS[idx - 1] === 'ranged')}
          {#if isCombat && !prevIsCombat}
            <tr>
              <td colspan="7" class="pt-3 pb-1 text-xs uppercase text-neutral-500">Combat</td>
            </tr>
          {/if}
          {@const comp = compositionFor(stack)}
          <tr class="border-t border-neutral-800/60 align-middle">
            <td class="py-2 pr-3 text-left">
              <div class="font-semibold text-neutral-100">{STACK_LABELS[stack]}</div>
              <div class="text-xs leading-tight text-neutral-500">{STACK_DESCRIPTIONS[stack]}</div>
            </td>
            {#each CONTRIBUTIONS as contribution}
              {@const value = comp[contribution.slot]}
              <td class="px-1 py-1 text-center">
                {#if editable}
                  <input
                    type="number"
                    {value}
                    aria-label={`${STACK_LABELS[stack]} ${contribution.label}`}
                    oninput={(event) => handleNumberInput(event, stack, contribution.slot)}
                    class="stack-number-input"
                  />
                {:else}
                  <span class={value === 0 ? 'text-neutral-600' : 'text-neutral-200'}>
                    {formatContribution(value, contribution.signed)}
                  </span>
                {/if}
              </td>
            {/each}
            <td class="py-2 pl-3 text-right text-lg font-bold text-cyan-300">{comp.final}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="space-y-1.5 md:hidden">
    {#each ALL_STACKS as stack, idx (stack)}
      {@const isCombat = stack === 'close' || stack === 'ranged'}
      {@const prevIsCombat = idx > 0 && (ALL_STACKS[idx - 1] === 'close' || ALL_STACKS[idx - 1] === 'ranged')}
      {#if isCombat && !prevIsCombat}
        <p class="pt-1 text-[11px] uppercase text-neutral-500">Combat</p>
      {/if}
      {@const comp = compositionFor(stack)}
      <section class="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h4 class="text-base font-semibold leading-tight text-neutral-100">{STACK_LABELS[stack]}</h4>
            <p class="mt-0.5 text-xs leading-tight text-neutral-500">{STACK_DESCRIPTIONS[stack]}</p>
          </div>
          <span class="shrink-0 text-2xl font-bold leading-none text-cyan-300 tabular-nums">{comp.final}</span>
        </div>

        {#if editable}
          <div class="mt-2 grid grid-cols-5 gap-1.5">
            {#each CONTRIBUTIONS as contribution}
              <label class="min-w-0">
                <span class="block text-[9px] leading-none text-neutral-400">{contribution.label}</span>
                <input
                  type="number"
                  value={comp[contribution.slot]}
                  aria-label={`${STACK_LABELS[stack]} ${contribution.label}`}
                  oninput={(event) => handleNumberInput(event, stack, contribution.slot)}
                  class="stack-number-input mt-1"
                />
              </label>
            {/each}
          </div>
        {:else}
          <div class="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] leading-tight tabular-nums">
            {#each CONTRIBUTIONS as contribution}
              {@const value = comp[contribution.slot]}
              {#if contribution.slot === 'base' || value !== 0}
                <span class={value === 0 ? 'text-neutral-600' : 'text-neutral-300'}>
                  {contribution.label}
                  {formatContribution(value, contribution.signed)}
                </span>
              {/if}
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</Card>

<style>
  .stack-number-input {
    width: 100%;
    min-width: 0;
    border-radius: 6px;
    border: 1px solid rgba(115, 115, 115, 0.65);
    background: rgba(38, 38, 38, 0.78);
    padding: 4px 2px;
    text-align: center;
    color: rgb(245, 245, 245);
    font-variant-numeric: tabular-nums;
    transition:
      border-color 0.12s ease,
      background 0.12s ease;
    appearance: textfield;
  }

  .stack-number-input:hover {
    background: rgba(64, 64, 64, 0.75);
  }

  .stack-number-input:focus {
    border-color: rgb(34, 211, 238);
    outline: none;
    box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35);
  }

  .stack-number-input::-webkit-outer-spin-button,
  .stack-number-input::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
</style>

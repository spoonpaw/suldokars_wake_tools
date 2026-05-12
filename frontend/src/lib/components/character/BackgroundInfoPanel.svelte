<!--
  BackgroundInfoPanel.svelte — full background entry.

  Renders the description, bonus summary, keyword list with stack-suggestion
  notation, full d20 tangentials table, and example archetypes. Used both
  on the character sheet Overview tab and on /reference/backgrounds.
-->
<script lang="ts">
  import type { Background } from '$lib/models/Enums';
  import { getBackground } from '$lib/data/backgrounds';
  import { Card, Badge } from '$lib/components/ui';

  interface Props {
    background: Background;
    expanded?: boolean;
  }

  let { background, expanded = $bindable(true) }: Props = $props();

  const def = $derived(getBackground(background));
</script>

<Card title={`Background — ${def.label}`}>
  <p class="text-xs uppercase tracking-wider text-cyan-400/80">{def.bonusSummary}</p>
  <p class="mt-2 text-sm text-neutral-300">{def.description}</p>

  {#if def.examples.length > 0}
    <div class="mt-2 flex flex-wrap items-center gap-1">
      <span class="text-xs text-neutral-500">Examples:</span>
      {#each def.examples as ex (ex)}
        <Badge variant="info">{ex}</Badge>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    onclick={() => (expanded = !expanded)}
    class="mt-3 text-xs text-cyan-400 hover:underline"
  >
    {expanded ? 'Hide keywords + tangentials ▴' : 'Show keywords + tangentials ▾'}
  </button>

  {#if expanded}
    <div class="mt-3 space-y-3 text-sm text-neutral-300">
      <!-- Keywords (six per background) — stack-suggestion in parens. -->
      <div>
        <h4 class="mb-1 font-semibold text-neutral-100">Keywords (pick 3)</h4>
        <ul class="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {#each def.keywords as k (k.name)}
            <li class="rounded bg-neutral-800/40 px-2 py-1">
              <span class="text-neutral-100">{k.name}</span>
              <span class="text-xs text-neutral-500"> ({k.stackHints.join(', ')})</span>
            </li>
          {/each}
        </ul>
        <p class="mt-1 text-xs text-neutral-500">
          Stack hints: A=Archive · B=Bulk · G=Ghost · M=Morph · S=Speed · T=Tech.
          You may place a keyword on a different stack if a plausible arrangement exists.
        </p>
      </div>

      <!-- Tangentials d20 table -->
      <div>
        <h4 class="mb-1 font-semibold text-neutral-100">Tangentials (d20)</h4>
        <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
          <table class="w-full text-xs">
            <thead class="text-left text-neutral-500">
              <tr><th class="pr-3 font-medium">Roll</th><th class="font-medium">Component</th></tr>
            </thead>
            <tbody>
              {#each def.tangentials as t (t.roll)}
                <tr>
                  <td class="pr-3 text-neutral-500">{t.roll}</td>
                  <td class="text-neutral-300">{t.entry}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="mt-1 text-xs text-neutral-500">
          Use during play (not at character creation) to seed a backstory beat — relationships, places, contracts, etc.
        </p>
      </div>
    </div>
  {/if}
</Card>

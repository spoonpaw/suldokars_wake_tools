<!--
  TypeInfoPanel.svelte — full type entry (Apt / Core / Prime).

  Mirrors the rules/18 body text using the data in `types.ts`. Renders
  description, origo, mechanical bullets, and (Core only) bond options.
  Designed to live on the character sheet's Overview tab and on the
  /reference/types page.
-->
<script lang="ts">
  import type { CharacterType } from '$lib/models/Enums';
  import { getType } from '$lib/data/types';
  import { Card, Badge } from '$lib/components/ui';

  interface Props {
    type: CharacterType;
    /** When true, render expanded with all rules + bonds. */
    expanded?: boolean;
  }

  let { type, expanded = $bindable(true) }: Props = $props();

  const def = $derived(getType(type));
</script>

<Card title={`Type — ${def.label}`}>
  <p class="text-xs uppercase tracking-wider text-cyan-400/80">{def.tagline}</p>
  <p class="mt-2 text-sm text-neutral-300">{def.description}</p>

  <div class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
    <div class="rounded-lg bg-neutral-800/40 p-2">
      <p class="text-neutral-400">Origo (rules/18)</p>
      <p class="text-neutral-100">
        Spaces {def.origo.spaces} · Implants {def.origo.implants} · Shadow {def.origo.shadow} · Gunta {def.origo.gunta}
      </p>
      <p class="text-neutral-300">
        Close {def.origo.closeStart}, Ranged {def.origo.rangedStart}
        {type === 'apt' ? ' (player picks which starts at 1)' : ''}
      </p>
    </div>
    <div class="rounded-lg bg-neutral-800/40 p-2">
      <p class="text-neutral-400">Spaces hold</p>
      <p class="text-neutral-100">{def.spaceContent}</p>
      <p class="mt-1 text-neutral-400">{def.spacesDoWhat}</p>
    </div>
  </div>

  <button
    type="button"
    onclick={() => (expanded = !expanded)}
    class="mt-3 text-xs text-cyan-400 hover:underline"
  >
    {expanded ? 'Hide rules ▴' : 'Show full rules ▾'}
  </button>

  {#if expanded}
    <div class="mt-3 space-y-3 text-sm text-neutral-300">
      <div>
        <h4 class="mb-1 font-semibold text-neutral-100">Rules</h4>
        <ul class="list-disc space-y-1 pl-5">
          {#each def.rules as r}
            <li>{r}</li>
          {/each}
        </ul>
      </div>

      {#if def.examples.length > 0}
        <div>
          <h4 class="mb-1 font-semibold text-neutral-100">Typical examples</h4>
          <div class="flex flex-wrap gap-1">
            {#each def.examples as ex (ex)}
              <Badge variant="info">{ex}</Badge>
            {/each}
          </div>
        </div>
      {/if}

      {#if def.bonds && def.bonds.length > 0}
        <div>
          <h4 class="mb-1 font-semibold text-neutral-100">Deep bonds (Core)</h4>
          <ul class="space-y-2">
            {#each def.bonds as b (b.id)}
              <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
                <p class="text-sm font-semibold text-neutral-100">{b.label}</p>
                <p class="text-xs text-neutral-400">{b.description}</p>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</Card>

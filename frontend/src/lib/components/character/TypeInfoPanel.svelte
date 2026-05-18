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
    /** For Core characters — currently chosen deep bond. The matching
     *  bond card is highlighted + auto-expanded so the player sees their
     *  active bond's mechanics first. */
    activeBond?: 'holoh' | 'nanite_cloud' | 'subspace_nanites' | undefined;
  }

  let { type, expanded = $bindable(true), activeBond = undefined }: Props = $props();

  const def = $derived(getType(type));
</script>

<Card title={`Type — ${def.label}`}>
  <p class="text-xs uppercase tracking-wider text-cyan-400/80">{def.tagline}</p>
  <p class="mt-2 text-sm text-neutral-300">{def.description}</p>

  <div class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
    <div class="rounded-lg bg-neutral-800/40 p-2">
      <p class="text-neutral-400">Origo</p>
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
          <p class="mb-2 text-[11px] italic text-neutral-500">Switch bond at any black-fill node on the type graph.</p>
          <ul class="space-y-2">
            {#each def.bonds as b (b.id)}
              {@const isActive = activeBond === b.id}
              <li class={`rounded-lg border p-2 ${isActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-neutral-800 bg-neutral-900/40'}`}>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-neutral-100">{b.label}</p>
                  {#if isActive}
                    <Badge variant="info">active</Badge>
                  {/if}
                </div>
                <p class="mt-1 text-xs text-neutral-300">{b.description}</p>
                {#if b.mechanics && b.mechanics.length > 0}
                  <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-400">
                    {#each b.mechanics as m}
                      <li>{m}</li>
                    {/each}
                  </ul>
                {/if}
                {#if b.subSection}
                  <div class="mt-2 rounded-md border border-neutral-800/80 bg-neutral-950/40 p-2">
                    <p class="text-xs font-semibold text-cyan-300">{b.subSection.title}</p>
                    {#if b.subSection.intro}
                      <p class="mt-1 text-[11px] text-neutral-400">{b.subSection.intro}</p>
                    {/if}
                    <ul class="mt-1 list-disc space-y-1 pl-5 text-[11px] text-neutral-300">
                      {#each b.subSection.bullets as sb}
                        <li>{sb}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</Card>

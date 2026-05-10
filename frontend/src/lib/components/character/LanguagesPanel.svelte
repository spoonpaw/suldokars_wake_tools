<!--
  LanguagesPanel.svelte — shared rendering for the Languages tab in both
  view and edit modes.

  Each known language gets:
    - Name
    - One-line description (italic, smaller)
    - Expertise badge ("Written expert", "Spoken expert", or both) — from
      the Languages keyword on Archive / Morph (rules/20)
    - Default "Speaking ability" tag for languages without keyword expertise

  Edit mode (`mode === 'edit'`): pill toggles below let the player add /
  remove languages from the dropdown. Each toggle shows the same enriched
  description so the player can pick informed.

  View mode (`mode === 'view'`): just the known list, no toggles.

  Expertise is derived from `character.keywords` — single source of truth.
-->
<script lang="ts">
  import type { SWCharacter } from '$lib/models';
  import type { Language } from '$lib/models/Enums';
  import {
    LANGUAGES_DATA,
    getLanguageDef,
    computeLanguageExpertise,
    type LanguageDef
  } from '$lib/data/languages';
  import { Badge, Card, NumberInput } from '$lib/components/ui';

  interface Props {
    character: SWCharacter;
    /** 'view' = read-only list. 'edit' = list + pill toggles + d3 input. */
    mode: 'view' | 'edit';
    /** Emit-only edit handler — parent owns the character state. */
    ontoggle?: (id: Language) => void;
    /** Edit mode only: bump the d3 third-language roll. */
    onthirdroll?: (n: number) => void;
  }

  let { character, mode, ontoggle, onthirdroll }: Props = $props();

  // Expertise derives from the keywords array — Languages on Archive grants
  // written expertise across every known language, Languages on Morph grants
  // spoken. Computed once per render; cheap.
  const expertise = $derived(computeLanguageExpertise(character.keywords));

  // Sort: known first (in pick order), then unknown for the picker. Edit
  // mode shows both groups; view mode shows only known.
  //
  // Legacy / unknown ids: instead of silently dropping them (a stale import
  // would just disappear from the sheet), synthesize a minimal LanguageDef
  // that uses the id as the display name. The player still sees the row
  // and can decide whether to leave it or remove it.
  const knownLangs = $derived<LanguageDef[]>(
    character.languages.map((id) => {
      const def = getLanguageDef(id);
      if (def) return def;
      return {
        id,
        name: id,
        family: 'Unknown',
        description: 'Unknown language id — kept from import. Edit to remove if intentional.',
        example: '—'
      };
    })
  );

  const unknownLangs = $derived<LanguageDef[]>(
    LANGUAGES_DATA.filter((l) => !character.languages.includes(l.id))
  );
</script>

<div class="space-y-3">
  <Card title={`Known languages (${knownLangs.length})`}>
    {#if knownLangs.length === 0}
      <p class="text-sm text-neutral-400">
        No languages picked. Pidgin should be present by default — see life-form
        rules in /18.
      </p>
    {:else}
      <ul class="space-y-2">
        {#each knownLangs as l (l.id)}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span class="font-semibold text-neutral-100">{l.name}</span>
                <span class="ml-2 text-xs text-neutral-500">{l.family}</span>
              </div>
              <div class="flex flex-wrap gap-1">
                {#if expertise.written}
                  <Badge variant="success">Written expert</Badge>
                {/if}
                {#if expertise.spoken}
                  <Badge variant="success">Spoken expert</Badge>
                {/if}
                {#if !expertise.written && !expertise.spoken}
                  <Badge variant="info">Speaking ability</Badge>
                {/if}
              </div>
            </div>
            <p class="mt-1 text-xs italic text-neutral-400">{l.description}</p>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Show the d3 third-language roll only if it's a real roll (1, 2, or 3).
         0 / undefined / null all mean "not rolled yet" — don't render a
         fake "rolled 0" line. -->
    {#if typeof character.thirdLanguageRoll === 'number' && character.thirdLanguageRoll >= 1 && character.thirdLanguageRoll <= 3}
      <p class="mt-3 text-xs text-neutral-500">
        Third-language d3 roll: <strong class="text-neutral-300">{character.thirdLanguageRoll}</strong>
        {#if character.thirdLanguageRoll === 3}
          <span class="text-emerald-300"> — granted</span>
        {/if}
      </p>
    {/if}

    {#if expertise.written || expertise.spoken}
      <p class="mt-2 text-xs text-neutral-500">
        Expertise comes from the <strong class="text-neutral-300">Languages</strong>
        keyword
        {#if expertise.written && expertise.spoken}
          on both Archive (written) and Morph (spoken)
        {:else if expertise.written}
          on Archive (written)
        {:else}
          on Morph (spoken)
        {/if}. Per rules/20 it covers every known language.
      </p>
    {/if}
  </Card>

  {#if mode === 'edit'}
    <Card title="Add / remove languages">
      <p class="mb-2 text-xs text-neutral-400">
        Tap a pill to toggle. Each pill shows the language's role so you can
        pick informed.
      </p>
      <div class="flex flex-wrap gap-2">
        {#each LANGUAGES_DATA as l (l.id)}
          {@const checked = character.languages.includes(l.id)}
          <button
            type="button"
            onclick={() => ontoggle?.(l.id)}
            title={l.description}
            aria-pressed={checked}
            class={`rounded-full border px-3 py-1 text-sm transition ${checked ? 'border-cyan-500/50 bg-cyan-900/30 text-cyan-200' : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'}`}
          >
            {l.name}
          </button>
        {/each}
      </div>

      <!-- Expanded picker rows below the pills — same description shown
           inline so the player doesn't need to hover the title attribute. -->
      {#if unknownLangs.length > 0}
        <details class="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
          <summary class="cursor-pointer text-sm text-neutral-300">
            Browse {unknownLangs.length} unknown language{unknownLangs.length === 1 ? '' : 's'} with descriptions
          </summary>
          <ul class="mt-2 space-y-1 text-xs">
            {#each unknownLangs as l (l.id)}
              <li class="rounded border border-neutral-800 bg-neutral-900/30 p-2">
                <span class="font-semibold text-neutral-200">{l.name}</span>
                <span class="ml-1 text-neutral-500">— {l.family}</span>
                <p class="mt-0.5 italic text-neutral-400">{l.description}</p>
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="d3 (third-language) roll"
          value={character.thirdLanguageRoll ?? 0}
          min={0}
          max={3}
          onchange={(v) => onthirdroll?.(v)}
        />
        <p class="self-end text-xs text-neutral-500">
          Enter 1-3. 0 = not rolled yet. Only a 3 grants the third language.
        </p>
      </div>
    </Card>
  {/if}
</div>

<!--
  LifeFormInfoPanel.svelte — full life-form entry.

  Shows the description, bonus summary, mandatory languages, mechanical
  notes, fiction notes, and (for aliens) the d12 res/vuln + feature tables.
  Used both on the character sheet Overview tab and on /reference/lifeforms.
-->
<script lang="ts">
  import type { LifeForm } from '$lib/models/Enums';
  import { getLifeForm, ALIEN_RES_VULN_TABLE, ALIEN_FEATURE_TABLE } from '$lib/data/lifeforms';
  import { Card, Badge } from '$lib/components/ui';

  interface Props {
    lifeForm: LifeForm;
    /** Default expanded? */
    expanded?: boolean;
    /** When the panel is shown for a specific character, optionally render
        the character's already-rolled alien resistance / vulnerability /
        feature so the player can see "what was rolled". */
    alienResistance?: string;
    alienVulnerability?: string;
    alienFeature?: string;
  }

  let {
    lifeForm,
    expanded = $bindable(true),
    alienResistance,
    alienVulnerability,
    alienFeature
  }: Props = $props();

  const def = $derived(getLifeForm(lifeForm));
</script>

<Card title={`Life-form — ${def.label}`}>
  <p class="text-xs uppercase tracking-wider text-cyan-400/80">{def.bonusSummary}</p>
  <p class="mt-2 text-sm text-neutral-300">{def.description}</p>

  {#if def.mandatoryLanguages && def.mandatoryLanguages.length > 0}
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      <span>Mandatory language(s):</span>
      {#each def.mandatoryLanguages as lang (lang)}
        <Badge variant="warning">{lang}</Badge>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    onclick={() => (expanded = !expanded)}
    class="mt-3 text-xs text-cyan-400 hover:underline"
  >
    {expanded ? 'Hide details ▴' : 'Show full details ▾'}
  </button>

  {#if expanded}
    <div class="mt-3 space-y-3 text-sm text-neutral-300">
      <div>
        <h4 class="mb-1 font-semibold text-neutral-100">Mechanics</h4>
        <ul class="list-disc space-y-1 pl-5">
          {#each def.notes as n}
            <li>{n}</li>
          {/each}
        </ul>
      </div>

      {#if def.fictionNotes && def.fictionNotes.length > 0}
        <div>
          <h4 class="mb-1 font-semibold text-neutral-100">Fiction & upkeep</h4>
          <ul class="list-disc space-y-1 pl-5 text-neutral-400">
            {#each def.fictionNotes as n}
              <li>{n}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if def.rollsAlienTables}
        <!-- Aliens roll d12 twice on this for resistance + vulnerability -->
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Resistance / Vulnerability (d12 twice)
            </h4>
            {#if alienResistance || alienVulnerability}
              <p class="mb-2 text-xs text-cyan-200">
                Rolled: <strong>{alienResistance ?? '?'}</strong> / <strong>{alienVulnerability ?? '?'}</strong>
              </p>
            {/if}
            <ul class="grid grid-cols-2 gap-x-2 text-xs text-neutral-300">
              {#each ALIEN_RES_VULN_TABLE as row (row.roll)}
                <li><span class="text-neutral-500">{row.roll}</span> {row.effect}</li>
              {/each}
            </ul>
          </div>
          <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Alien Feature (d12)
            </h4>
            {#if alienFeature}
              <p class="mb-2 text-xs text-cyan-200">Rolled: <strong>{alienFeature}</strong></p>
            {/if}
            <ul class="text-xs text-neutral-300">
              {#each ALIEN_FEATURE_TABLE as row (row.roll)}
                <li><span class="text-neutral-500">{row.roll}.</span> {row.feature}</li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}

      {#if def.id === 'tank_born'}
        <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
          <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Tank Born cap-stack appearance
          </h4>
          <ul class="text-xs text-neutral-300">
            <li><strong>Archive 8</strong> — oversized head.</li>
            <li><strong>Bulk 8</strong> — very tall and muscular.</li>
            <li><strong>Morph 8</strong> — huge eyes and long neck (Thaldean beauty).</li>
          </ul>
          <p class="mt-2 text-xs text-neutral-500">
            "Set and cap": no background or positive implant can change it. Some implants might lower the stat as a side-effect; nanite formulae may alter it temporarily.
          </p>
        </div>
      {/if}

      {#if def.id === 'droid'}
        <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
          <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Droid setpoints
          </h4>
          <p class="text-xs text-neutral-300">
            Tech <strong>set 8</strong>, Ghost <strong>set 3</strong>
            (overrides initial roll AND background bonuses).
          </p>
        </div>
      {/if}

      {#if def.id === 'holid'}
        <div class="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
          <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Holid setpoints
          </h4>
          <p class="text-xs text-neutral-300">
            Archive <strong>set 7</strong>, starting Ghost <strong>set 4</strong>
            (overrides initial roll AND background bonuses).
          </p>
        </div>
      {/if}
    </div>
  {/if}
</Card>

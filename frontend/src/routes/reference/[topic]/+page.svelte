<script lang="ts">
  import { page } from '$app/state';
  import { Input, Card } from '$lib/components/ui';
  import {
    BACKGROUNDS_DATA,
    LIFE_FORMS_DATA,
    WEAPONS_DATA,
    ARMOR_DATA,
    BASIC_FORMULAE,
    SUBSPACE_FORMULAE,
    GEAR_DATA,
    VEHICLES_DATA,
    PETS_DATA,
    IMPLANTS_DATA,
    LANGUAGES_DATA,
    TYPE_GRAPHS,
    TYPES_DATA
  } from '$lib/data';
  import TypeGraphView from '$lib/components/character/TypeGraphView.svelte';
  import TypeGraphLegend from '$lib/components/character/TypeGraphLegend.svelte';
  import TypeInfoPanel from '$lib/components/character/TypeInfoPanel.svelte';
  import LifeFormInfoPanel from '$lib/components/character/LifeFormInfoPanel.svelte';
  import BackgroundInfoPanel from '$lib/components/character/BackgroundInfoPanel.svelte';

  const topic = $derived(page.params.topic ?? 'backgrounds');
  let query = $state('');

  function matches(o: object): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return JSON.stringify(o).toLowerCase().includes(q);
  }
</script>

<svelte:head>
  <title>Reference: {topic} — Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-6">
  <a href="/reference" class="text-sm text-cyan-400 hover:underline">← Back to Reference</a>
  <h1 class="mt-2 text-2xl font-bold capitalize text-neutral-100">{topic.replace('-', ' ')}</h1>

  <div class="my-4 max-w-sm">
    <Input bind:value={query} placeholder="Filter…" />
  </div>

  {#if topic === 'types'}
    <div class="space-y-4">
      {#each TYPES_DATA.filter(matches) as t (t.id)}
        <TypeInfoPanel type={t.id} expanded={true} />
      {/each}
    </div>
  {:else if topic === 'backgrounds'}
    <div class="space-y-4">
      {#each BACKGROUNDS_DATA.filter(matches) as bg (bg.id)}
        <BackgroundInfoPanel background={bg.id} expanded={true} />
      {/each}
    </div>
  {:else if topic === 'lifeforms'}
    <div class="space-y-4">
      {#each LIFE_FORMS_DATA.filter(matches) as lf (lf.id)}
        <LifeFormInfoPanel lifeForm={lf.id} expanded={true} />
      {/each}
    </div>
  {:else if topic === 'weapons'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Dmg</th><th>Type</th><th>Slots</th><th>Range</th><th>Clip</th><th class="text-right">Cost</th>
        </tr>
      </thead>
      <tbody>
        {#each WEAPONS_DATA.filter(matches) as w (w.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2">{w.name}</td>
            <td>{w.damage}</td>
            <td>{w.damageType}</td>
            <td>{w.slots}</td>
            <td>{w.range}</td>
            <td>{w.clip ?? '—'}</td>
            <td class="text-right">{w.cost} P</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'armor'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Strength</th><th>Weakness</th><th>Slots</th><th class="text-right">Cost</th><th>Prime?</th>
        </tr>
      </thead>
      <tbody>
        {#each ARMOR_DATA.filter(matches) as a (a.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2">{a.name}</td>
            <td>{a.strength}</td>
            <td>{a.weakness}</td>
            <td>{a.slots}</td>
            <td class="text-right">{a.cost ? `${a.cost} P` : '—'}</td>
            <td>{a.primeOnly ? '§' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'formulae'}
    {#each BASIC_FORMULAE.filter(matches) as f (f.id)}
      <section class="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        <p class="font-semibold text-neutral-100">
          {f.name} <span class="text-cyan-300">{f.formulaCost} H</span>
          {#if f.alien}, Alien <span class="text-amber-300">{f.alien.name} {f.alien.cost}</span>{/if}
          {#if f.construct}, Construct <span class="text-purple-300">{f.construct.name} {f.construct.cost}</span>{/if}
        </p>
        <p class="text-sm text-neutral-300">{f.description}</p>
      </section>
    {/each}
  {:else if topic === 'subspace'}
    {#each SUBSPACE_FORMULAE.filter(matches) as f (f.id)}
      <section class="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        <p class="font-semibold text-neutral-100">
          {f.name} <span class="text-cyan-300">{f.bondedCost} H</span>
          {#if f.unbondedCost}<span class="text-neutral-500"> [unbonded {f.unbondedCost}]</span>{/if}
        </p>
        <p class="text-sm text-neutral-300">{f.description}</p>
      </section>
    {/each}
  {:else if topic === 'gear'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Slots</th><th class="text-right">Cost</th><th>Energy</th>
        </tr>
      </thead>
      <tbody>
        {#each GEAR_DATA.filter(matches) as g (g.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2">{g.name}</td>
            <td>{g.slots}</td>
            <td class="text-right">{g.cost} P</td>
            <td>{g.energy ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'vehicles'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Use</th><th class="text-right">Cost</th><th>e/d</th>
        </tr>
      </thead>
      <tbody>
        {#each VEHICLES_DATA.filter(matches) as v (v.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2">{v.name}</td>
            <td>{v.use}</td>
            <td class="text-right">{v.cost.toLocaleString()} P</td>
            <td>{v.energyPerDay || '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'pets'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Use</th><th class="text-right">Cost</th><th>P/W</th>
        </tr>
      </thead>
      <tbody>
        {#each PETS_DATA.filter(matches) as p (p.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2">{p.name}</td>
            <td>{p.use}</td>
            <td class="text-right">{p.cost} P</td>
            <td>{p.upkeepPerWeek || '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'implants'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Body part</th><th>Benefit</th><th class="text-right">Cost (×1)</th>
        </tr>
      </thead>
      <tbody>
        {#each IMPLANTS_DATA.filter(matches) as i (i.id)}
          <tr class="border-t border-neutral-800">
            <td class="py-1 pr-2 capitalize">{i.bodyPart}</td>
            <td>{i.benefit}</td>
            <td class="text-right">{i.baseCost} P</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="mt-3 text-xs text-neutral-500">
      Multipliers: blood/construct ×1, tank born ×1.5, alien ×2. Each +1 increment doubles total.
    </p>
  {:else if topic === 'languages'}
    <table class="w-full text-sm text-neutral-200">
      <thead class="text-left text-neutral-400">
        <tr>
          <th class="py-1 pr-2">Name</th><th>Family</th><th>Example names</th>
        </tr>
      </thead>
      <tbody>
        {#each LANGUAGES_DATA.filter(matches) as l (l.id)}
          <tr class="border-t border-neutral-800 align-top">
            <td class="py-1 pr-2 font-medium text-neutral-100">{l.name}</td>
            <td>{l.family}</td>
            <td class="text-neutral-400">{l.example}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if topic === 'type-graphs'}
    <!-- Visual type-graph reference: render the SVG figure for each type
         followed by the node table. -->
    <div class="space-y-6">
      <Card title="Advancement rule">
        <p class="text-sm text-neutral-300">
          Per <strong>rules/17 + rules/52</strong> (strict no-banking): each session during
          which you survive a shadow encounter of higher degree than your current Shadow
          grants <strong class="text-cyan-300">one</strong> orthogonal step on the type-graph,
          taken in that session. Use it or lose it — there is no carry-over.
          To reach a plotted node 2 grid units away you advance across
          <strong class="text-cyan-300">two</strong> separate sessions
          (no diagonals; orthogonal steps only).
        </p>
        <p class="mt-2 text-sm text-neutral-300">
          The advancement panel on each character sheet exposes the session log and a
          single "Take advancement step" button — use it once per qualifying session.
        </p>
      </Card>
      <TypeGraphLegend />
      {#each Object.values(TYPE_GRAPHS) as tg (tg.type)}
        <Card title={`${tg.type.toUpperCase()} graph`}>
          <p class="text-sm text-neutral-400">
            Origo (0,0): Spaces {tg.origo.spaces}, Implants {tg.origo.implants},
            C{tg.origo.closeStart} R{tg.origo.rangedStart}
          </p>

          <div class="mt-3 overflow-x-auto">
            <TypeGraphView type={tg.type} currentPosition={{ x: 0, y: 0 }} />
          </div>

          <details class="mt-3 text-sm">
            <summary class="cursor-pointer text-neutral-400 hover:text-cyan-300">Show node table</summary>
            <table class="mt-2 w-full text-sm text-neutral-200">
              <thead class="text-left text-neutral-400">
                <tr>
                  <th>Sh</th><th>Gu</th><th>Spaces</th><th>Kind</th><th>Mods</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {#each tg.nodes as n}
                  <tr class="border-t border-neutral-800">
                    <td>{n.x}</td>
                    <td>{n.y}</td>
                    <td>{n.spaces ?? '—'}</td>
                    <td>{n.kind}</td>
                    <td>
                      {#if n.closeFloor !== undefined}C{n.closeFloor}{' '}{/if}
                      {#if n.rangedFloor !== undefined}R{n.rangedFloor}{' '}{/if}
                      {#if n.implantsFloor !== undefined}I{n.implantsFloor}{/if}
                    </td>
                    <td class="text-neutral-400">{n.notes ?? ''}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </details>
        </Card>
      {/each}
    </div>
  {:else}
    <p class="text-neutral-400">Unknown topic.</p>
  {/if}
</main>

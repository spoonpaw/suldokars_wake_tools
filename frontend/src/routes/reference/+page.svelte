<script lang="ts">
  import { Card } from '$lib/components/ui';

  const TOPICS = [
    { slug: 'types', label: 'Types', blurb: 'Apt / Core / Prime: full body text + bonds.' },
    { slug: 'backgrounds', label: 'Backgrounds', blurb: '8 backgrounds with bonuses and keywords.' },
    { slug: 'lifeforms', label: 'Life-forms', blurb: 'Blood, Alien, Tank Born, Construct.' },
    { slug: 'weapons', label: 'Weapons', blurb: 'Blade, Kin-Gun, Shotgun, Plasma — full table.' },
    { slug: 'armor', label: 'Armor', blurb: 'Light to § heavy. Type rules included.' },
    { slug: 'formulae', label: 'Basic formulae', blurb: 'Formula / Alien innate / Construct built-in.' },
    { slug: 'subspace', label: 'Subspace formulae', blurb: 'Core subspace-bond formulae.' },
    { slug: 'gear', label: 'Adventuring gear', blurb: 'Backpacks, B&E tools, medifacts, slates.' },
    { slug: 'vehicles', label: 'Vehicles & drones', blurb: 'Crawlers, walkers, copters, bots.' },
    { slug: 'pets', label: 'Pets & mounts', blurb: 'Babel bug, zotusk, babbophant.' },
    { slug: 'implants', label: 'Implants', blurb: 'Head/body/limbs catalogue.' },
    { slug: 'languages', label: 'Languages', blurb: 'Pidgin, Vatori, Old Imperial, etc.' },
    { slug: 'type-graphs', label: 'Type graphs', blurb: 'Apt / Core / Prime advancement graphs.' }
  ];
</script>

<svelte:head>
  <title>Reference — Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-6">
  <h1 class="mb-1 text-2xl font-bold text-neutral-100">Reference</h1>
  <p class="mb-6 text-sm text-neutral-400">SW lookup tables, sourced from the Player's Guide.</p>

  <div class="grid gap-3 sm:grid-cols-2">
    {#each TOPICS as t (t.slug)}
      <a href={`/reference/${t.slug}`} class="block">
        <Card title={t.label}>
          <p class="text-sm text-neutral-400">{t.blurb}</p>
        </Card>
      </a>
    {/each}
  </div>
</main>

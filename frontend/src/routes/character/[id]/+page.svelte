<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import type { SWCharacter } from '$lib/models';
  import type { DetailTab } from '$lib/stores/ui.svelte';
  import { getDetailTab, setDetailTab } from '$lib/stores/ui.svelte';
  import { characterStore } from '$lib/stores';
  import { Badge, Button, Card } from '$lib/components/ui';
  import { summarize, encumbranceStatus, statusBadge } from '$lib/utils/computed';

  /** Map harm-status tone to Tailwind class string for the header badge. */
  function harmBadgeTone(status: SWCharacter['harm']['status']): { label: string; classes: string } {
    const b = statusBadge(status);
    const classes = {
      ok: 'bg-emerald-700 text-white',
      warn: 'bg-amber-700 text-white',
      danger: 'bg-orange-700 text-white',
      critical: 'bg-red-700 text-white'
    }[b.tone];
    return { label: b.label, classes };
  }
  import { exportToFile, downloadCharactersAsFile } from '$lib/utils/importExport';
  import { getBackground } from '$lib/data/backgrounds';
  import { getLifeForm } from '$lib/data/lifeforms';
  import { getActiveGraph } from '$lib/utils/graphLibrary';
  import TypeInfoPanel from '$lib/components/character/TypeInfoPanel.svelte';
  import LifeFormInfoPanel from '$lib/components/character/LifeFormInfoPanel.svelte';
  import BackgroundInfoPanel from '$lib/components/character/BackgroundInfoPanel.svelte';
  import AdvancementPanel from '$lib/components/character/AdvancementPanel.svelte';
  import LanguagesPanel from '$lib/components/character/LanguagesPanel.svelte';
  import HarmTrackerPanel from '$lib/components/character/HarmTrackerPanel.svelte';
  import EquipmentSection from '$lib/components/character/equipment/EquipmentSection.svelte';

  const id = $derived(page.params.id ?? '');
  const character = $derived<SWCharacter | undefined>(characterStore.getCharacter(id));

  // Per-character tab state, persisted in the UI store so view ⇄ edit
  // toggling stays on the same tab. The $derived getter re-reads on id
  // change (e.g. cross-character navigation).
  const tab = $derived<DetailTab>(getDetailTab(id));
  function selectTab(next: DetailTab) {
    setDetailTab(id, next);
    // Scroll to top so new tab content starts at the viewport top, not
    // wherever the previous tab left the scroll position.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'stacks', label: 'Stacks & Combat' },
    { id: 'advancement', label: 'Advancement' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'languages', label: 'Languages' },
    { id: 'space', label: 'Space' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'implants', label: 'Implants' },
    { id: 'identity', label: 'Identity' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'trackers', label: 'Trackers' }
  ];

  // ============================================
  // Info-panel collapse state — overview shows all three collapsed by default.
  // ============================================
  let typeExpanded = $state(false);
  let lfExpanded = $state(false);
  let bgExpanded = $state(false);

  async function handleExport() {
    if (!character) return;
    const ok = await exportToFile([character]);
    if (!ok) downloadCharactersAsFile([character]);
  }

  // View-mode AdvancementPanel is now read-only (passes `readOnly` prop).
  // The panel never emits onadvance / onupdate in that state, so we no
  // longer need a persistence queue here. All Advancement state mutation
  // happens in edit mode (CharacterEditForm wraps everything in a single
  // Save call) — see /character/[id]/edit/+page.svelte.
</script>

<svelte:head>
  <title>{character?.name || 'Character'} — Suldokar's Wake Tools</title>
</svelte:head>

{#if !character}
  <main class="mx-auto max-w-4xl px-4 py-10">
    <p class="text-neutral-300">Character not found.</p>
    <a href="/" class="mt-3 inline-block text-cyan-400 hover:underline">← All characters</a>
  </main>
{:else}
  {@const summary = summarize(character)}
  {@const lf = getLifeForm(character.lifeForm)}
  {@const bg = getBackground(character.background)}
  {@const enc = encumbranceStatus(character)}
  {@const tgPos = character.typeGraphPosition ?? { x: 0, y: 0 }}
  {@const graph = getActiveGraph(character)}
  {@const currentNode = (tgPos.x === 0 && tgPos.y === 0)
    ? null
    : graph.nodes.find((n) => n.x === tgPos.x && n.y === tgPos.y) ?? null}

  <main class="mx-auto max-w-4xl px-4 py-6">
    <!--
      Sticky stack: header card + tab rail card stay pinned to the top of the
      viewport when scrolling tab content. `top` aligns to the bottom of the
      global app navbar (which itself is `sticky top-0 z-40`); the layout
      exposes its measured height as the `--navbar-h` CSS variable. `z-30`
      sits below the navbar but above tab content. Background colors are
      the exact solid base of the body in each theme (#f8f9fa light /
      #0b0c0e dark from app.css) — that minimises the visible seam at the
      sticky edge. The body also has a `background-attachment: fixed`
      radial-gradient overlay that the sticky band can't continue, so a
      faint discontinuity is unavoidable; the `shadow-sm` underneath
      separates the band from scrolling content. `-mt-6` cancels main's
      `py-6` top so the band reaches the navbar; `-mx-4` bleeds past
      main's `px-4` so the band fills the column.
    -->
    <div
      class="sticky z-30 -mx-4 -mt-6 mb-5 px-4 pt-3 pb-1 shadow-sm"
      style="top: var(--navbar-h, 0px); background: var(--sticky-bg, #0b0c0e);"
    >
      <!--
        Page header in card chrome — matches the Card component's outer class string.
        Inner element is a <div>, not <header>, because app.css applies a global
        `html.light & header` override (white bg + dark border) that would otherwise
        paint a competing chrome inside this card.
      -->
      <!-- Compact header — single condensed band: back link + actions on
           top, name+class+title on row 2, stat chips on row 3, tabs on row 4.
           Vertical real estate kept tight so the actual sheet content has
           room to breathe. -->
      <div class="mb-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 shadow-sm shadow-black/20 space-y-1.5">
        <!-- Row 1: back + actions -->
        <div class="flex items-center justify-between gap-2">
          <a href="/" class="text-xs text-cyan-400 hover:underline">← Characters</a>
          <div class="flex gap-1.5">
            <Button variant="ghost" onclick={handleExport}>Export</Button>
            <Button onclick={() => goto(`/character/${character.id}/edit`)}>Edit</Button>
          </div>
        </div>

        <!-- Row 2: name + title + class -->
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <h1 class="text-xl font-bold text-neutral-100 leading-tight">{character.name || 'Unnamed'}</h1>
          {#if character.title}
            <span class="text-[10px] uppercase tracking-wider text-cyan-400/80">{character.title}</span>
          {/if}
          <span class="text-xs text-neutral-400">· {summary.classLine}</span>
        </div>

        <!-- Row 3: stat chips (status + harm + advancement state, all inline) -->
        <div class="flex flex-wrap items-center gap-1 text-[11px]">
          <span class={`rounded-full px-2 py-0.5 font-bold uppercase ${harmBadgeTone(character.harm.status).classes}`}>{harmBadgeTone(character.harm.status).label}</span>
          <span class="rounded-full bg-red-900/30 px-2 py-0.5 text-red-200">
            P harm <strong>{character.harm.harmTaken}</strong>/{character.harm.harmCap}
          </span>
          <span class="rounded-full bg-cyan-900/30 px-2 py-0.5 text-cyan-200">
            N harm <strong>{character.harm.naniteTaken}</strong>/{character.harm.naniteCap}
          </span>
          {#if character.harm.harmTaken > character.stacks.bulk}
            <span class="rounded-full bg-orange-900/40 px-2 py-0.5 text-orange-200">
              ⚠ End roll DN {Math.max(character.harm.harmTaken, character.harm.naniteTaken)}
            </span>
          {/if}
          <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
            Sh <strong class="text-neutral-100">{character.shadow}</strong> · G <strong class="text-neutral-100">{character.guntaValue}</strong>
          </span>
          <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
            Imp <strong class="text-neutral-100">{character.implants.length}/{character.origo.implants}</strong>
          </span>
          <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
            Node ({tgPos.x},{tgPos.y})
            {#if currentNode}
              · {currentNode.kind.replace('_', '+')}
            {:else if tgPos.x === 0 && tgPos.y === 0}
              · origo
            {:else}
              · transit
            {/if}
          </span>
        </div>

        <!-- Row 4: tabs (compact, no second card chrome) -->
        <div class="flex flex-wrap gap-1 pt-0.5">
          {#each TABS as t (t.id)}
            <button
              type="button"
              onclick={() => selectTab(t.id)}
              class={`rounded-full border px-2.5 py-0.5 text-xs transition ${tab === t.id ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500 hover:text-neutral-100'}`}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    {#if tab === 'overview'}
      <div class="space-y-3">
        <!-- Three info panels — collapsed by default, click to expand -->
        <TypeInfoPanel type={character.type} bind:expanded={typeExpanded} />
        <LifeFormInfoPanel
          lifeForm={character.lifeForm}
          bind:expanded={lfExpanded}
          alienResistance={character.alienResistance}
          alienVulnerability={character.alienVulnerability}
          alienFeature={character.alienFeature}
        />
        <BackgroundInfoPanel background={character.background} bind:expanded={bgExpanded} />

        <div class="grid gap-3 sm:grid-cols-2">
          <Card title="Origo">
            <ul class="text-sm text-neutral-300">
              <li>Spaces {character.origo.spaces}</li>
              <li>Implants {character.origo.implants}</li>
              <li>Shadow {character.origo.shadow}</li>
              <li>Gunta {character.origo.gunta}</li>
              <li>Close {character.origo.closeStart}, Ranged {character.origo.rangedStart}</li>
            </ul>
          </Card>
          <Card title="Background bonuses ({bg.label})">
            <p class="text-sm text-neutral-300">
              +{bg.closeBonus} Close · +{bg.rangedBonus} Ranged
            </p>
            <p class="mt-1 text-sm text-neutral-300">
              {#each Object.entries(bg.primaryBonuses) as [s, v]}
                +{v} <span class="capitalize">{s}</span>{' '}
              {/each}
            </p>
          </Card>
          <Card title="Life-form notes">
            <ul class="list-disc pl-5 text-sm text-neutral-300">
              {#each lf.notes.slice(0, 4) as n}<li>{n}</li>{/each}
            </ul>
          </Card>
          <Card title="At a glance">
            <p class="text-sm text-neutral-300">Slots: {summary.slotsUsed} / {summary.slotsCap} ({enc})</p>
            <p class="text-sm text-neutral-300">Total ammo: {summary.totalAmmo}</p>
            <p class="text-sm text-neutral-300">Cash equivalent: {summary.cashInParts} P</p>
          </Card>
        </div>
      </div>
    {:else if tab === 'stacks'}
      <!--
        Stack & combat breakdown — TABULAR layout per stack with right-aligned
        numeric columns. Zero-contribution columns render muted so the eye
        skips them. Combat stacks (Close/Ranged) are visually separated from
        the six primary stacks by a "Combat" divider row. On narrow screens
        the table collapses to a stacked-card layout (one card per stack
        with breakdown inline) — driven by Tailwind `md:` breakpoints.
      -->
      {@const stackRows = [
        { id: 'archive', label: 'Archive', combat: false },
        { id: 'bulk', label: 'Bulk', combat: false },
        { id: 'ghost', label: 'Ghost', combat: false },
        { id: 'morph', label: 'Morph', combat: false },
        { id: 'speed', label: 'Speed', combat: false },
        { id: 'tech', label: 'Tech', combat: false },
        { id: 'close', label: 'Close', combat: true },
        { id: 'ranged', label: 'Ranged', combat: true }
      ] as const}
      {@const fmtSigned = (n: number, mute = false) => {
        if (n === 0) return mute ? '·' : '0';
        return (n > 0 ? '+' : '') + n;
      }}
      <Card title="Stacks & Combat">
        <p class="mb-3 text-xs text-neutral-500">
          Each row sums Base + Life-form + Background + Implant + Other → Final.
          Zero contributions render as · to keep the column scannable.
        </p>

        <!-- DESKTOP: proper table, right-aligned numeric columns -->
        <div class="hidden md:block">
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr class="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                <th class="py-2 pr-4 text-left font-medium">Stack</th>
                <th class="py-2 px-2 text-center font-medium">Base</th>
                <th class="py-2 px-2 text-center font-medium">+LF</th>
                <th class="py-2 px-2 text-center font-medium">+BG</th>
                <th class="py-2 px-2 text-center font-medium">+Imp</th>
                <th class="py-2 px-2 text-center font-medium">+Other</th>
                <th class="py-2 pl-4 text-right font-medium">= Final</th>
              </tr>
            </thead>
            <tbody>
              {#each stackRows as s, idx (s.id)}
                {#if s.combat && (idx === 0 || !stackRows[idx - 1].combat)}
                  <tr>
                    <td colspan="7" class="pt-3 pb-1 text-xs uppercase tracking-wider text-neutral-500">
                      Combat
                    </td>
                  </tr>
                {/if}
                {@const comp = character.stackComposition?.[s.id] ?? {
                  base: 0,
                  lifeFormBonus: 0,
                  backgroundBonus: 0,
                  implantBonus: 0,
                  other: 0,
                  final: character.stacks[s.id]
                }}
                <tr class="border-t border-neutral-800/60">
                  <td class="py-2 pr-4 text-left font-semibold text-neutral-100">{s.label}</td>
                  <td class={`py-2 px-2 text-center ${comp.base === 0 ? 'text-neutral-600' : 'text-neutral-200'}`}>{comp.base === 0 ? '·' : comp.base}</td>
                  <td class={`py-2 px-2 text-center ${comp.lifeFormBonus === 0 ? 'text-neutral-600' : 'text-neutral-200'}`}>{fmtSigned(comp.lifeFormBonus, true)}</td>
                  <td class={`py-2 px-2 text-center ${comp.backgroundBonus === 0 ? 'text-neutral-600' : 'text-neutral-200'}`}>{fmtSigned(comp.backgroundBonus, true)}</td>
                  <td class={`py-2 px-2 text-center ${comp.implantBonus === 0 ? 'text-neutral-600' : 'text-neutral-200'}`}>{fmtSigned(comp.implantBonus, true)}</td>
                  <td class={`py-2 px-2 text-center ${comp.other === 0 ? 'text-neutral-600' : 'text-neutral-200'}`}>{fmtSigned(comp.other, true)}</td>
                  <td class="py-2 pl-4 text-right text-lg font-bold text-cyan-300">{comp.final}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- MOBILE: stacked cards, one per stack -->
        <div class="md:hidden space-y-2">
          {#each stackRows as s, idx (s.id)}
            {#if s.combat && (idx === 0 || !stackRows[idx - 1].combat)}
              <p class="pt-2 text-xs uppercase tracking-wider text-neutral-500">Combat</p>
            {/if}
            {@const comp = character.stackComposition?.[s.id] ?? {
              base: 0,
              lifeFormBonus: 0,
              backgroundBonus: 0,
              implantBonus: 0,
              other: 0,
              final: character.stacks[s.id]
            }}
            <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div class="flex items-baseline justify-between">
                <span class="font-semibold text-neutral-100">{s.label}</span>
                <span class="text-2xl font-bold text-cyan-300 tabular-nums">{comp.final}</span>
              </div>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                <span class={comp.base === 0 ? 'text-neutral-600' : 'text-neutral-300'}>Base {comp.base}</span>
                {#if comp.lifeFormBonus !== 0}<span class="text-neutral-300">LF {fmtSigned(comp.lifeFormBonus)}</span>{/if}
                {#if comp.backgroundBonus !== 0}<span class="text-neutral-300">BG {fmtSigned(comp.backgroundBonus)}</span>{/if}
                {#if comp.implantBonus !== 0}<span class="text-neutral-300">Imp {fmtSigned(comp.implantBonus)}</span>{/if}
                {#if comp.other !== 0}<span class="text-neutral-300">Other {fmtSigned(comp.other)}</span>{/if}
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {:else if tab === 'advancement'}
      <!--
        View-mode embeds the same panel but read-only. The panel hides bank
        +/-, Log Session, Move arrows, Advance, the next-step list, and
        Undo controls; the type-graph stays in 'view' mode (no clickable
        legal-next highlights). User has to switch to Edit to mutate state.
      -->
      <AdvancementPanel {character} readOnly />
    {:else if tab === 'keywords'}
      {#if character.keywords.length === 0}
        <p class="text-neutral-400">No keywords yet.</p>
      {:else}
        <ul class="space-y-2">
          {#each character.keywords as k (k.id)}
            <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div class="flex items-baseline justify-between">
                <span class="font-semibold text-neutral-100">{k.name}</span>
                <Badge variant="info">{k.stack}</Badge>
              </div>
              {#if k.notes}<p class="mt-1 text-sm text-neutral-400">{k.notes}</p>{/if}
              <p class="mt-1 text-xs text-neutral-500">Source: {k.source}{k.fromBackground ? ` · from ${k.fromBackground}` : ''}</p>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'languages'}
      <LanguagesPanel {character} mode="view" />
    {:else if tab === 'space'}
      {#if character.spaces.length === 0}
        <p class="text-neutral-400">No spaces filled.</p>
      {:else}
        <ul class="space-y-2">
          {#each character.spaces as s (s.id)}
            <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <p class="font-semibold text-neutral-100">{s.name} <span class="text-xs text-neutral-500">({s.kind}{s.active ? ', active' : ''})</span></p>
              <p class="text-sm text-neutral-300">{s.effect}</p>
              {#if s.notes}<p class="text-xs text-neutral-500">{s.notes}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if character.formulae.length > 0}
        <h3 class="mt-4 mb-2 font-semibold text-neutral-200">Formulae</h3>
        <ul class="space-y-2">
          {#each character.formulae as f (f.id)}
            <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <p>
                <span class="font-semibold text-neutral-100">{f.name}</span>
                <Badge variant="info">{f.category}</Badge>
                {#if f.active}<Badge variant="success">active</Badge>{/if}
              </p>
              <p class="text-xs text-neutral-500">Cost: {f.hCost} H</p>
              {#if f.notes}<p class="mt-1 text-sm text-neutral-300">{f.notes}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'equipment'}
      <EquipmentSection {character} mode="view" />
    {:else if tab === 'implants'}
      <p class="mb-3 text-sm text-neutral-300">
        Installed: <strong class="text-neutral-100">{character.implants.length}</strong> / max
        <strong class="text-neutral-100">{character.origo.implants}</strong>
        {#if character.implants.length > character.origo.implants}
          <span class="ml-2 text-amber-300">⚠ Over cap</span>
        {/if}
      </p>
      {#if character.implants.length === 0}
        <p class="text-neutral-400">No implants.</p>
      {:else}
        <ul class="space-y-2">
          {#each character.implants as i (i.id)}
            <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <p class="font-semibold text-neutral-100">{i.name} <span class="text-xs text-neutral-500">({i.bodyPart})</span></p>
              <p class="text-sm text-neutral-300">{i.effect}</p>
              {#if i.drawback}<p class="mt-1 text-sm text-red-300">Drawback: {i.drawback}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'identity'}
      {@const id_ = character.identity}
      <dl class="space-y-2 text-sm text-neutral-200">
        {#if id_.age}<div><dt class="text-neutral-500">Age</dt><dd>{id_.age}</dd></div>{/if}
        {#if id_.gender}<div><dt class="text-neutral-500">Gender</dt><dd>{id_.gender}</dd></div>{/if}
        {#if id_.appearance}<div><dt class="text-neutral-500">Appearance</dt><dd>{id_.appearance}</dd></div>{/if}
        {#if id_.speech}<div><dt class="text-neutral-500">Speech</dt><dd>{id_.speech}</dd></div>{/if}
        {#if id_.habits}<div><dt class="text-neutral-500">Habits</dt><dd class="whitespace-pre-line">{id_.habits}</dd></div>{/if}
        {#if id_.orientation}<div><dt class="text-neutral-500">Orientation</dt><dd>{id_.orientation}</dd></div>{/if}
        {#if id_.demeanor}<div><dt class="text-neutral-500">Demeanor</dt><dd>{id_.demeanor}</dd></div>{/if}
        {#if id_.notes}<div><dt class="text-neutral-500">Notes</dt><dd class="whitespace-pre-line">{id_.notes}</dd></div>{/if}
      </dl>
    {:else if tab === 'hooks'}
      {#if character.hooks.length === 0}
        <p class="text-neutral-400">No hooks.</p>
      {:else}
        <ul class="space-y-2">
          {#each character.hooks as h (h.id)}
            <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div class="flex items-baseline justify-between">
                <p class="font-semibold text-neutral-100">{h.title}</p>
                {#if h.open}<Badge variant="warning">open</Badge>{/if}
              </div>
              <p class="mt-1 text-sm text-neutral-300 whitespace-pre-line">{h.body}</p>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'trackers'}
      <div class="grid gap-3 sm:grid-cols-2">
        <Card title="Gunta">
          <p class="text-sm text-neutral-300">Beginner coins: <strong>{character.beginnerGuntaCoins}</strong> (one-shot)</p>
          <p class="text-sm text-neutral-300">Regular value: <strong>{character.guntaValue}</strong></p>
          {#if character.specialCoins.length > 0}
            <p class="mt-2 text-sm text-neutral-300">Special coins:</p>
            <ul class="text-sm text-neutral-300">
              {#each character.specialCoins as c (c.id)}
                <li>· {c.name} <span class="text-xs text-neutral-500">(refresh {c.refresh})</span></li>
              {/each}
            </ul>
          {/if}
        </Card>
        <Card title="Shadow & Reputation">
          <p class="text-sm text-neutral-300">Shadow: <strong>{character.shadow}</strong></p>
          <p class="text-sm text-neutral-300">Reputation: <strong>{character.reputation}</strong></p>
          <p class="text-sm text-neutral-300">Type-graph position: ({tgPos.x}, {tgPos.y})</p>
          <!--
            Session-log summary: count + last-session timestamp. Per
            rules/52 (strict no-banking), each session = at most one move.
            View-only here; recording sessions / advancing happens in the
            Advancement tab in edit mode.
          -->
          {@const sessions = character.sessionLog ?? []}
          {@const lastSession = sessions.length > 0
            ? [...sessions].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())[0]
            : null}
          <p class="mt-2 text-sm text-neutral-300">
            Sessions logged: <strong>{sessions.length}</strong>
            {#if lastSession}
              <span class="text-xs text-neutral-500"> · last: {new Date(lastSession.loggedAt).toLocaleDateString()}</span>
            {/if}
          </p>
          <p class="text-xs text-neutral-500">Log sessions / take advancement steps / roll back from the Advancement tab.</p>
        </Card>
        {#if character}
          <HarmTrackerPanel character={character} readOnly />
        {/if}
        <Card title="Money">
          <p class="text-sm text-neutral-300">Parts: <strong>{character.purse.parts}</strong> P</p>
          <p class="text-sm text-neutral-300">Energy: <strong>{character.purse.energy}</strong> e</p>
          <p class="text-sm text-neutral-300">E-credits: <strong>{character.purse.eCredits}</strong> E</p>
          {#if character.debts.length > 0}
            <p class="mt-2 text-sm text-red-300">Debts:</p>
            <ul class="text-sm text-red-300">
              {#each character.debts as d (d.id)}
                <li>· {d.amount} P → {d.holder}</li>
              {/each}
            </ul>
          {/if}
        </Card>
      </div>
    {/if}
  </main>
{/if}

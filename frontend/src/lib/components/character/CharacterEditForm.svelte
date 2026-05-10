<script lang="ts">
  import type { SWCharacter } from '$lib/models';
  import {
    type Stack,
    type Language,
    ALL_STACKS,
    STACK_LABELS,
    LIFE_FORMS,
    BACKGROUNDS,
    CHARACTER_TYPES
  } from '$lib/models/Enums';
  import { Input, Select, NumberInput, TextArea, Button, Card, Toggle } from '$lib/components/ui';
  import { recomputeStacks, type StackComposition } from '$lib/models';
  import type { EditTab } from './editTabs';
  import LanguagesPanel from './LanguagesPanel.svelte';
  import EquipmentSection from './equipment/EquipmentSection.svelte';

  interface Props {
    character: SWCharacter;
    /**
     * Which tab section to render. When omitted, renders the legacy
     * single-page layout (everything stacked). When set, renders only the
     * matching slice — the parent page handles its own tab navigation.
     */
    tab?: EditTab;
  }

  let { character = $bindable(), tab }: Props = $props();

  function newId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---- Stack composition editing ----
  // After any composition slot edit, recompute the cached `stacks` integers
  // so downstream computed.ts derivations (and the UI) see the new totals.
  function bumpComposition(stack: Stack, slot: keyof StackComposition, value: number) {
    const existing = character.stackComposition?.[stack] ?? {
      base: 0,
      lifeFormBonus: 0,
      backgroundBonus: 0,
      implantBonus: 0,
      other: 0,
      final: 0
    };
    const updated = { ...existing, [slot]: value };
    character.stackComposition = {
      ...character.stackComposition,
      [stack]: updated
    } as SWCharacter['stackComposition'];
    character = recomputeStacks(character);
  }

  // ---- Keywords ----
  function addKeyword() {
    character.keywords = [
      ...character.keywords,
      { id: newId(), name: '', stack: 'archive', notes: '', source: 'background' }
    ];
  }
  function removeKeyword(id: string) {
    character.keywords = character.keywords.filter((k) => k.id !== id);
  }

  // ---- Languages ----
  function toggleLanguage(l: Language) {
    if (character.languages.includes(l)) {
      character.languages = character.languages.filter((x) => x !== l);
    } else {
      character.languages = [...character.languages, l];
    }
  }

  // ---- Spaces ----
  function addSpace() {
    character.spaces = [
      ...character.spaces,
      { id: newId(), active: false, kind: 'equipment', name: '', effect: '' }
    ];
  }
  function removeSpace(id: string) {
    character.spaces = character.spaces.filter((s) => s.id !== id);
  }

  // ---- Implants ----
  // After add/remove, refresh implantBonus from the implants list so the
  // composition cache stays accurate (each implant may carry a stackBonus).
  function addImplant() {
    character.implants = [
      ...character.implants,
      // Seed `drawback: ''` so the bound TextArea (value = $bindable(''))
      // never sees undefined — Svelte 5 throws props_invalid_value otherwise.
      { id: newId(), name: '', bodyPart: 'head', effect: '', drawback: '' }
    ];
    character = recomputeStacks(character, true);
  }
  function removeImplant(id: string) {
    character.implants = character.implants.filter((i) => i.id !== id);
    character = recomputeStacks(character, true);
  }

  // ---- Equipment ----
  // Weapons / Armor / Inventory add+remove now lives inside
  // EquipmentSection (catalog picker + per-item editor cards). The arrays
  // themselves stay on the character model and are mutated in place via
  // `bind:character`.

  // ---- Hooks ----
  function addHook() {
    character.hooks = [
      ...character.hooks,
      { id: newId(), title: '', body: '', open: true }
    ];
  }
  function removeHook(id: string) {
    character.hooks = character.hooks.filter((h) => h.id !== id);
  }

  // ---- Special coins ----
  function addSpecialCoin() {
    character.specialCoins = [
      ...character.specialCoins,
      { id: newId(), name: '', effect: '', refresh: 'session', held: true }
    ];
  }
  function removeSpecialCoin(id: string) {
    character.specialCoins = character.specialCoins.filter((c) => c.id !== id);
  }

  // ---- Debts ----
  function addDebt() {
    character.debts = [...character.debts, { id: newId(), amount: 0, holder: '' }];
  }
  function removeDebt(id: string) {
    character.debts = character.debts.filter((d) => d.id !== id);
  }

  const TYPE_OPTS = CHARACTER_TYPES.map((t) => ({ value: t.id, label: `${t.label} — ${t.tagline}` }));
  const LIFE_OPTS = LIFE_FORMS.map((l) => ({ value: l.id, label: l.label }));
  const BG_OPTS = BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }));
  const STACK_OPTS = ALL_STACKS.map((s) => ({ value: s, label: STACK_LABELS[s] }));
  // Equipment-related option lists (DAMAGE / DAMAGE_TYPE / RANGE / LOCATION)
  // moved to the per-item editors under components/character/equipment/.
  const BODY_PART_OPTS = ['head', 'body', 'leg', 'arm', 'hand', 'eye', 'other'].map((b) => ({ value: b, label: b }));
  const SPACE_KIND_OPTS = ['equipment', 'master', 'place', 'pet', 'formula', 'bested_enemy', 'other'].map((k) => ({ value: k, label: k }));
  const REFRESH_OPTS = ['session', 'milestone', 'never', 'other'].map((r) => ({ value: r, label: r }));

  // Section visibility — when `tab` is set, only that tab's section shows.
  // Without a `tab` prop, the legacy "all sections" rendering is preserved
  // for callers that haven't migrated (e.g. the wizard Review step).
  function showSection(sectionTab: EditTab): boolean {
    return tab === undefined || tab === sectionTab;
  }

  // ---- Artistic Modification (read-only display) ----
  //
  // AM is wired in the wizard (rules/30 — language picks, keywords, implants,
  // shadow bumps, etc. all mutate the underlying records). Edit-mode keeps
  // the display read-only on purpose — too many side-effects to manage if
  // the player re-targets the AM here. To change AM after creation, edit
  // the linked record directly (e.g. the implant in the Implants tab, the
  // language list in Languages tab, etc.).
  const AM_KIND_LABEL: Record<string, string> = {
    language: 'Add a language',
    extra_keyword: 'Extra keyword',
    reputation: 'Reputation',
    gunta_plus: 'Gunta +1',
    special_coin: 'Special Gunta coin',
    shadow_plus: 'Shadow bump',
    expensive_equipment: 'Expensive equipment + debt',
    implant: 'Implant',
    off_list: 'Off-list'
  };

  /** Build a human-readable summary of what AM is currently linked to. */
  function amLinkedSummary(): { label: string; refId?: string }[] {
    const am = character.artisticMod;
    if (!am || !am.appliedRefs) return [];
    const r = am.appliedRefs;
    const out: { label: string; refId?: string }[] = [];
    if (r.languageId) out.push({ label: `Language: ${r.languageId}`, refId: r.languageId });
    if (r.keywordId) {
      const kw = character.keywords.find((k) => k.id === r.keywordId);
      out.push({
        label: kw ? `Keyword: ${kw.name} (${kw.stack})` : `Keyword (missing): ${r.keywordId}`,
        refId: r.keywordId
      });
    }
    if (r.specialCoinId) {
      const c = character.specialCoins.find((x) => x.id === r.specialCoinId);
      out.push({
        label: c ? `Special coin: ${c.name}` : `Special coin (missing): ${r.specialCoinId}`,
        refId: r.specialCoinId
      });
    }
    if (r.inventoryItemId) {
      const item = character.inventory.find((i) => i.id === r.inventoryItemId);
      out.push({
        label: item ? `Inventory: ${item.name} (${item.cost} P)` : `Inventory (missing): ${r.inventoryItemId}`,
        refId: r.inventoryItemId
      });
    }
    if (r.debtId) {
      const debt = character.debts.find((x) => x.id === r.debtId);
      out.push({
        label: debt ? `Debt: ${debt.amount} P to ${debt.holder}` : `Debt (missing): ${r.debtId}`,
        refId: r.debtId
      });
    }
    if (r.implantId) {
      const imp = character.implants.find((i) => i.id === r.implantId);
      out.push({
        label: imp
          ? `Implant: ${imp.name || '(unnamed)'} — ${imp.bodyPart}, effect: ${imp.effect}${imp.drawback ? `, drawback: ${imp.drawback}` : ''}`
          : `Implant (missing): ${r.implantId}`,
        refId: r.implantId
      });
    }
    if (r.reputationDelta !== undefined) {
      out.push({ label: `Reputation set (delta ${r.reputationDelta >= 0 ? '+' : ''}${r.reputationDelta}) → current ${character.reputation}` });
    }
    if (r.guntaDelta) {
      out.push({ label: `Gunta value bumped +${r.guntaDelta} → current ${character.guntaValue}` });
    }
    if (r.shadowDelta) {
      out.push({ label: `Shadow bumped +${r.shadowDelta} → current ${character.shadow}` });
    }
    return out;
  }
</script>

<div class="space-y-6">
  {#if showSection('overview')}
    <Card title="Identity">
      <div class="grid gap-3 sm:grid-cols-2">
        <Input label="Name" bind:value={character.name} required />
        <Input label="Title (sheet header)" bind:value={character.title} />
        <Select label="Type" options={TYPE_OPTS} bind:value={character.type} />
        <Select label="Life-form" options={LIFE_OPTS} bind:value={character.lifeForm} />
        <Select label="Background" options={BG_OPTS} bind:value={character.background} />
      </div>
    </Card>

    <Card title="Origo (rules/18 body)">
      <div class="grid gap-3 sm:grid-cols-3">
        <NumberInput label="Spaces" bind:value={character.origo.spaces} min={0} />
        <NumberInput label="Implants (cap)" bind:value={character.origo.implants} min={0} />
        <NumberInput label="Shadow" bind:value={character.origo.shadow} min={0} />
        <NumberInput label="Gunta" bind:value={character.origo.gunta} min={0} />
        <NumberInput label="Close start" bind:value={character.origo.closeStart} min={0} />
        <NumberInput label="Ranged start" bind:value={character.origo.rangedStart} min={0} />
      </div>
    </Card>
  {/if}

  {#if showSection('stacks')}
    <!--
      Stack composition editor — TABULAR layout. Each primary + combat stack
      is one row with five small NumberInput cells (base / life-form /
      background / implant / other) and a live-computed Final on the right.
      Editing any slot recomputes `character.stacks` so downstream summaries
      pick up the new totals. On narrow screens the table collapses to a
      stacked-card layout (one card per stack with the inputs in a grid).
    -->
    <Card title="Stack composition (rules/16, /18, /19)">
      <p class="mb-3 text-xs text-neutral-400">
        Each stack is the sum of base roll + life-form bonus + background bonus + implant bonus + other.
      </p>

      <!-- DESKTOP: tabular layout, right-aligned numeric NumberInputs.
           overflow-x-auto contains the table inside the card if NumberInput
           min-widths push the layout past the container at narrower widths.
           The `stacks-table` class scopes the spreadsheet-cell styling that
           strips the heavy pill chrome from the embedded NumberInputs so
           each cell reads like a flat grid cell, not an overlapping pill. -->
      <div class="hidden md:block overflow-x-auto stacks-table">
        <table class="w-full min-w-0 text-sm tabular-nums" style="table-layout: fixed;">
          <thead>
            <tr class="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
              <th class="py-2 pr-3 text-left font-medium">Stack</th>
              <th class="py-2 px-1 text-center font-medium">Base</th>
              <th class="py-2 px-1 text-center font-medium">+LF</th>
              <th class="py-2 px-1 text-center font-medium">+BG</th>
              <th class="py-2 px-1 text-center font-medium">+Imp</th>
              <th class="py-2 px-1 text-center font-medium">+Other</th>
              <th class="py-2 pl-3 text-right font-medium">= Final</th>
            </tr>
          </thead>
          <tbody>
            {#each ALL_STACKS as stack, idx (stack)}
              {@const isCombat = stack === 'close' || stack === 'ranged'}
              {@const prevIsCombat = idx > 0 && (ALL_STACKS[idx - 1] === 'close' || ALL_STACKS[idx - 1] === 'ranged')}
              {#if isCombat && !prevIsCombat}
                <tr>
                  <td colspan="7" class="pt-3 pb-1 text-xs uppercase tracking-wider text-neutral-500">
                    Combat
                  </td>
                </tr>
              {/if}
              {@const comp = character.stackComposition?.[stack] ?? {
                base: 0,
                lifeFormBonus: 0,
                backgroundBonus: 0,
                implantBonus: 0,
                other: 0,
                final: character.stacks[stack]
              }}
              <tr class="border-t border-neutral-800/60 align-middle">
                <td class="py-2 pr-3 text-left font-semibold text-neutral-100">{STACK_LABELS[stack]}</td>
                <td class="py-1 px-1 text-center">
                  <div class="mx-auto w-12">
                    <NumberInput value={comp.base} showControls={false} onchange={(v) => bumpComposition(stack, 'base', v)} />
                  </div>
                </td>
                <td class="py-1 px-1 text-center">
                  <div class="mx-auto w-12">
                    <NumberInput value={comp.lifeFormBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'lifeFormBonus', v)} />
                  </div>
                </td>
                <td class="py-1 px-1 text-center">
                  <div class="mx-auto w-12">
                    <NumberInput value={comp.backgroundBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'backgroundBonus', v)} />
                  </div>
                </td>
                <td class="py-1 px-1 text-center">
                  <div class="mx-auto w-12">
                    <NumberInput value={comp.implantBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'implantBonus', v)} />
                  </div>
                </td>
                <td class="py-1 px-1 text-center">
                  <div class="mx-auto w-12">
                    <NumberInput value={comp.other} showControls={false} onchange={(v) => bumpComposition(stack, 'other', v)} />
                  </div>
                </td>
                <td class="py-2 pl-3 text-right text-lg font-bold text-cyan-300">{comp.final}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- MOBILE: stacked cards, one per stack -->
      <div class="md:hidden space-y-3">
        {#each ALL_STACKS as stack (stack)}
          {@const comp = character.stackComposition?.[stack] ?? {
            base: 0,
            lifeFormBonus: 0,
            backgroundBonus: 0,
            implantBonus: 0,
            other: 0,
            final: character.stacks[stack]
          }}
          <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div class="flex items-baseline justify-between">
              <h4 class="font-semibold text-neutral-100">{STACK_LABELS[stack]}</h4>
              <span class="text-2xl font-bold text-cyan-300 tabular-nums">{comp.final}</span>
            </div>
            <div class="mt-2 grid grid-cols-5 gap-2">
              <NumberInput label="Base" value={comp.base} showControls={false} onchange={(v) => bumpComposition(stack, 'base', v)} />
              <NumberInput label="LF" value={comp.lifeFormBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'lifeFormBonus', v)} />
              <NumberInput label="BG" value={comp.backgroundBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'backgroundBonus', v)} />
              <NumberInput label="Imp" value={comp.implantBonus} showControls={false} onchange={(v) => bumpComposition(stack, 'implantBonus', v)} />
              <NumberInput label="Other" value={comp.other} showControls={false} onchange={(v) => bumpComposition(stack, 'other', v)} />
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

  {#if showSection('keywords')}
    <Card title="Keywords">
      {#each character.keywords as k (k.id)}
        <div class="mb-2 grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto] items-end">
          <Input bind:value={k.name} placeholder="Keyword (e.g. Stealth)" />
          <Select options={STACK_OPTS} bind:value={k.stack as string} />
          <Input bind:value={k.notes} placeholder="Notes" />
          <Button variant="ghost" onclick={() => removeKeyword(k.id)}>Remove</Button>
        </div>
      {/each}
      <Button variant="secondary" onclick={addKeyword}>Add keyword</Button>
    </Card>
  {/if}

  {#if showSection('languages')}
    <!--
      Edit-mode Languages section delegates to the shared LanguagesPanel —
      same enriched display (descriptions, expertise badges) as view mode,
      plus pill toggles for add/remove and a d3 roll input. Expertise is
      derived from the keywords array on the fly (Languages on Archive →
      written, on Morph → spoken) per rules/20.
    -->
    <LanguagesPanel
      {character}
      mode="edit"
      ontoggle={toggleLanguage}
      onthirdroll={(v) => (character.thirdLanguageRoll = v)}
    />
  {/if}

  {#if showSection('space')}
    <Card title="Spaces">
      {#each character.spaces as s (s.id)}
        <div class="mb-3 rounded-lg border border-neutral-800 p-3">
          <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
            <Input bind:value={s.name} placeholder="Name" />
            <Select options={SPACE_KIND_OPTS} bind:value={s.kind as string} />
            <Toggle label="Active" bind:checked={s.active} />
          </div>
          <div class="mt-2">
            <TextArea bind:value={s.effect} placeholder="Effect" rows={2} />
          </div>
          <div class="mt-2 flex justify-end">
            <Button variant="ghost" onclick={() => removeSpace(s.id)}>Remove</Button>
          </div>
        </div>
      {/each}
      <Button variant="secondary" onclick={addSpace}>Add space</Button>
    </Card>
  {/if}

  {#if showSection('implants')}
    <Card title="Implants">
      {#each character.implants as i (i.id)}
        <div class="mb-3 rounded-lg border border-neutral-800 p-3">
          <div class="grid gap-2 sm:grid-cols-[2fr_1fr] items-end">
            <Input bind:value={i.name} placeholder="Name" />
            <Select options={BODY_PART_OPTS} bind:value={i.bodyPart as string} />
          </div>
          <div class="mt-2 grid gap-2">
            <TextArea bind:value={i.effect} placeholder="Effect" rows={2} />
            <TextArea bind:value={i.drawback} placeholder="Drawback" rows={2} />
          </div>
          <div class="mt-2 flex justify-end">
            <Button variant="ghost" onclick={() => removeImplant(i.id)}>Remove</Button>
          </div>
        </div>
      {/each}
      <Button variant="secondary" onclick={addImplant}>Add implant</Button>
    </Card>
  {/if}

  {#if showSection('equipment')}
    <!--
      Equipment delegates entirely to the new EquipmentSection (weapons +
      armor + inventory + add modal). Mode "edit" surfaces the catalog
      picker and per-item editor cards. Mutations write directly into
      character.weapons / .armor / .inventory and are committed by the
      surrounding Save handler in the edit page.
    -->
    <EquipmentSection bind:character mode="edit" />
  {/if}

  {#if showSection('identity')}
    <Card title="Identity (fiction)">
      <div class="grid gap-3 sm:grid-cols-2">
        <Input label="Age" bind:value={character.identity.age} />
        <Input label="Gender" bind:value={character.identity.gender} />
        <Input label="Orientation" bind:value={character.identity.orientation} />
        <Input label="Demeanor" bind:value={character.identity.demeanor} />
      </div>
      <div class="mt-3 space-y-3">
        <TextArea label="Appearance" bind:value={character.identity.appearance} rows={3} />
        <TextArea label="Speech" bind:value={character.identity.speech} rows={2} />
        <TextArea label="Habits" bind:value={character.identity.habits} rows={3} />
        <TextArea label="Notes" bind:value={character.identity.notes} rows={2} />
      </div>
    </Card>

    {#if character.artisticMod && character.artisticMod.chosen}
      {@const am = character.artisticMod}
      {@const links = amLinkedSummary()}
      <Card title="Artistic Modification (rules/30) — read-only">
        <p class="mb-2 text-xs text-neutral-500">
          AM was wired during character creation. To change what's linked here,
          edit the underlying record directly (e.g. the Implant in the Implants
          tab, the language list in Languages, etc.).
        </p>
        <dl class="space-y-2 text-sm">
          <div class="flex gap-2">
            <dt class="font-semibold text-neutral-300">Kind:</dt>
            <dd class="text-neutral-100">{AM_KIND_LABEL[am.kind] ?? am.kind}</dd>
          </div>
          {#if am.description}
            <div class="flex gap-2">
              <dt class="font-semibold text-neutral-300">Description:</dt>
              <dd class="text-neutral-200">{am.description}</dd>
            </div>
          {/if}
          {#if am.drawback}
            <div class="flex gap-2">
              <dt class="font-semibold text-neutral-300">Drawback:</dt>
              <dd class="text-neutral-200">{am.drawback}</dd>
            </div>
          {/if}
          {#if links.length > 0}
            <div>
              <dt class="font-semibold text-neutral-300">Linked records:</dt>
              <dd>
                <ul class="ml-4 mt-1 list-disc text-neutral-200">
                  {#each links as l}
                    <li>
                      {l.label}
                      {#if l.refId}
                        <span class="text-xs text-neutral-500"> [linked: {l.refId.slice(0, 8)}]</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </dd>
            </div>
          {:else if !am.description && !am.drawback}
            <p class="text-xs text-neutral-500">
              Pre-existing AM without linked records (description-only legacy).
            </p>
          {/if}
        </dl>
      </Card>
    {/if}
  {/if}

  {#if showSection('hooks')}
    <Card title="Backstory hooks">
      {#each character.hooks as h (h.id)}
        <div class="mb-3 rounded-lg border border-neutral-800 p-3">
          <Input bind:value={h.title} placeholder="Hook title" />
          <div class="mt-2">
            <TextArea bind:value={h.body} rows={3} placeholder="Body" />
          </div>
          <div class="mt-2 flex items-center justify-between">
            <Toggle label="Open thread" bind:checked={h.open} />
            <Button variant="ghost" onclick={() => removeHook(h.id)}>Remove</Button>
          </div>
        </div>
      {/each}
      <Button variant="secondary" onclick={addHook}>Add hook</Button>
    </Card>
  {/if}

  {#if showSection('trackers')}
    <Card title="Trackers — Gunta & Shadow">
      <div class="grid gap-3 sm:grid-cols-2">
        <NumberInput label="Beginner Gunta coins" bind:value={character.beginnerGuntaCoins} min={0} />
        <NumberInput label="Regular Gunta value" bind:value={character.guntaValue} min={0} />
        <NumberInput label="Shadow" bind:value={character.shadow} min={0} />
        <NumberInput label="Reputation" bind:value={character.reputation} min={0} />
      </div>
      <h3 class="mt-4 mb-2 text-sm font-semibold text-neutral-200">Special coins</h3>
      {#each character.specialCoins as c (c.id)}
        <div class="mb-2 rounded-lg border border-neutral-800 p-2">
          <div class="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto] items-end">
            <Input bind:value={c.name} placeholder="Coin name" />
            <Input bind:value={c.effect} placeholder="Effect" />
            <Select options={REFRESH_OPTS} bind:value={c.refresh as string} />
            <Button variant="ghost" onclick={() => removeSpecialCoin(c.id)}>Remove</Button>
          </div>
        </div>
      {/each}
      <Button variant="secondary" onclick={addSpecialCoin}>Add special coin</Button>
    </Card>

    <Card title="Trackers — Harm & Money">
      <div class="grid gap-3 sm:grid-cols-2">
        <NumberInput label="Harm taken" bind:value={character.harm.harmTaken} min={0} />
        <NumberInput label="Harm cap" bind:value={character.harm.harmCap} min={1} />
        <NumberInput label="Nanite harm" bind:value={character.harm.naniteTaken} min={0} />
        <NumberInput label="Nanite cap" bind:value={character.harm.naniteCap} min={1} />
        <NumberInput label="Parts (P)" bind:value={character.purse.parts} min={0} />
        <NumberInput label="Energy (e)" bind:value={character.purse.energy} min={0} />
        <NumberInput label="E-credits (E)" bind:value={character.purse.eCredits} min={0} />
      </div>
      <h3 class="mt-4 mb-2 text-sm font-semibold text-neutral-200">Debts</h3>
      {#each character.debts as d (d.id)}
        <div class="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto] items-end">
          <NumberInput label="Amount (P)" value={d.amount} onchange={(v) => (d.amount = v)} />
          <Input bind:value={d.holder} placeholder="Holder" />
          <Input bind:value={d.notes} placeholder="Notes" />
          <Button variant="ghost" onclick={() => removeDebt(d.id)}>Remove</Button>
        </div>
      {/each}
      <Button variant="secondary" onclick={addDebt}>Add debt</Button>

      <div class="mt-4">
        <Card title="Notes">
          <TextArea bind:value={character.notes} rows={4} placeholder="Free-form notes" />
        </Card>
      </div>
    </Card>
  {/if}
</div>

<style>
  /* Stacks-table NumberInput cells: strip ALL chrome so the table reads
     like a clean spreadsheet — just numbers in cells. Hover/focus draw a
     subtle outline. The wrapper `div`s on each cell already cap width at
     w-12 (48 px); the input fills its parent and shows zero default chrome.
     `!important` overrides the NumberInput component's pill defaults. */
  :global(.stacks-table input[type='number']) {
    width: 100% !important;
    min-width: 0 !important;
    background: transparent !important;
    border: 1px solid transparent !important;
    border-radius: 4px !important;
    padding: 2px 0 !important;
    margin: 0 !important;
    text-align: center !important;
    font-variant-numeric: tabular-nums;
    box-shadow: none !important;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  :global(.stacks-table input[type='number']:hover) {
    background: rgba(148, 163, 184, 0.10) !important;
    border-color: rgba(148, 163, 184, 0.25) !important;
  }
  :global(.stacks-table input[type='number']:focus) {
    background: rgba(34, 211, 238, 0.10) !important;
    border-color: rgb(34, 211, 238) !important;
    outline: none !important;
  }
  /* The NumberInput wraps the input in a flex row that has its own padding
     and gap. Strip those when inside the stacks-table so the cell collapses. */
  :global(.stacks-table .relative),
  :global(.stacks-table label) {
    padding: 0 !important;
    margin: 0 !important;
    gap: 0 !important;
  }
  :global(.stacks-table td) {
    padding-left: 4px !important;
    padding-right: 4px !important;
  }
</style>


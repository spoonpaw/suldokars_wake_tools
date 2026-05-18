<script lang="ts">
  import { recomputeStacks, type SWCharacter } from '$lib/models';
  import { type Language, ALL_STACKS, STACK_LABELS, LIFE_FORMS, BACKGROUNDS, CHARACTER_TYPES } from '$lib/models/Enums';
  import { Input, Select, NumberInput, TextArea, Button, Card, Toggle } from '$lib/components/ui';
  import { carriedMoneySlots, formatPartsEquivalent, onHandCashInParts, stashedCashInParts } from '$lib/utils/computed';
  import HarmTrackerPanel from './HarmTrackerPanel.svelte';
  import type { EditTab } from './editTabs';
  import LanguagesPanel from './LanguagesPanel.svelte';
  import EquipmentSection from './equipment/EquipmentSection.svelte';
  import StackCompositionPanel from './StackCompositionPanel.svelte';
  import {
    BASIC_FORMULAE,
    SUBSPACE_FORMULAE,
    LIFE_FORMS_DATA,
    ALIEN_RES_VUL_PICKS,
    ALIEN_FEATURE_PICKS,
    DROID_USE_TABLE,
    DROID_OPTIMIZATION_TABLE,
    DROID_HISTORY_TABLE,
    HOLID_PURPOSE_TABLE,
    HOLID_TRANSFORM_TABLE,
    tankBornAppearance,
    rollFrom
  } from '$lib/data';
  import {
    addBasicFormula,
    addSubspaceFormula,
    addCustomFormula,
    removeFormula as removeFormulaUtil,
    setActiveFormula
  } from '$lib/utils/formulae';
  import { animateRoll } from '$lib/utils/rollAnimation';

  // Inline form state for adding a homebrew / GM-given custom formula.
  let customFormulaOpen = $state(false);
  let customName = $state('');
  let customHCost = $state('1');
  let customCategory = $state<'basic' | 'subspace'>('basic');
  let customDescription = $state('');
  function resetCustomForm() {
    customName = '';
    customHCost = '1';
    customCategory = 'basic';
    customDescription = '';
    customFormulaOpen = false;
  }
  function commitCustomFormula() {
    if (!customName.trim()) return;
    character = addCustomFormula(character, {
      name: customName.trim(),
      hCost: customHCost.trim() || '1',
      category: customCategory,
      description: customDescription.trim()
    });
    resetCustomForm();
  }

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

  // ---- Keywords ----
  function addKeyword() {
    character.keywords = [...character.keywords, { id: newId(), name: '', stack: 'archive', notes: '', source: 'background' }];
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
    // Seed kind from character type so the new slot starts as the
    // type-appropriate kind (Apt=equipment, Core=formula, Prime=bested_enemy).
    const seedKind = character.type === 'apt'
      ? 'equipment'
      : character.type === 'core'
        ? 'formula'
        : 'bested_enemy';
    character.spaces = [...character.spaces, { id: newId(), active: false, kind: seedKind, name: '', effect: '' }];
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
    character.hooks = [...character.hooks, { id: newId(), title: '', body: '', open: true }];
  }
  function removeHook(id: string) {
    character.hooks = character.hooks.filter((h) => h.id !== id);
  }

  // ---- Special coins ----
  function addSpecialCoin() {
    character.specialCoins = [...character.specialCoins, { id: newId(), name: '', effect: '', refresh: 'session', held: true }];
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
  /** Space kinds gated by character type per rules/18:
   *    Apt   → equipment / master / place / pet
   *    Core  → formula
   *    Prime → bested_enemy
   *  No 'other' — all legitimate space content fits one of the above. */
  const SPACE_KIND_OPTS = $derived(
    (character.type === 'apt'
      ? ['equipment', 'master', 'place', 'pet']
      : character.type === 'core'
        ? ['formula']
        : ['bested_enemy']
    ).map((k) => ({ value: k, label: k }))
  );
  const REFRESH_OPTS = ['session', 'milestone', 'never', 'other'].map((r) => ({ value: r, label: r }));
  const moneySlotsUsed = $derived(carriedMoneySlots(character.purse));
  const onHandCash = $derived(onHandCashInParts(character));
  const stashedCash = $derived(stashedCashInParts(character));

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
      out.push({
        label: `Reputation set (delta ${r.reputationDelta >= 0 ? '+' : ''}${r.reputationDelta}) → current ${character.reputation}`
      });
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

      {#if character.type === 'core'}
        <div class="mt-4 space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-cyan-300">Core deep bond</p>
          <Select
            label="Bond"
            options={[
              { value: '', label: '— pick a bond —' },
              { value: 'holoh', label: 'The HoloH' },
              { value: 'nanite_cloud', label: 'A Nanite Cloud' },
              { value: 'subspace_nanites', label: 'Subspace Nanites' }
            ]}
            value={character.coreBond ?? ''}
            onchange={(v) => (character.coreBond = v === '' ? undefined : v as 'holoh' | 'nanite_cloud' | 'subspace_nanites')}
          />
          <TextArea
            label="Bond notes (Major Cloud details, HoloH-listening rare classification, etc.)"
            bind:value={character.coreBondNotes}
            rows={2}
          />
          <p class="text-[11px] italic text-neutral-500">Switch bond at black-fill nodes on the type graph (rules/18). Switching FROM Nanite Cloud loses the Beginner Cloud unless you re-bond it later.</p>
        </div>
      {/if}
    </Card>

    {#if character.lifeForm === 'palp_alien' || character.lifeForm === 'amphibious_alien' || character.lifeForm === 'tank_born' || character.lifeForm === 'droid' || character.lifeForm === 'holid'}
      {@const lfDef = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm)}
      {@const isAlien = character.lifeForm === 'palp_alien' || character.lifeForm === 'amphibious_alien'}
      {@const isTankBorn = character.lifeForm === 'tank_born'}
      {@const isConstruct = lfDef?.group === 'construct'}
      {@const isDroid = character.lifeForm === 'droid'}
      <Card title="Life-form details">
        <p class="mb-3 text-xs text-neutral-500">Sub-system fields tied to your life-form (rules/18).</p>

        <!-- Alien block -->
        {#if isAlien}
          {@const alienInnateOpts = BASIC_FORMULAE.filter((f) => f.alien).map((f) => ({
            value: f.name,
            label: `${f.name} → ${f.alien!.name} (${f.alien!.cost} H)`
          }))}
          {#if character.lifeForm === 'amphibious_alien'}
            <p class="mb-2 text-xs text-amber-200">⚠ <strong>Amphibious:</strong> needs underwater ≥30 min/day or becomes lethargic (clean rolls only) → d3-day coma.</p>
          {/if}
          {#if character.lifeForm === 'palp_alien'}
            <p class="mb-2 text-xs text-amber-200">⚠ <strong>Palp:</strong> hair = thin palps (visible up close). Always knows Palp.</p>
          {/if}
          <div class="grid gap-2 sm:grid-cols-2">
            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Resistance (d12)</p>
              <div class="flex gap-1">
                <Select
                  options={[{ value: '', label: '— pick —' }, ...ALIEN_RES_VUL_PICKS.map((v) => ({ value: v, label: v }))]}
                  value={character.alienResistance ?? ''}
                  onchange={(v) => (character.alienResistance = v || undefined)}
                />
                <Button variant="ghost" onclick={() => animateRoll(ALIEN_RES_VUL_PICKS, rollFrom(ALIEN_RES_VUL_PICKS), (v) => (character.alienResistance = v))}>Roll</Button>
              </div>
            </div>
            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Vulnerability (d12)</p>
              <div class="flex gap-1">
                <Select
                  options={[{ value: '', label: '— pick —' }, ...ALIEN_RES_VUL_PICKS.map((v) => ({ value: v, label: v }))]}
                  value={character.alienVulnerability ?? ''}
                  onchange={(v) => (character.alienVulnerability = v || undefined)}
                />
                <Button variant="ghost" onclick={() => animateRoll(ALIEN_RES_VUL_PICKS, rollFrom(ALIEN_RES_VUL_PICKS), (v) => (character.alienVulnerability = v))}>Roll</Button>
              </div>
            </div>
            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Alien feature (d12)</p>
              <div class="flex gap-1">
                <Select
                  options={[{ value: '', label: '— pick —' }, ...ALIEN_FEATURE_PICKS.map((v) => ({ value: v, label: v }))]}
                  value={character.alienFeature ?? ''}
                  onchange={(v) => (character.alienFeature = v || undefined)}
                />
                <Button variant="ghost" onclick={() => animateRoll(ALIEN_FEATURE_PICKS, rollFrom(ALIEN_FEATURE_PICKS), (v) => (character.alienFeature = v))}>Roll</Button>
              </div>
            </div>
            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Innate formula (1 H cheaper)</p>
              <Select
                options={[{ value: '', label: '— pick —' }, ...alienInnateOpts]}
                value={character.alienInnateFormula ?? ''}
                onchange={(v) => (character.alienInnateFormula = v || undefined)}
              />
            </div>
          </div>
          <p class="mt-2 text-[10px] italic text-neutral-500">Aliens have trouble finding implants that fit + are shunned in blood high society (except the Jaded Diva archetype).</p>
        {/if}

        <!-- Tank Born block -->
        {#if isTankBorn}
          {@const cappedAppearance = tankBornAppearance(character.tankCappedStack)}
          <p class="mb-1 text-xs text-neutral-300">Capped stack: <strong class="text-amber-200">{character.tankCappedStack ?? '— not set —'}</strong> (assign in wizard / Bonus distribution step).</p>
          {#if cappedAppearance}
            <p class="text-xs italic text-amber-300">Corresponding appearance: <strong>{cappedAppearance}</strong>.</p>
          {/if}
          <p class="mt-2 text-[10px] italic text-neutral-500">Tank Born age but rejuvenate in bio-growth tanks. Memory affected asymmetrically — recent intact, distant past patchy.</p>
        {/if}

        <!-- Construct block -->
        {#if isConstruct}
          {@const constructFormulaOpts = BASIC_FORMULAE.filter((f) => f.construct).map((f) => ({
            value: f.name,
            label: `${f.name} → ${f.construct!.name} (${f.construct!.cost} H)`
          }))}
          {@const builtIns = character.constructBuiltIns ?? []}
          <ul class="mb-2 list-disc space-y-0.5 pl-5 text-[11px] text-neutral-300">
            <li>Immune to suffocation, poison, and disease.</li>
            <li>Vulnerable to <strong>energy weapons</strong>.</li>
            <li>Must pass a <strong>Ghost roll</strong> before deliberately hurting bloods.</li>
            {#if isDroid}
              <li><strong>Droid:</strong> 2 e + 2 hours maintenance/day. Double rolls vs harm.</li>
            {:else}
              <li><strong>Holid:</strong> needs holofield + 2 hours/day recompile. Resistant to regular physical damage.</li>
            {/if}
          </ul>

          <div class="space-y-3">
            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Construct formula adaptation</p>
              <Select
                options={[{ value: '', label: '— pick —' }, ...constructFormulaOpts]}
                value={character.constructFormula ?? ''}
                onchange={(v) => (character.constructFormula = v || undefined)}
              />
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-xs font-medium text-neutral-300">Built-in tools (up to 3, total ≤ 50 P)</p>
                {#if builtIns.length < 3}
                  <Button variant="ghost" onclick={() => (character.constructBuiltIns = [...(character.constructBuiltIns ?? []), ''])}>+ Add</Button>
                {/if}
              </div>
              {#if builtIns.length === 0}
                <p class="text-[11px] italic text-neutral-500">None added.</p>
              {:else}
                <ul class="space-y-1">
                  {#each builtIns as bi, i (i)}
                    <li class="flex items-center gap-2">
                      <Input
                        value={bi}
                        placeholder={`Tool ${i + 1}`}
                        onchange={(v: string) => {
                          const next = [...(character.constructBuiltIns ?? [])];
                          next[i] = v;
                          character.constructBuiltIns = next;
                        }}
                      />
                      <button
                        type="button"
                        class="text-red-400 hover:text-red-300 text-lg leading-none"
                        onclick={() => (character.constructBuiltIns = (character.constructBuiltIns ?? []).filter((_, j) => j !== i))}
                        aria-label="Remove"
                      >×</button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              {#if isDroid}
                <div>
                  <p class="mb-1 text-xs font-medium text-neutral-300">Original use</p>
                  <div class="flex gap-1">
                    <Select
                      options={[{ value: '', label: '— pick —' }, ...DROID_USE_TABLE.map((v) => ({ value: v, label: v }))]}
                      value={character.droidInspiration?.use ?? ''}
                      onchange={(v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), use: v || undefined })}
                    />
                    <Button variant="ghost" onclick={() => animateRoll(DROID_USE_TABLE, rollFrom(DROID_USE_TABLE), (v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), use: v }))}>Roll</Button>
                  </div>
                </div>
                <div>
                  <p class="mb-1 text-xs font-medium text-neutral-300">Optimization</p>
                  <div class="flex gap-1">
                    <Select
                      options={[{ value: '', label: '— pick —' }, ...DROID_OPTIMIZATION_TABLE.map((v) => ({ value: v, label: v }))]}
                      value={character.droidInspiration?.optimization ?? ''}
                      onchange={(v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), optimization: v || undefined })}
                    />
                    <Button variant="ghost" onclick={() => animateRoll(DROID_OPTIMIZATION_TABLE, rollFrom(DROID_OPTIMIZATION_TABLE), (v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), optimization: v }))}>Roll</Button>
                  </div>
                </div>
                <div class="sm:col-span-2">
                  <p class="mb-1 text-xs font-medium text-neutral-300">Since creation</p>
                  <div class="flex gap-1">
                    <Select
                      options={[{ value: '', label: '— pick —' }, ...DROID_HISTORY_TABLE.map((v) => ({ value: v, label: v }))]}
                      value={character.droidInspiration?.history ?? ''}
                      onchange={(v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), history: v || undefined })}
                    />
                    <Button variant="ghost" onclick={() => animateRoll(DROID_HISTORY_TABLE, rollFrom(DROID_HISTORY_TABLE), (v) => (character.droidInspiration = { ...(character.droidInspiration ?? {}), history: v }))}>Roll</Button>
                  </div>
                </div>
              {:else}
                <div>
                  <p class="mb-1 text-xs font-medium text-neutral-300">Original purpose</p>
                  <div class="flex gap-1">
                    <Select
                      options={[{ value: '', label: '— pick —' }, ...HOLID_PURPOSE_TABLE.map((v) => ({ value: v, label: v }))]}
                      value={character.holidInspiration?.purpose ?? ''}
                      onchange={(v) => (character.holidInspiration = { ...(character.holidInspiration ?? {}), purpose: v || undefined })}
                    />
                    <Button variant="ghost" onclick={() => animateRoll(HOLID_PURPOSE_TABLE, rollFrom(HOLID_PURPOSE_TABLE), (v) => (character.holidInspiration = { ...(character.holidInspiration ?? {}), purpose: v }))}>Roll</Button>
                  </div>
                </div>
                <div>
                  <p class="mb-1 text-xs font-medium text-neutral-300">Transformation effect</p>
                  <div class="flex gap-1">
                    <Select
                      options={[{ value: '', label: '— pick —' }, ...HOLID_TRANSFORM_TABLE.map((v) => ({ value: v, label: v }))]}
                      value={character.holidInspiration?.transform ?? ''}
                      onchange={(v) => (character.holidInspiration = { ...(character.holidInspiration ?? {}), transform: v || undefined })}
                    />
                    <Button variant="ghost" onclick={() => animateRoll(HOLID_TRANSFORM_TABLE, rollFrom(HOLID_TRANSFORM_TABLE), (v) => (character.holidInspiration = { ...(character.holidInspiration ?? {}), transform: v }))}>Roll</Button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </Card>
    {/if}

    <Card title="Origo">
      <p class="mb-3 text-xs text-neutral-500">
        Type-derived starting values. Normally driven by your type + advancement nodes — overrides are for GM tweaks.
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <NumberInput label="Spaces" bind:value={character.origo.spaces} min={0} showControls={false} />
        <NumberInput label="Implants (cap)" bind:value={character.origo.implants} min={0} showControls={false} />
        <NumberInput label="Shadow" bind:value={character.origo.shadow} min={0} showControls={false} />
        <NumberInput label="Gunta" bind:value={character.origo.gunta} min={0} showControls={false} />
        <NumberInput label="Close start" bind:value={character.origo.closeStart} min={0} showControls={false} />
        <NumberInput label="Ranged start" bind:value={character.origo.rangedStart} min={0} showControls={false} />
      </div>
    </Card>
  {/if}

  {#if showSection('stacks')}
    <StackCompositionPanel bind:character editable title="Stack composition" />
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
    <LanguagesPanel {character} mode="edit" ontoggle={toggleLanguage} onthirdroll={(v) => (character.thirdLanguageRoll = v)} />
  {/if}

  {#if showSection('space')}
    {#if character.type === 'core'}
      {@const subspaceUnlocked = character.coreBond === 'subspace_nanites'}
      {@const pickedFormulae = character.formulae}
      {@const unpickedBasic = BASIC_FORMULAE.filter((f) => !pickedFormulae.some((p) => p.name === f.name))}
      {@const unpickedSubspace = SUBSPACE_FORMULAE.filter((f) => !pickedFormulae.some((p) => p.name === f.name))}

      <!-- Top: only the picked formulae — compact, editable, no clutter. -->
      <Card title={`Your formulae (${pickedFormulae.length})`}>
        <p class="mb-3 text-xs text-neutral-500">
          One <strong>active</strong> formula per space; others are inactive. Switching active in play takes a long turn of concentration (rules/18). Star (★) a formula to mark it active.
        </p>
        {#if pickedFormulae.length === 0}
          <p class="text-sm italic text-neutral-500">No formulae picked. Add one from the catalog below or create a custom.</p>
        {:else}
          <ul class="space-y-2">
            {#each pickedFormulae as p (p.id)}
              <li class={`flex items-start justify-between gap-2 rounded-lg border p-2 ${
                p.active ? 'border-cyan-400 bg-cyan-900/20' : 'border-neutral-700 bg-neutral-900/40'
              }`}>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-neutral-100">
                    {p.name}
                    <span class="ml-1 text-[10px] font-medium text-neutral-400">{p.hCost} H</span>
                    <span class="ml-1 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] font-medium uppercase text-neutral-400">{p.category}</span>
                    {#if p.active}
                      <span class="ml-1 rounded-full bg-cyan-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">active</span>
                    {/if}
                  </p>
                  {#if p.notes}
                    <p class="mt-0.5 text-[11px] leading-snug text-neutral-400">{p.notes}</p>
                  {/if}
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  {#if !p.active}
                    <button
                      type="button"
                      title="Make active"
                      onclick={() => (character = setActiveFormula(character, p.id))}
                      class="rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-700"
                    >★ Active</button>
                  {/if}
                  <button class="text-red-400 hover:text-red-300 text-lg leading-none" onclick={() => (character = removeFormulaUtil(character, p.id))} aria-label="Remove">×</button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}

        <!-- Custom-formula creator: for homebrew / GM-given formulae not in
             the printed catalog. Same lock-step add to formulae + spaces. -->
        <div class="mt-3">
          {#if !customFormulaOpen}
            <Button variant="secondary" onclick={() => (customFormulaOpen = true)}>+ Add custom formula</Button>
          {:else}
            <div class="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-cyan-300">Custom formula</p>
              <div class="grid gap-2 sm:grid-cols-[2fr_auto_auto]">
                <Input bind:value={customName} placeholder="Name (e.g. Phase Shift)" />
                <Input bind:value={customHCost} placeholder="H-cost (e.g. 2 or ed6)" />
                <Select
                  options={[
                    { value: 'basic', label: 'basic' },
                    { value: 'subspace', label: 'subspace' }
                  ]}
                  value={customCategory}
                  onchange={(v) => (customCategory = v as 'basic' | 'subspace')}
                />
              </div>
              <TextArea bind:value={customDescription} placeholder="Description / effect" rows={2} />
              <div class="flex justify-end gap-2">
                <Button variant="ghost" onclick={resetCustomForm}>Cancel</Button>
                <Button onclick={commitCustomFormula} disabled={!customName.trim()}>Add formula</Button>
              </div>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Bottom: catalog of UNPICKED formulae only, split basic / subspace. -->
      <Card title="Add from catalog">
        <h3 class="mb-2 text-sm font-semibold text-neutral-100">
          Basic formulae
          <span class="ml-1 text-[11px] font-normal text-neutral-500">({unpickedBasic.length} unpicked)</span>
        </h3>
        {#if unpickedBasic.length === 0}
          <p class="mb-2 text-xs italic text-neutral-500">All basic formulae picked.</p>
        {:else}
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {#each unpickedBasic as f (f.id)}
              <div class="rounded-lg border border-neutral-700 bg-neutral-900/30 p-2 text-xs">
                <div class="mb-1 flex items-start justify-between gap-2">
                  <p class="font-semibold text-neutral-100 leading-tight flex-1 min-w-0">
                    {f.name}
                    <span class="ml-1 whitespace-nowrap text-[10px] font-medium text-neutral-400">{f.formulaCost} H</span>
                  </p>
                  <button
                    type="button"
                    onclick={() => (character = addBasicFormula(character, f.id))}
                    class="shrink-0 rounded-full border border-cyan-600 bg-cyan-900/30 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-900/50"
                  >+ Pick</button>
                </div>
                <p class="text-[10px] leading-snug text-neutral-400">{f.description}</p>
              </div>
            {/each}
          </div>
        {/if}

        <h3 class="mt-4 mb-2 text-sm font-semibold text-neutral-100">
          Subspace formulae
          <span class="ml-1 text-[11px] font-normal text-neutral-500">({unpickedSubspace.length} unpicked)</span>
          {#if !subspaceUnlocked}
            <span class="ml-1 rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">locked</span>
          {/if}
        </h3>
        {#if !subspaceUnlocked}
          <p class="mb-2 text-xs italic text-amber-300">
            Subspace formulae require the <strong>Subspace Nanites</strong> bond. Change your bond on the Overview tab to unlock these.
          </p>
        {/if}
        {#if unpickedSubspace.length === 0}
          <p class="text-xs italic text-neutral-500">All subspace formulae picked.</p>
        {:else}
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {#each unpickedSubspace as f (f.id)}
              <div class={`rounded-lg border p-2 text-xs ${
                subspaceUnlocked
                  ? 'border-neutral-700 bg-neutral-900/30'
                  : 'border-neutral-800 bg-neutral-900/20 opacity-60'
              }`}>
                <div class="mb-1 flex items-start justify-between gap-2">
                  <p class="font-semibold text-neutral-100 leading-tight flex-1 min-w-0">
                    {f.name}
                    <span class="ml-1 whitespace-nowrap text-[10px] font-medium text-neutral-400">{f.bondedCost} H</span>
                  </p>
                  <button
                    type="button"
                    disabled={!subspaceUnlocked}
                    onclick={() => (character = addSubspaceFormula(character, f.id))}
                    class={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                      subspaceUnlocked
                        ? 'border-cyan-600 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-900/50'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-700 cursor-not-allowed'
                    }`}
                  >+ Pick</button>
                </div>
                <p class="text-[10px] leading-snug text-neutral-400">{f.description}</p>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    {:else}
      <!-- Apt + Prime: free-form spaces editor (no catalog applies). -->
      <Card title="Spaces">
        {#each character.spaces as s (s.id)}
          <div class="mb-3 rounded-lg border border-neutral-800 p-3">
            {#if character.type === 'apt'}
              <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                <Input bind:value={s.name} placeholder="Name" />
                <Select options={SPACE_KIND_OPTS} bind:value={s.kind as string} />
                <Toggle label="Active" bind:checked={s.active} />
              </div>
            {:else}
              <div class="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-end">
                <Input bind:value={s.name} placeholder="Name" />
                <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-300">{s.kind}</span>
                <Toggle label="Active" bind:checked={s.active} />
              </div>
            {/if}
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
      <Card title="Artistic Modification — read-only">
        <p class="mb-2 text-xs text-neutral-500">
          AM was wired during character creation. To change what's linked here, edit the underlying record directly (e.g. the Implant in the
          Implants tab, the language list in Languages, etc.).
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
            <p class="text-xs text-neutral-500">Pre-existing AM without linked records (description-only legacy).</p>
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

    <HarmTrackerPanel bind:character />

    <Card title="Trackers — Money">
      <div class="grid gap-3 lg:grid-cols-2">
        <section class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold text-neutral-200">On hand</h3>
            <span class="text-xs text-cyan-300 tabular-nums">{moneySlotsUsed} slot{moneySlotsUsed === 1 ? '' : 's'}</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <NumberInput label="Parts (P)" bind:value={character.purse.parts} min={0} showControls={false} />
            <NumberInput label="Small parts (p)" bind:value={character.purse.smallParts} min={0} showControls={false} />
            <NumberInput label="Energy packs (E)" bind:value={character.purse.energyPacks} min={0} showControls={false} />
            <NumberInput label="Energy cells (e)" bind:value={character.purse.energyCells} min={0} showControls={false} />
          </div>
          <p class="mt-2 text-xs text-neutral-500">
            Parts equivalent: {formatPartsEquivalent(onHandCash)} P · 10 P or 10 E per slot; 10 p = 1 P, 10 e = 1 E.
          </p>
        </section>

        <section class="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold text-neutral-200">Stashed</h3>
            <span class="text-xs text-neutral-500">off-character</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <NumberInput label="Parts (P)" bind:value={character.purse.stashedParts} min={0} showControls={false} />
            <NumberInput label="Small parts (p)" bind:value={character.purse.stashedSmallParts} min={0} showControls={false} />
            <NumberInput label="Energy packs (E)" bind:value={character.purse.stashedEnergyPacks} min={0} showControls={false} />
            <NumberInput label="Energy cells (e)" bind:value={character.purse.stashedEnergyCells} min={0} showControls={false} />
          </div>
          <p class="mt-2 text-xs text-neutral-500">Parts equivalent: {formatPartsEquivalent(stashedCash)} P · does not use carried slots.</p>
        </section>
      </div>
      <h3 class="mt-4 mb-2 text-sm font-semibold text-neutral-200">Debts</h3>
      {#each character.debts as d (d.id)}
        <div class="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto] items-end">
          <NumberInput label="Amount (P)" value={d.amount} showControls={false} onchange={(v) => (d.amount = v)} />
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

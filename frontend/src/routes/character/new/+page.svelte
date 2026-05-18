<script lang="ts">
  import { goto } from '$app/navigation';
  import type { SWCharacter, ArtisticModKind, ArtisticModRecord } from '$lib/models';
  import {
    createDefaultCharacter,
    type CharacterType,
    type LifeForm,
    type Background,
    type PrimaryStack,
    type Stack,
    PRIMARY_STACKS,
    ALL_STACKS,
    STACK_LABELS,
    BACKGROUNDS,
    LIFE_FORMS,
    CHARACTER_TYPES,
    allowedLifeForms,
    type Language,
    recomputeStacks
  } from '$lib/models';
  import { characterStore } from '$lib/stores';
  import { Button, Card, Input, NumberInput, Select, TextArea, Toggle } from '$lib/components/ui';
  import {
    BACKGROUNDS_DATA,
    LIFE_FORMS_DATA,
    TYPES_DATA,
    getType,
    getTypeGraph,
    mandatoryLanguageForLifeForm,
    LANGUAGES_DATA,
    BASIC_FORMULAE,
    SUBSPACE_FORMULAE,
    lifeFormGroup,
    startingPartsFor,
    WEAPONS_DATA,
    ARMOR_DATA,
    GEAR_DATA,
    KITS_DATA,
    VEHICLES_DATA,
    PETS_DATA,
    getKeywordEntry,
    STACK_BLURBS,
    languagePickEligibility,
    armorWarningForType,
    weaponWarningForType,
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
  import { rollD3, rollD6, rollD12 } from '$lib/utils/dice';
  import { animateRoll, animateDie } from '$lib/utils/rollAnimation';
  import { applyBonuses, applyBonusesComposed, type LifeFormBonusDistribution } from '$lib/utils/computed';
  import { kitFromDef, vehicleFromDef } from '$lib/utils/equipment';
  import CharacterEditForm from '$lib/components/character/CharacterEditForm.svelte';

  // ===== Wizard state =====
  let step = $state(0);
  const STEPS: { id: string; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'type', label: 'Type' },
    { id: 'stacks', label: 'Stack rolls' },
    { id: 'lifeform', label: 'Life-form' },
    { id: 'distribution', label: 'Bonus distribution' },
    { id: 'background', label: 'Background' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'languages', label: 'Languages' },
    { id: 'spaces', label: 'Spaces' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'identity', label: 'Identity' },
    { id: 'artistic', label: 'Artistic Mod' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'review', label: 'Review' }
  ];

  // ===== Working character =====
  let character = $state<SWCharacter>(createDefaultCharacter());

  // ===== Bonus distribution (life-form +2 / +1, Tank Born cap, combat pick) =====
  let distribution = $state<LifeFormBonusDistribution>({
    plus2: [],
    plus1: [],
    capped: undefined,
    combatPick: 'ranged'
  });

  // Whether the player has actually picked a background yet. False until they
  // touch the step-6 Select. While false, recomputeFinalStacks zeros out the
  // backgroundBonus contribution so step-5 totals don't include the default
  // background's bonuses (the model still carries one for type safety).
  let backgroundChosen = $state(false);

  // Whether the player has actually picked a type yet. False until setType()
  // runs the first time. Wizard guards Next + hides type-specific UI while
  // false; the model keeps a default type for type safety.
  let typeChosen = $state(false);

  // Same pattern for life-form. Cleared automatically by revalidate() if the
  // current life-form is no longer allowed (pair count changed).
  let lifeFormChosen = $state(false);

  /**
   * Apply life-form + background bonuses + type origo to the raw stack rolls
   * and write the result into character.stacks. Idempotent: re-runnable when
   * the user revisits earlier steps.
   */
  function recomputeFinalStacks() {
    // Fallback to zeros — never to character.stacks (those are bonused
    // and would compound). baseStackRolls is set by syncStackFromRoll.
    const raw = character.baseStackRolls ?? {
      archive: 0,
      bulk: 0,
      ghost: 0,
      morph: 0,
      speed: 0,
      tech: 0
    };
    // Compute the full per-slot composition (so the sheet can show the
    // breakdown later) and pull out the cached final scores.
    const composition = applyBonusesComposed({
      raw,
      type: character.type,
      lifeForm: character.lifeForm,
      background: character.background,
      distribution
    });
    // If player hasn't confirmed a background yet, strip background bonuses
    // from every stack and recompute the final cache.
    if (!backgroundChosen) {
      for (const k of ALL_STACKS) {
        const c = composition[k];
        c.backgroundBonus = 0;
        c.final = c.base + c.lifeFormBonus + c.backgroundBonus + c.implantBonus + c.other;
      }
    }
    character.stackComposition = composition;
    character.stacks = {
      archive: composition.archive.final,
      bulk: composition.bulk.final,
      ghost: composition.ghost.final,
      morph: composition.morph.final,
      speed: composition.speed.final,
      tech: composition.tech.final,
      close: composition.close.final,
      ranged: composition.ranged.final
    };
    if (character.type === 'apt') {
      character.aptCombatPick = distribution.combatPick;
    }
    if (character.lifeForm === 'tank_born') {
      character.tankCombatPick = distribution.combatPick;
      character.tankCappedStack = distribution.capped as 'archive' | 'bulk' | 'morph' | undefined;
    }
  }

  /**
   * True if a +2/+1 bonus on this stack would be silently swallowed by the
   * life-form's set/cap rule (Tank Born capped stack, Droid/Holid stackSets).
   * Bonuses on these stacks are ignored by `applyBonusesComposed` per
   * rules/18 — surfacing this in the UI prevents the player from "wasting"
   * a pick that does nothing.
   */
  function isSetOrCapped(stack: PrimaryStack): boolean {
    const lf = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm);
    if (!lf) return false;
    if (lf.pickCapStack && distribution.capped === stack) return true;
    if (lf.stackSets && lf.stackSets[stack as keyof typeof lf.stackSets] !== undefined) return true;
    return false;
  }

  function toggleDistributionPick(stack: PrimaryStack, slot: 'plus2' | 'plus1') {
    const arr = distribution[slot];
    const other: 'plus2' | 'plus1' = slot === 'plus2' ? 'plus1' : 'plus2';
    if (arr.includes(stack)) {
      // Toggle off in this slot.
      distribution[slot] = arr.filter((s) => s !== stack);
    } else {
      // Refuse adds to set/capped stacks — those would be silently ignored.
      if (isSetOrCapped(stack)) return;
      // Enforce life-form cap — refuse adds past plusNCount.
      const lf = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm);
      const cap = slot === 'plus2' ? (lf?.plus2Count ?? 0) : (lf?.plus1Count ?? 0);
      if (arr.length >= cap) return;
      // Mutually exclusive: drop from the other slot first, then add here.
      distribution[other] = distribution[other].filter((s) => s !== stack);
      distribution[slot] = [...arr, stack];
    }
    // Inline recompute keeps the totals fresh without a manual button —
    // a $effect-based version triggered Svelte's update-depth guard
    // because recomputeFinalStacks also writes to character fields.
    recomputeFinalStacks();
  }

  function setCappedStack(stack: 'archive' | 'bulk' | 'morph' | undefined) {
    distribution.capped = stack;
    // Mutual exclusivity: drop the newly-capped stack from any +2/+1 picks.
    if (stack) {
      distribution.plus2 = distribution.plus2.filter((s) => s !== stack);
      distribution.plus1 = distribution.plus1.filter((s) => s !== stack);
    }
    recomputeFinalStacks();
  }

  // ===== Stack rolling (SW rules-as-written) =====
  // For each primary stack: roll 2d6.
  //   - If a pair (matched dice) → score = 0 + count this as one "pair"
  //   - Else take the LOWEST die and read it as a d3:
  //        1-2 → 1
  //        3-4 → 2
  //        5-6 → 3
  // Number of pairs gates life-form (rules/18).

  type StackRoll = { d1: number | null; d2: number | null };
  // Empty by default — player must roll or type both dice for each stack.
  let stackRolls = $state<Record<string, StackRoll>>(Object.fromEntries(PRIMARY_STACKS.map((s) => [s, { d1: null, d2: null }])));

  // Cycling-display overlay used during slot-machine roll animation. While a
  // stack is rolling, the d1/d2 inputs render from stackDisplay; downstream
  // derived (score, pair, life-form gating) still reads stackRolls so it
  // doesn't flicker until the final value commits.
  let stackRolling = $state<Record<string, boolean>>(Object.fromEntries(PRIMARY_STACKS.map((s) => [s, false])));
  let stackDisplay = $state<Record<string, StackRoll>>(Object.fromEntries(PRIMARY_STACKS.map((s) => [s, { d1: null, d2: null }])));

  /** Pure derivation from two d6 rolls per SW procedure. `complete=false`
   *  when either die is missing — the table shows "—" and the score 0. */
  function deriveResult(d1: number | null, d2: number | null): { isPair: boolean; result: number; complete: boolean } {
    if (d1 == null || d2 == null) return { isPair: false, result: 0, complete: false };
    if (d1 === d2) return { isPair: true, result: 0, complete: true };
    const low = Math.min(d1, d2);
    return { isPair: false, result: Math.ceil(low / 2), complete: true };
  }

  function syncStackFromRoll(s: (typeof PRIMARY_STACKS)[number]) {
    const { d1, d2 } = stackRolls[s];
    const derived = deriveResult(d1, d2);
    // If the row isn't complete yet, leave baseStackRolls alone for THIS
    // stack — the wizard's recomputeFinalStacks falls back to 0 anyway.
    if (!derived.complete) {
      const next = { ...(character.baseStackRolls ?? {}) } as Partial<Record<typeof s, number>>;
      delete next[s];
      character.baseStackRolls = next;
    } else {
      character.baseStackRolls = {
        ...(character.baseStackRolls ?? {
          archive: 0,
          bulk: 0,
          ghost: 0,
          morph: 0,
          speed: 0,
          tech: 0
        }),
        [s]: derived.result
      };
    }
    // Pair count may now invalidate the chosen life-form.
    revalidate();
    recomputeFinalStacks();
  }

  function setDie(s: (typeof PRIMARY_STACKS)[number], which: 'd1' | 'd2', value: number | null) {
    const v = value == null ? null : Math.max(1, Math.min(6, value));
    stackRolls[s] = { ...stackRolls[s], [which]: v };
    syncStackFromRoll(s);
  }

  async function rollOnly(s: (typeof PRIMARY_STACKS)[number]) {
    if (stackRolling[s]) return;
    stackRolling[s] = true;
    const finalD1 = rollD6();
    const finalD2 = rollD6();
    await Promise.all([
      animateDie(6, finalD1, (v) => {
        stackDisplay[s] = { ...stackDisplay[s], d1: v };
      }),
      animateDie(6, finalD2, (v) => {
        stackDisplay[s] = { ...stackDisplay[s], d2: v };
      })
    ]);
    stackRolls[s] = { d1: finalD1, d2: finalD2 };
    syncStackFromRoll(s);
    stackDisplay[s] = { d1: null, d2: null };
    stackRolling[s] = false;
  }

  async function rollStacks() {
    await Promise.all(PRIMARY_STACKS.map((s) => rollOnly(s)));
  }

  function pairs(): number {
    let n = 0;
    for (const s of PRIMARY_STACKS) {
      const r = stackRolls[s];
      if (r && r.d1 != null && r.d2 != null && r.d1 === r.d2) n++;
    }
    return n;
  }

  // ===== Type-driven origo refresh =====
  function applyOrigo(type: CharacterType) {
    const graph = getTypeGraph(type);
    character.origo = {
      spaces: graph.origo.spaces,
      implants: graph.origo.implants,
      shadow: graph.origo.shadow,
      gunta: graph.origo.gunta,
      closeStart: graph.origo.closeStart,
      rangedStart: graph.origo.rangedStart
    };
    character.stacks.close = graph.origo.closeStart;
    character.stacks.ranged = graph.origo.rangedStart;
  }

  function setType(t: CharacterType) {
    const prev = character.type;
    character.type = t;
    typeChosen = true;
    applyOrigo(t);
    // Revalidate happens at the end of setType (already calls
    // recomputeFinalStacks); call here so type-dependent state (aptCombatPick,
    // coreBond, subspace formulae) is pruned BEFORE recompute reads it.
    revalidate();
    // Reconcile aptCombatPick with stack values across type swaps:
    // - Switching INTO Apt with an existing pick → re-apply so stacks
    //   match the highlighted button (instead of the graph defaults).
    // - Switching AWAY from Apt → clear pick + distribution slot so
    //   stale state doesn't leak into a later Apt re-selection or
    //   `recomputeFinalStacks()` overwrite.
    if (t === 'apt') {
      if (character.aptCombatPick === 'close' || character.aptCombatPick === 'ranged') {
        pickAptCombat(character.aptCombatPick);
      } else {
        // First Apt selection — sync distribution to the graph default.
        distribution.combatPick = character.stacks.close === 1 ? 'close' : 'ranged';
      }
    } else if (prev === 'apt') {
      character.aptCombatPick = undefined;
    }
    recomputeFinalStacks();
  }

  // For Apt: pick which combat starts at 1.
  // Keep `distribution.combatPick` in sync — `recomputeFinalStacks()`
  // reads the distribution slot, NOT `character.aptCombatPick`, when
  // computing final stacks. Without this sync the player's pick gets
  // silently reverted to the distribution default after any stack roll.
  function pickAptCombat(c: 'close' | 'ranged') {
    character.aptCombatPick = c;
    distribution.combatPick = c;
    character.stacks.close = c === 'close' ? 1 : 0;
    character.stacks.ranged = c === 'ranged' ? 1 : 0;
    character.origo.closeStart = character.stacks.close;
    character.origo.rangedStart = character.stacks.ranged;
    recomputeFinalStacks();
  }

  function setLifeForm(lf: LifeForm) {
    const prevLf = character.lifeForm;
    const prevMand = mandatoryLanguageForLifeForm(prevLf);
    character.lifeForm = lf;
    lifeFormChosen = true;
    // Drop the OLD mandatory language if it changed (so a Droid → Blood swap
    // doesn't leave Al-Gol stuck as a non-mandatory pick the player can't
    // remove).
    const newMand = mandatoryLanguageForLifeForm(lf);
    if (prevMand && prevMand !== newMand) {
      character.languages = character.languages.filter((l) => l !== prevMand);
    }
    if (newMand && !character.languages.includes(newMand)) {
      character.languages = [...character.languages.filter((l) => l !== 'pidgin'), 'pidgin', newMand];
    }
    revalidate();
    recomputeFinalStacks();
  }

  function setBackground(bg: Background) {
    character.background = bg;
    revalidate();
    recomputeFinalStacks();
  }

  /**
   * Cascading revalidation — pruned ANY selection that's no longer legal in
   * the current state. Call after every mutator that could invalidate a
   * downstream pick (type / life-form / background / stack rolls / d3 roll).
   * Safe to call multiple times — it's idempotent on a clean state.
   */
  function revalidate() {
    // --- Type-dependent state ---
    if (character.type !== 'apt') {
      character.aptCombatPick = undefined;
    }
    if (character.type !== 'core') {
      character.coreBond = undefined;
      // Subspace formulae are Core+subspace_nanites only — drop them.
      const dropIds = new Set(character.formulae.filter((f) => f.category === 'subspace').map((f) => f.id));
      if (dropIds.size > 0) {
        character.formulae = character.formulae.filter((f) => !dropIds.has(f.id));
        character.spaces = character.spaces.filter((s) => !dropIds.has(s.id));
      }
    } else if (character.coreBond !== 'subspace_nanites') {
      // Core but no subspace bond — subspace formulae still invalid.
      const dropIds = new Set(character.formulae.filter((f) => f.category === 'subspace').map((f) => f.id));
      if (dropIds.size > 0) {
        character.formulae = character.formulae.filter((f) => !dropIds.has(f.id));
        character.spaces = character.spaces.filter((s) => !dropIds.has(s.id));
      }
    }

    // --- Life-form vs. pair-count gate ---
    const allowed = allowedLifeForms(pairs());
    if (lifeFormChosen && !allowed.includes(character.lifeForm)) {
      lifeFormChosen = false;
    }

    // --- Distribution caps + special-slot validity ---
    const lf = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm);
    if (lf) {
      // Trim plus2 / plus1 if the new life-form has lower caps.
      if (distribution.plus2.length > lf.plus2Count) {
        distribution.plus2 = distribution.plus2.slice(0, lf.plus2Count);
      }
      if (distribution.plus1.length > lf.plus1Count) {
        distribution.plus1 = distribution.plus1.slice(0, lf.plus1Count);
      }
      // Capped stack only valid if the life-form allows pickCapStack AND the
      // pick is in capStackOptions.
      if (!lf.pickCapStack || !(lf.capStackOptions ?? []).includes(distribution.capped as any)) {
        distribution.capped = undefined;
      }
      // combatPick relevant only for Apt or lf.combatBonusMode='either'.
      // Leave value as-is; it's harmless when ignored, and dropping it would
      // strand Apts mid-flow.
    }

    // --- Keywords vs. background ---
    // Background picks must be from the current background; cross-picks must
    // NOT be from the current background.
    if (backgroundChosen) {
      const bgKws = BACKGROUNDS_DATA.find((b) => b.id === character.background)?.keywords.map((k) => k.name) ?? [];
      character.keywords = character.keywords.filter((k) => {
        if (k.source === 'background') {
          // Must be from current background AND its keyword list.
          return k.fromBackground === character.background && bgKws.includes(k.name);
        }
        if (k.source === 'cross') {
          // Must be from a DIFFERENT background.
          return k.fromBackground !== character.background;
        }
        return true;
      });
    }

    // --- Languages: enforce restriction + slot cap + mandatory consistency ---
    const slots = languageSlotsAllowed();
    const newMandatory = mandatoryLanguageForLifeForm(character.lifeForm);
    // Drop any restricted language that no longer qualifies (e.g. Krypotkep
    // when not Construct, or after losing the d3=3 unlock).
    character.languages = character.languages.filter((id) => {
      const def = LANGUAGES_DATA.find((x) => x.id === id);
      if (!def?.restriction) return true;
      // Skip mandatory + pidgin always-keep checks (they're handled below).
      if (id === 'pidgin' || id === newMandatory) return true;
      const reason = languagePickEligibility(def, character.lifeForm, character.thirdLanguageRoll === 3, 0);
      return !reason;
    });
    // Trim extra picks if d3 dropped slots.
    let extras = character.languages.filter((l) => l !== 'pidgin' && l !== newMandatory);
    if (extras.length > slots) {
      const keepExtras = new Set(extras.slice(0, slots));
      character.languages = character.languages.filter((l) => l === 'pidgin' || l === newMandatory || keepExtras.has(l));
    }
  }

  // ===== Keywords =====
  // Rules/19: 3 keywords from chosen background + 1 cross-pick from a
  // different background. Each keyword sits under ONE stack column — placement
  // changes what it boosts/unblocks. Same keyword cannot be picked twice.
  let availableKw = $derived(BACKGROUNDS_DATA.find((b) => b.id === character.background)?.keywords ?? []);
  // Other backgrounds — eligible for cross-pick.
  let otherBackgrounds = $derived(BACKGROUNDS_DATA.filter((b) => b.id !== character.background));

  function pickedKwByName(name: string) {
    return character.keywords.find((k) => k.name === name);
  }

  /**
   * Pick or move a keyword. If the keyword is already in character.keywords:
   *   - Same source + same stack → remove it (toggle off).
   *   - Otherwise → update its stack/source/fromBackground in place.
   * If new:
   *   - Refuse if source slot is full (3 background or 1 cross).
   *   - Otherwise append.
   */
  function pickKeyword(name: string, source: 'background' | 'cross', fromBackground: Background, stack: PrimaryStack) {
    const existing = pickedKwByName(name);
    if (existing) {
      if (existing.source === source && existing.stack === stack) {
        // Toggle off — remove.
        character.keywords = character.keywords.filter((k) => k.id !== existing.id);
        return;
      }
      // Move / restack.
      character.keywords = character.keywords.map((k) => (k.id === existing.id ? { ...k, source, fromBackground, stack } : k));
      return;
    }
    // New pick — enforce slot caps.
    const cap = source === 'background' ? 3 : 1;
    const have = character.keywords.filter((k) => k.source === source).length;
    if (have >= cap) return;
    character.keywords = [
      ...character.keywords,
      {
        id: crypto.randomUUID(),
        name,
        stack,
        notes: '',
        source,
        fromBackground
      }
    ];
  }

  function removeKw(id: string) {
    character.keywords = character.keywords.filter((k) => k.id !== id);
  }

  function removeKwByName(name: string) {
    character.keywords = character.keywords.filter((k) => k.name !== name);
  }

  // ===== Languages =====
  let displayD3 = $state<number | null>(null);
  let rollingD3 = $state(false);
  async function rollThirdLanguage() {
    if (rollingD3) return;
    rollingD3 = true;
    const final = rollD3();
    await animateDie(3, final, (v) => (displayD3 = v));
    character.thirdLanguageRoll = final;
    displayD3 = null;
    rollingD3 = false;
    revalidate();
  }
  function toggleLang(l: (typeof LANGUAGES_DATA)[number]['id']) {
    // Pidgin is universal — never removable.
    if (l === 'pidgin') return;
    // Mandatory life-form language is also locked once life-form is set.
    const mandatory = mandatoryLanguageForLifeForm(character.lifeForm);
    if (l === mandatory) return;
    if (character.languages.includes(l)) {
      character.languages = character.languages.filter((x) => x !== l);
    } else {
      // Refuse adds past the slot cap (1 free + 1 if d3 = 3).
      const slots = languageSlotsAllowed();
      const picked = extraLanguagesPicked();
      if (picked >= slots) return;
      // Refuse if the language has a mechanical restriction the character
      // doesn't meet (e.g. Krypotkep = construct + third-slot only).
      const def = LANGUAGES_DATA.find((x) => x.id === l);
      if (def) {
        const reason = languagePickEligibility(def, character.lifeForm, character.thirdLanguageRoll === 3, picked);
        if (reason) return;
      }
      character.languages = [...character.languages, l];
    }
  }

  /** Player's allowed extra-language slots beyond the mandatory ones. */
  function languageSlotsAllowed(): number {
    // 1 free pick + 1 if the d3 came up 3.
    return 1 + (character.thirdLanguageRoll === 3 ? 1 : 0);
  }

  /** How many "extra" languages have been picked beyond mandatory. */
  function extraLanguagesPicked(): number {
    const mandatory = mandatoryLanguageForLifeForm(character.lifeForm);
    return character.languages.filter((l) => l !== 'pidgin' && l !== mandatory).length;
  }

  // ===== Funds =====
  let displayFundsD6 = $state<number | null>(null);
  let rollingFunds = $state(false);
  async function rollFunds() {
    if (rollingFunds) return;
    rollingFunds = true;
    const r = rollD6();
    await animateDie(6, r, (v) => (displayFundsD6 = v));
    character.startingFundsRoll = r;
    character.startingFunds = startingPartsFor(character.lifeForm, r);
    character.purse.parts = character.startingFunds;
    displayFundsD6 = null;
    rollingFunds = false;
  }

  /** Manual override: player types a d6 result, app derives the Parts amount. */
  function setFundsRoll(r: number) {
    const clamped = Math.max(1, Math.min(6, Math.round(r) || 1));
    character.startingFundsRoll = clamped;
    character.startingFunds = startingPartsFor(character.lifeForm, clamped);
    character.purse.parts = character.startingFunds;
  }

  /** Manual override: player types the Parts amount directly (ignores d6). */
  function setFundsParts(p: number) {
    const clamped = Math.max(0, Math.round(p) || 0);
    character.startingFunds = clamped;
    character.purse.parts = clamped;
  }

  // ===== Starter equipment (rules/24) =====
  // Players may pick up to 5 free items (each ≤ 100 P) AND buy more with their
  // starting Parts. The free picks are marked `freePick: true` and do NOT
  // deduct from the purse; bought items DO deduct.

  /** True if an item is too expensive to be a free pick (rules/24: ≤ 100 P). */
  function isFreeEligible(cost: number): boolean {
    return cost <= 100;
  }

  /** Count of items currently flagged as free starter picks. */
  function freePicksUsed(): number {
    let n = 0;
    for (const i of character.inventory) if (i.freePick) n++;
    for (const w of character.weapons) if ((w as any).freePick) n++;
    for (const a of character.armor) if ((a as any).freePick) n++;
    return n;
  }

  function gearCarryDefaults(name: string, slots: number) {
    const isBackpackish = /backpack|valise/i.test(name);
    const isCarrierBot = /carrier bot/i.test(name);
    return {
      location: isBackpackish ? ('slot10' as const) : slots === 0 ? ('no_slot' as const) : ('worn' as const),
      equipped: true,
      stashed: false,
      isContainer: isBackpackish || isCarrierBot,
      containerSlots: isCarrierBot ? 10 : isBackpackish ? 5 : 0
    };
  }

  /**
   * Add a starter item from the catalog. Mode 'free' means it's marked
   * freePick (no purse deduction); mode 'buy' deducts from purse.
   * Refuses if free cap reached, item too pricey for free, or insufficient
   * funds for a buy.
   */
  function addStarterItem(source: 'weapon' | 'armor' | 'gear' | 'kit' | 'vehicle' | 'pet', catalogId: string, mode: 'free' | 'buy') {
    if (mode === 'free' && freePicksUsed() >= 5) return;

    if (source === 'weapon') {
      const w = WEAPONS_DATA.find((x) => x.id === catalogId);
      if (!w) return;
      if (mode === 'free' && !isFreeEligible(w.cost)) return;
      if (mode === 'buy' && character.purse.parts < w.cost) return;
      character.weapons = [
        ...character.weapons,
        {
          id: crypto.randomUUID(),
          name: w.name,
          damage: w.damage,
          damageType: w.damageType,
          slots: w.slots,
          range: w.range,
          clip: w.clip,
          ammoLoaded: w.clip,
          ammoSpare: 0,
          cost: w.cost,
          kit: w.kit,
          specials: w.specials,
          notes: w.notes,
          equipped: true,
          stashed: false,
          ...(mode === 'free' ? { freePick: true } : {})
        } as any
      ];
      if (mode === 'buy') character.purse.parts -= w.cost;
    } else if (source === 'armor') {
      const a = ARMOR_DATA.find((x) => x.id === catalogId);
      if (!a) return;
      if (mode === 'free' && !isFreeEligible(a.cost)) return;
      if (mode === 'buy' && character.purse.parts < a.cost) return;
      character.armor = [
        ...character.armor,
        {
          id: crypto.randomUUID(),
          name: a.name,
          strength: a.strength,
          weakness: a.weakness,
          slots: a.slots,
          cost: a.cost,
          kit: a.kit,
          notes: a.notes,
          primeOnly: a.primeOnly,
          equipped: true,
          stashed: false,
          isShield: a.isShield,
          isHelmet: a.isHelmet,
          ...(mode === 'free' ? { freePick: true } : {})
        } as any
      ];
      if (mode === 'buy') character.purse.parts -= a.cost;
    } else if (source === 'gear') {
      const g = GEAR_DATA.find((x) => x.id === catalogId);
      if (!g) return;
      if (mode === 'free' && !isFreeEligible(g.cost)) return;
      if (mode === 'buy' && character.purse.parts < g.cost) return;
      character.inventory = [
        ...character.inventory,
        {
          id: crypto.randomUUID(),
          name: g.name,
          slots: g.slots,
          cost: g.cost,
          ...gearCarryDefaults(g.name, g.slots),
          notes: g.notes,
          kit: g.kit,
          energyDraw: g.energy,
          freePick: mode === 'free'
        }
      ];
      if (mode === 'buy') character.purse.parts -= g.cost;
    } else if (source === 'kit') {
      const k = KITS_DATA.find((x) => x.id === catalogId);
      if (!k) return;
      if (mode === 'free' && !isFreeEligible(k.cost)) return;
      if (mode === 'buy' && character.purse.parts < k.cost) return;
      character.inventory = [...character.inventory, { ...kitFromDef(k), freePick: mode === 'free' }];
      if (mode === 'buy') character.purse.parts -= k.cost;
    } else if (source === 'vehicle') {
      const v = VEHICLES_DATA.find((x) => x.id === catalogId);
      if (!v) return;
      if (mode === 'free' && !isFreeEligible(v.cost)) return;
      if (mode === 'buy' && character.purse.parts < v.cost) return;
      character.inventory = [...character.inventory, { ...vehicleFromDef(v), freePick: mode === 'free' }];
      if (mode === 'buy') character.purse.parts -= v.cost;
    } else {
      const p = PETS_DATA.find((x) => x.id === catalogId);
      if (!p) return;
      // Pets aren't usually a "free pick" item, but allow it for fairness.
      if (mode === 'free' && !isFreeEligible(p.cost)) return;
      if (mode === 'buy' && character.purse.parts < p.cost) return;
      character.pets = [
        ...character.pets,
        {
          id: crypto.randomUUID(),
          name: p.name,
          kind: p.name,
          upkeepPerWeek: p.upkeepPerWeek,
          notes: p.notes
        }
      ];
      if (mode === 'buy') character.purse.parts -= p.cost;
    }
  }

  /** Remove a starter item by id + source — refunds purse if it was a buy. */
  function removeStarterItem(source: 'weapon' | 'armor' | 'gear' | 'kit' | 'vehicle' | 'pet', id: string) {
    if (source === 'weapon') {
      const w = character.weapons.find((x) => x.id === id);
      if (!w) return;
      if (!(w as any).freePick) character.purse.parts += w.cost ?? 0;
      character.weapons = character.weapons.filter((x) => x.id !== id);
    } else if (source === 'armor') {
      const a = character.armor.find((x) => x.id === id);
      if (!a) return;
      if (!(a as any).freePick) character.purse.parts += a.cost ?? 0;
      character.armor = character.armor.filter((x) => x.id !== id);
    } else if (source === 'gear' || source === 'kit' || source === 'vehicle') {
      const i = character.inventory.find((x) => x.id === id);
      if (!i) return;
      if (!i.freePick) character.purse.parts += i.cost ?? 0;
      character.inventory = character.inventory.filter((x) => x.id !== id);
    } else {
      character.pets = character.pets.filter((x) => x.id !== id);
    }
  }

  // Per-tab catalog filter for the starter equipment picker.
  let equipFilter = $state('');
  let equipTab = $state<'weapon' | 'armor' | 'gear' | 'kit' | 'vehicle' | 'pet'>('gear');

  // ===== Spaces (Core formulae) =====
  // For Core characters, each formula is also a space — keep them in lock-step
  // so the sheet view doesn't drift.
  function addCoreFormula(formulaId: string) {
    const f = BASIC_FORMULAE.find((x) => x.id === formulaId);
    if (!f) return;
    const isFirst = character.formulae.length === 0;
    const sharedId = crypto.randomUUID();
    character.formulae = [
      ...character.formulae,
      {
        id: sharedId,
        name: f.name,
        category: 'basic',
        active: isFirst,
        hCost: f.formulaCost,
        notes: f.description
      }
    ];
    character.spaces = [
      ...character.spaces,
      {
        id: sharedId,
        active: isFirst,
        kind: 'formula',
        name: f.name,
        effect: f.description,
        notes: `${f.formulaCost} H`
      }
    ];
  }
  function removeFormula(id: string) {
    character.formulae = character.formulae.filter((f) => f.id !== id);
    character.spaces = character.spaces.filter((s) => s.id !== id);
  }

  /** Per-section search filters for the Core formulae lists. */
  let basicFormulaFilter = $state('');
  let subspaceFormulaFilter = $state('');

  /** Add a subspace formula — only callable when the Core has the subspace
   *  nanites bond. Mirrors basic formula behavior. */
  function addSubspaceFormula(formulaId: string) {
    const f = SUBSPACE_FORMULAE.find((x) => x.id === formulaId);
    if (!f) return;
    const isFirst = character.formulae.length === 0;
    const sharedId = crypto.randomUUID();
    character.formulae = [
      ...character.formulae,
      {
        id: sharedId,
        name: f.name,
        category: 'subspace',
        active: isFirst,
        hCost: f.bondedCost,
        notes: f.description
      }
    ];
    character.spaces = [
      ...character.spaces,
      {
        id: sharedId,
        active: isFirst,
        kind: 'formula',
        name: f.name,
        effect: f.description,
        notes: `${f.bondedCost} H (subspace)`
      }
    ];
  }

  /**
   * Toggle which formula (and its mirrored space) is the *active* one. Per
   * rules/18, Core characters have one active and one inactive in each space;
   * switching active takes a long turn of concentration in play.
   */
  function setActiveFormula(id: string) {
    character.formulae = character.formulae.map((f) => ({ ...f, active: f.id === id }));
    character.spaces = character.spaces.map((s) => (s.kind === 'formula' ? { ...s, active: s.id === id } : s));
  }

  // ===== Apt-space catalog options (memoised) =====
  // Combined catalog of weapon/armor/gear so the player can pick anything in
  // the books OR fall back to a custom name. Pet picker uses PETS_DATA.
  const APT_EQUIP_OPTIONS = [
    { value: '', label: '— pick from books, or freeform name below —' },
    { value: 'custom', label: '(custom — type a name below)' },
    ...WEAPONS_DATA.map((w) => ({ value: `weapon:${w.id}`, label: `🗡 ${w.name}` })),
    ...ARMOR_DATA.map((a) => ({ value: `armor:${a.id}`, label: `🛡 ${a.name}` })),
    ...GEAR_DATA.map((g) => ({ value: `gear:${g.id}`, label: `🎒 ${g.name}` }))
  ];
  const APT_PET_OPTIONS = [
    { value: '', label: '— pick from books, or freeform name below —' },
    { value: 'custom', label: '(custom — type a name below)' },
    ...PETS_DATA.map((p) => ({ value: p.id, label: p.name }))
  ];

  /** Per-space transient form-state for the catalog picker (alias text + last
   *  picked catalog id). Keyed by space id so each card has its own. */
  let aptSpaceForm = $state<Record<string, { catalog: string; alias: string }>>({});

  function ensureAptForm(spaceId: string) {
    if (!aptSpaceForm[spaceId]) {
      aptSpaceForm[spaceId] = { catalog: '', alias: '' };
    }
  }

  function setSpaceCatalog(spaceId: string, catalogValue: string) {
    ensureAptForm(spaceId);
    aptSpaceForm[spaceId].catalog = catalogValue;
    if (!catalogValue || catalogValue === 'custom') return;
    const [src, id] = catalogValue.split(':') as ['weapon' | 'armor' | 'gear', string];
    pickEquipmentForSpace(spaceId, src, id, aptSpaceForm[spaceId].alias);
  }

  function setSpaceAlias(spaceId: string, alias: string) {
    ensureAptForm(spaceId);
    aptSpaceForm[spaceId].alias = alias;
    // Re-format the display name if a catalog item is currently picked.
    const cat = aptSpaceForm[spaceId].catalog;
    if (cat && cat !== 'custom') {
      const [src, id] = cat.split(':') as ['weapon' | 'armor' | 'gear', string];
      const baseName =
        src === 'weapon'
          ? WEAPONS_DATA.find((x) => x.id === id)?.name
          : src === 'armor'
            ? ARMOR_DATA.find((x) => x.id === id)?.name
            : GEAR_DATA.find((x) => x.id === id)?.name;
      if (baseName) updateAptSpace(spaceId, { name: formatSpaceName(baseName, alias) });
    }
  }

  function setSpacePetCatalog(spaceId: string, catalogId: string) {
    ensureAptForm(spaceId);
    aptSpaceForm[spaceId].catalog = catalogId;
    if (!catalogId || catalogId === 'custom') return;
    pickPetForSpace(spaceId, catalogId, aptSpaceForm[spaceId].alias);
  }

  function setSpacePetAlias(spaceId: string, alias: string) {
    ensureAptForm(spaceId);
    aptSpaceForm[spaceId].alias = alias;
    const cat = aptSpaceForm[spaceId].catalog;
    if (cat && cat !== 'custom') {
      const baseName = PETS_DATA.find((x) => x.id === cat)?.name;
      if (baseName) updateAptSpace(spaceId, { name: formatSpaceName(baseName, alias) });
    }
  }

  // ===== Apt spaces (equipment / master / place / pet) =====
  // Per rules/18: each Apt space holds one equipment / master / place / pet
  // and grants a 1/24h "treat stack as one scale higher" boost when the
  // content relates to the action. The wizard lets the player fill the slot
  // now or skip and fill in play.

  /** Add an empty Apt space (capped at character.origo.spaces). */
  function addAptSpace() {
    if (character.spaces.length >= character.origo.spaces) return;
    character.spaces = [
      ...character.spaces,
      {
        id: crypto.randomUUID(),
        active: true,
        kind: 'equipment',
        name: '',
        effect: '',
        notes: ''
      }
    ];
  }

  /** Remove a space by id (generic — used for Apt + Prime). */
  function removeSpace(id: string) {
    character.spaces = character.spaces.filter((s) => s.id !== id);
    // If it was a Core formula slot, keep formulae mirrored.
    character.formulae = character.formulae.filter((f) => f.id !== id);
  }

  /** Update one field of an Apt space in place. */
  function updateAptSpace(
    id: string,
    patch: Partial<{ kind: 'equipment' | 'master' | 'place' | 'pet'; name: string; effect: string; notes: string }>
  ) {
    character.spaces = character.spaces.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }

  /**
   * Format a display name from a base catalog name + optional alias.
   * "Kin-Gun" + "Last Chance" → "Kin-Gun \"Last Chance\""
   */
  function formatSpaceName(baseName: string, alias: string): string {
    const a = alias.trim();
    if (!a) return baseName;
    return `${baseName} "${a}"`;
  }

  /**
   * Pick an equipment catalog entry for an Apt space — also pushes the item
   * onto the character's weapons/armor/inventory list so the equipment step
   * already shows it. The display name uses the alias when provided.
   *
   * Catalog source may be 'weapon' | 'armor' | 'gear' | 'custom'. For custom
   * the player provides everything by hand via the name input.
   */
  function pickEquipmentForSpace(spaceId: string, source: 'weapon' | 'armor' | 'gear', catalogId: string, alias: string) {
    let displayName = '';
    if (source === 'weapon') {
      const w = WEAPONS_DATA.find((x) => x.id === catalogId);
      if (!w) return;
      displayName = formatSpaceName(w.name, alias);
      character.weapons = [
        ...character.weapons,
        {
          id: crypto.randomUUID(),
          name: displayName,
          damage: w.damage,
          damageType: w.damageType,
          slots: w.slots,
          range: w.range,
          clip: w.clip,
          ammoLoaded: w.clip,
          ammoSpare: 0,
          cost: w.cost,
          kit: w.kit,
          specials: w.specials,
          notes: w.notes,
          equipped: true,
          stashed: false
        }
      ];
    } else if (source === 'armor') {
      const a = ARMOR_DATA.find((x) => x.id === catalogId);
      if (!a) return;
      displayName = formatSpaceName(a.name, alias);
      character.armor = [
        ...character.armor,
        {
          id: crypto.randomUUID(),
          name: displayName,
          strength: a.strength,
          weakness: a.weakness,
          slots: a.slots,
          cost: a.cost,
          kit: a.kit,
          notes: a.notes,
          primeOnly: a.primeOnly,
          equipped: true,
          stashed: false,
          isShield: a.isShield,
          isHelmet: a.isHelmet
        }
      ];
    } else {
      const g = GEAR_DATA.find((x) => x.id === catalogId);
      if (!g) return;
      displayName = formatSpaceName(g.name, alias);
      character.inventory = [
        ...character.inventory,
        {
          id: crypto.randomUUID(),
          name: displayName,
          slots: g.slots,
          cost: g.cost,
          ...gearCarryDefaults(g.name, g.slots),
          notes: g.notes,
          kit: g.kit,
          energyDraw: g.energy
        }
      ];
    }
    updateAptSpace(spaceId, { name: displayName });
  }

  /**
   * Pick a pet catalog entry for an Apt space — also pushes a CharacterPet
   * onto the character so the pet step already shows it.
   */
  function pickPetForSpace(spaceId: string, catalogId: string, alias: string) {
    const p = PETS_DATA.find((x) => x.id === catalogId);
    if (!p) return;
    const displayName = formatSpaceName(p.name, alias);
    character.pets = [
      ...character.pets,
      {
        id: crypto.randomUUID(),
        name: displayName,
        kind: p.name,
        upkeepPerWeek: p.upkeepPerWeek,
        notes: p.notes
      }
    ];
    updateAptSpace(spaceId, { name: displayName });
  }

  // ===== Save =====
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  async function finish() {
    saving = true;
    saveError = null;
    try {
      // If we never left the AM step, make sure its effects are applied
      // before persisting (Save button bypasses next/back).
      if (STEPS[step].id === 'artistic') {
        applyArtisticMod();
      }
      character.updatedAt = new Date().toISOString();
      await characterStore.addCharacter(character);
      goto(`/character/${character.id}`);
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Save failed.';
    } finally {
      saving = false;
    }
  }

  // ===== Artistic Modification (rules/30) =====
  //
  // The AM step picks ONE underlying mechanic and ACTUALLY applies it to the
  // character data — not just a description string. We keep a draft buffer
  // here so the player can reshape their AM choice multiple times before
  // leaving the step; the apply/undo cycle runs on `next()` (or `finish()`).
  //
  // Each kind's draft fields live under `amDraft`. Effects are applied via
  // `applyArtisticMod()` which first undoes any previously-applied refs
  // (idempotent re-entry from Back), then writes the new effect + records
  // the ids in `character.artisticMod.appliedRefs`.

  type AmDraft = {
    kind: ArtisticModKind;
    description: string;
    drawback: string;
    // language
    languageId: Language | '';
    // extra_keyword
    keywordSourceBg: Background | '';
    keywordName: string;
    keywordStack: Stack;
    // reputation
    reputationValue: number;
    // special_coin
    coinName: string;
    coinEffect: string;
    coinRefresh: 'session' | 'milestone' | 'never' | 'other';
    coinRefreshNotes: string;
    // shadow_plus
    shadowDelta: number;
    shadowReason: string;
    // expensive_equipment
    equipmentName: string;
    equipmentCost: number;
    equipmentHolder: string;
    equipmentSlots: number;
    equipmentLocation: 'worn' | 'slot10' | 'backpack' | 'no_slot' | 'mission' | 'storage' | 'other';
    // implant
    implantName: string;
    implantBodyPart: 'head' | 'body' | 'leg' | 'arm' | 'hand' | 'eye' | 'other';
    implantEffect: string;
    implantStack: Stack | '';
    implantStackBonus: number;
  };

  function freshAmDraft(): AmDraft {
    return {
      kind: 'language',
      description: '',
      drawback: '',
      languageId: '',
      keywordSourceBg: '',
      keywordName: '',
      keywordStack: 'archive',
      reputationValue: 1,
      coinName: '',
      coinEffect: '',
      coinRefresh: 'session',
      coinRefreshNotes: '',
      shadowDelta: 1,
      shadowReason: '',
      equipmentName: '',
      equipmentCost: 0,
      equipmentHolder: '',
      // Default to a "lives somewhere safe / not encumbering" slot. Storage
      // is a sensible default for genuinely expensive items the player will
      // place into the right slot later (worn/backpack/etc.).
      equipmentSlots: 1,
      equipmentLocation: 'storage',
      implantName: '',
      implantBodyPart: 'eye',
      implantEffect: '',
      implantStack: '',
      implantStackBonus: 0
    };
  }

  let amDraft = $state<AmDraft>(freshAmDraft());

  /**
   * Undo whatever we previously applied for this AM (so re-entering the step
   * and changing the choice doesn't double-up effects). Walks `appliedRefs`
   * and removes any ids it owns; restores absolute snapshots for replace-style
   * fields (reputation, shadow, typeGraphPosition) so a player who edited
   * those between AM applies still gets a clean rollback.
   */
  function undoArtisticMod() {
    const am = character.artisticMod;
    if (!am || !am.appliedRefs) return;
    const r = am.appliedRefs;
    if (r.languageId) {
      character.languages = character.languages.filter((l) => l !== r.languageId);
    }
    if (r.keywordId) {
      character.keywords = character.keywords.filter((k) => k.id !== r.keywordId);
    }
    if (r.specialCoinId) {
      character.specialCoins = character.specialCoins.filter((c) => c.id !== r.specialCoinId);
    }
    if (r.inventoryItemId) {
      character.inventory = character.inventory.filter((i) => i.id !== r.inventoryItemId);
    }
    if (r.debtId) {
      character.debts = character.debts.filter((d) => d.id !== r.debtId);
    }
    if (r.implantId) {
      character.implants = character.implants.filter((i) => i.id !== r.implantId);
      // refresh implant-bonus composition slot
      character = recomputeStacks(character, true);
    }
    // Replace-style restores: prefer the prior absolute snapshot when present,
    // otherwise fall back to delta subtraction (legacy records pre-snapshot).
    const prev = r.previousValues;
    if (r.reputationDelta !== undefined) {
      if (prev?.reputation !== undefined) {
        character.reputation = prev.reputation;
      } else {
        character.reputation = Math.max(0, character.reputation - r.reputationDelta);
      }
    }
    if (r.guntaDelta) {
      if (prev?.guntaValue !== undefined) {
        character.guntaValue = prev.guntaValue;
      } else {
        character.guntaValue = Math.max(0, character.guntaValue - r.guntaDelta);
      }
    }
    if (r.shadowDelta) {
      if (prev?.shadow !== undefined) {
        character.shadow = prev.shadow;
      } else {
        character.shadow = Math.max(0, character.shadow - r.shadowDelta);
      }
      if (prev?.typeGraphPosition) {
        character.typeGraphPosition = { ...prev.typeGraphPosition };
      } else {
        const tg = character.typeGraphPosition ?? { x: 0, y: 0 };
        character.typeGraphPosition = {
          x: Math.max(0, tg.x - r.shadowDelta),
          y: tg.y
        };
      }
    }
  }

  /**
   * Defensive clamp for shadow_plus — keep typeGraphPosition.x within the
   * type's plotted graph bounds. Shadow value can run higher than the graph
   * (rules/52 — Shadow Encounters), but the position should not exceed the
   * type's max x or the graph view goes off-grid.
   */
  function maxGraphX(): number {
    const graph = getTypeGraph(character.type);
    let maxX = 0;
    for (const n of graph.nodes) {
      if (n.x > maxX) maxX = n.x;
    }
    return maxX;
  }

  /**
   * Apply the current `amDraft` to the character. Idempotent: undoes any
   * previously-recorded refs first. Writes a fresh `artisticMod` with the
   * new `appliedRefs` so the edit-mode UI can surface the linked records.
   *
   * Records `chosen: true` ONLY if some mechanical effect was actually
   * applied or the player wrote a description / drawback (off_list / notes
   * use case). Empty subforms leave `chosen: false` so review-step gating
   * can detect "nothing picked".
   */
  function applyArtisticMod() {
    undoArtisticMod();
    const refs: NonNullable<ArtisticModRecord['appliedRefs']> = {};
    const rec: ArtisticModRecord = {
      chosen: false,
      kind: amDraft.kind,
      description: amDraft.description || undefined,
      drawback: amDraft.drawback || undefined
    };

    switch (amDraft.kind) {
      case 'language': {
        if (amDraft.languageId && !character.languages.includes(amDraft.languageId)) {
          character.languages = [...character.languages, amDraft.languageId];
          refs.languageId = amDraft.languageId;
        }
        break;
      }
      case 'extra_keyword': {
        if (amDraft.keywordName) {
          const id = crypto.randomUUID();
          character.keywords = [
            ...character.keywords,
            {
              id,
              name: amDraft.keywordName,
              stack: amDraft.keywordStack,
              notes: '',
              source: 'artistic_mod',
              fromBackground: amDraft.keywordSourceBg || undefined
            }
          ];
          refs.keywordId = id;
        }
        break;
      }
      case 'reputation': {
        // Capture absolute prior value FIRST so undo restores the true
        // pre-AM reputation even if the player edited it between applies.
        const prevRep = character.reputation;
        const v = Math.min(8, Math.max(1, amDraft.reputationValue));
        character.reputation = v;
        refs.reputationDelta = v - prevRep;
        refs.previousValues = { reputation: prevRep };
        break;
      }
      case 'gunta_plus': {
        const prevGunta = character.guntaValue;
        character.guntaValue = prevGunta + 1;
        refs.guntaDelta = 1;
        refs.previousValues = { guntaValue: prevGunta };
        break;
      }
      case 'special_coin': {
        if (amDraft.coinName) {
          const id = crypto.randomUUID();
          character.specialCoins = [
            ...character.specialCoins,
            {
              id,
              name: amDraft.coinName,
              effect: amDraft.coinEffect,
              refresh: amDraft.coinRefresh,
              refreshNotes: amDraft.coinRefreshNotes || undefined,
              held: true
            }
          ];
          refs.specialCoinId = id;
        }
        break;
      }
      case 'shadow_plus': {
        const d = Math.min(3, Math.max(1, amDraft.shadowDelta));
        const prevShadow = character.shadow;
        const prevTg = character.typeGraphPosition ?? { x: 0, y: 0 };
        const maxX = maxGraphX();
        character.shadow = prevShadow + d;
        character.typeGraphPosition = {
          x: maxX > 0 ? Math.min(maxX, prevTg.x + d) : prevTg.x + d,
          y: prevTg.y
        };
        refs.shadowDelta = d;
        refs.previousValues = {
          shadow: prevShadow,
          typeGraphPosition: { ...prevTg }
        };
        // Description carries the in-character reason text per spec.
        if (amDraft.shadowReason) {
          rec.description = amDraft.shadowReason;
        }
        break;
      }
      case 'expensive_equipment': {
        if (amDraft.equipmentName && amDraft.equipmentCost > 0) {
          const itemId = crypto.randomUUID();
          const debtId = crypto.randomUUID();
          character.inventory = [
            ...character.inventory,
            {
              id: itemId,
              name: amDraft.equipmentName,
              slots: amDraft.equipmentSlots,
              cost: amDraft.equipmentCost,
              location: amDraft.equipmentLocation,
              equipped: amDraft.equipmentLocation !== 'storage',
              stashed: amDraft.equipmentLocation === 'storage',
              isContainer: false,
              containerSlots: 0,
              notes: 'Artistic Modification — expensive equipment'
            }
          ];
          character.debts = [
            ...character.debts,
            {
              id: debtId,
              amount: amDraft.equipmentCost,
              holder: amDraft.equipmentHolder || 'Unknown creditor',
              notes: 'Artistic Modification debt'
            }
          ];
          refs.inventoryItemId = itemId;
          refs.debtId = debtId;
        }
        break;
      }
      case 'implant': {
        // Apt-only — gate is enforced in the UI; defensive check here too.
        if (character.type !== 'apt') break;
        if (amDraft.implantName || amDraft.implantEffect) {
          const id = crypto.randomUUID();
          const stackBonus =
            amDraft.implantStack && amDraft.implantStackBonus > 0
              ? [{ stack: amDraft.implantStack as Stack, bonus: amDraft.implantStackBonus }]
              : undefined;
          character.implants = [
            ...character.implants,
            {
              id,
              name: amDraft.implantName,
              bodyPart: amDraft.implantBodyPart,
              effect: amDraft.implantEffect,
              drawback: amDraft.drawback || '',
              stackBonus,
              notes: ''
            }
          ];
          refs.implantId = id;
          // refresh implant-bonus composition slot
          character = recomputeStacks(character, true);
        }
        break;
      }
      case 'off_list':
      default:
        // Free-text only — nothing mechanical to apply.
        break;
    }

    const hasEffect = Object.keys(refs).length > 0;
    const hasNotes = Boolean(rec.description) || Boolean(rec.drawback);
    rec.chosen = hasEffect || hasNotes;
    rec.appliedRefs = hasEffect ? refs : undefined;

    if (rec.chosen) {
      character.artisticMod = rec;
    } else {
      // Clear AM entirely if nothing was applied AND no notes — avoids
      // leaving a stale `chosen: true` flag on the character.
      character.artisticMod = undefined;
    }
  }

  /**
   * Reset the AM draft from the character's current `artisticMod` so a
   * Back-and-forth round trip preserves what was previously chosen. Called
   * once when the wizard reaches the AM step for the first time, and again
   * on Back-into-the-step.
   */
  function hydrateAmDraft() {
    const am = character.artisticMod;
    if (!am) {
      amDraft = freshAmDraft();
      return;
    }
    const d = freshAmDraft();
    d.kind = am.kind;
    d.description = am.description ?? '';
    d.drawback = am.drawback ?? '';
    const r = am.appliedRefs;
    if (r) {
      if (r.languageId) d.languageId = r.languageId as Language;
      if (r.keywordId) {
        const kw = character.keywords.find((k) => k.id === r.keywordId);
        if (kw) {
          d.keywordName = kw.name;
          d.keywordStack = kw.stack;
          if (kw.fromBackground) d.keywordSourceBg = kw.fromBackground;
        }
      }
      if (r.specialCoinId) {
        const c = character.specialCoins.find((x) => x.id === r.specialCoinId);
        if (c) {
          d.coinName = c.name;
          d.coinEffect = c.effect;
          d.coinRefresh = c.refresh;
          d.coinRefreshNotes = c.refreshNotes ?? '';
        }
      }
      if (r.inventoryItemId) {
        const item = character.inventory.find((i) => i.id === r.inventoryItemId);
        if (item) {
          d.equipmentName = item.name;
          d.equipmentCost = item.cost;
          d.equipmentSlots = item.slots;
          d.equipmentLocation = item.location;
        }
      }
      if (r.debtId) {
        const debt = character.debts.find((x) => x.id === r.debtId);
        if (debt) d.equipmentHolder = debt.holder;
      }
      if (r.implantId) {
        const imp = character.implants.find((i) => i.id === r.implantId);
        if (imp) {
          d.implantName = imp.name;
          d.implantBodyPart = imp.bodyPart;
          d.implantEffect = imp.effect;
          if (imp.stackBonus && imp.stackBonus[0]) {
            d.implantStack = imp.stackBonus[0].stack;
            d.implantStackBonus = imp.stackBonus[0].bonus;
          }
        }
      }
      if (r.reputationDelta !== undefined) {
        d.reputationValue = character.reputation;
      }
      if (r.shadowDelta) {
        d.shadowDelta = r.shadowDelta;
        d.shadowReason = am.description ?? '';
      }
    } else {
      // Pre-existing description-only AM (legacy or off_list) — keep the kind
      // selection but no underlying refs to reconstruct.
      d.reputationValue = character.reputation || 1;
    }
    amDraft = d;
  }

  // ===== AM picker helpers (templates) =====
  const AM_KIND_OPTS: { value: ArtisticModKind; label: string }[] = [
    { value: 'language', label: 'Add a language' },
    { value: 'extra_keyword', label: 'Extra keyword' },
    { value: 'reputation', label: 'Reputation 1-8' },
    { value: 'gunta_plus', label: 'Gunta +1' },
    { value: 'special_coin', label: 'Special Gunta coin' },
    { value: 'shadow_plus', label: 'Shadow +1-3 with reason' },
    { value: 'expensive_equipment', label: 'Expensive equipment + debt' },
    { value: 'implant', label: 'Implant (Apt only, with drawback)' },
    { value: 'off_list', label: 'Off-list (discuss with AI)' }
  ];

  const AM_REFRESH_OPTS = [
    { value: 'session', label: 'Session' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'never', label: 'Never (one-shot)' },
    { value: 'other', label: 'Other' }
  ];

  // ===== Equipment catalog for the AM "expensive equipment + debt" picker =====
  // Flattens every catalog data source into a single Select-friendly list.
  // Each entry carries the auto-fill values (cost, slots) so picking sets
  // the rest of the form. "__custom__" lets the player type a name freely.
  type AmEquipCatalogEntry = { value: string; label: string; cost: number; slots: number };
  const AM_EQUIP_CATALOG: AmEquipCatalogEntry[] = [
    { value: '__custom__', label: '— Custom item (type your own) —', cost: 0, slots: 0 },
    ...WEAPONS_DATA.map((w) => ({ value: `weapon:${w.name}`, label: `Weapon — ${w.name} (${w.cost} P)`, cost: w.cost, slots: w.slots })),
    ...ARMOR_DATA.map((a) => ({ value: `armor:${a.name}`, label: `Armor — ${a.name} (${a.cost} P)`, cost: a.cost, slots: a.slots })),
    ...GEAR_DATA.map((g) => ({ value: `gear:${g.name}`, label: `Gear — ${g.name} (${g.cost} P)`, cost: g.cost, slots: g.slots })),
    ...KITS_DATA.filter((k) => k.cost > 0).map((k) => ({
      value: `kit:${k.id}`,
      label: `Kit — ${k.name} (${k.cost} P)`,
      cost: k.cost,
      slots: k.slots
    })),
    ...VEHICLES_DATA.map((v) => ({ value: `vehicle:${v.name}`, label: `Vehicle — ${v.name} (${v.cost} P)`, cost: v.cost, slots: 0 })),
    ...PETS_DATA.map((p) => ({ value: `pet:${p.name}`, label: `Pet — ${p.name} (${p.cost} P)`, cost: p.cost, slots: 0 }))
  ];

  let amEquipCatalogPick = $state<string>('__custom__');

  function pickAmEquipCatalog(value: string) {
    amEquipCatalogPick = value;
    if (value === '__custom__') return;
    const entry = AM_EQUIP_CATALOG.find((e) => e.value === value);
    if (!entry) return;
    // Strip the "kind:" prefix to derive the bare item name.
    const bareName = value.replace(/^[^:]+:/, '');
    amDraft.equipmentName = bareName;
    amDraft.equipmentCost = entry.cost;
    amDraft.equipmentSlots = entry.slots;
  }

  const AM_BODY_PART_OPTS = [
    { value: 'head', label: 'Head' },
    { value: 'body', label: 'Body' },
    { value: 'leg', label: 'Leg' },
    { value: 'arm', label: 'Arm' },
    { value: 'hand', label: 'Hand' },
    { value: 'eye', label: 'Eye' },
    { value: 'other', label: 'Other' }
  ];

  const AM_STACK_OPTS = [{ value: '', label: '— None —' }, ...ALL_STACKS.map((s) => ({ value: s, label: STACK_LABELS[s] }))];

  /**
   * Languages available to the AM language picker — minus the ones already
   * known. EXCEPTION: include the AM-owned language so the player still sees
   * their current selection in the dropdown after Back/Next round trip
   * (otherwise the option list filters their pick out and the select renders
   * blank, inviting accidental loss).
   */
  const amAvailableLanguages = $derived.by(() => {
    const ownLang = character.artisticMod?.appliedRefs?.languageId;
    return LANGUAGES_DATA.filter((l) => !character.languages.includes(l.id) || l.id === ownLang);
  });

  /**
   * Keywords available for the AM extra-keyword picker (filtered by chosen bg,
   * minus already-known). Same exception: the AM-owned keyword stays visible
   * so the picker keeps its selection on Back/Next round trip.
   */
  const amAvailableKeywords = $derived.by(() => {
    if (!amDraft.keywordSourceBg) return [];
    const bg = BACKGROUNDS_DATA.find((b) => b.id === amDraft.keywordSourceBg);
    if (!bg) return [];
    const ownKwId = character.artisticMod?.appliedRefs?.keywordId;
    const ownKwName = ownKwId ? character.keywords.find((k) => k.id === ownKwId)?.name?.toLowerCase() : undefined;
    const known = new Set(character.keywords.filter((k) => k.id !== ownKwId).map((k) => k.name.toLowerCase()));
    return bg.keywords.filter((k) => !known.has(k.name.toLowerCase()) || k.name.toLowerCase() === ownKwName);
  });

  /** Snap to top after any step change so the new tab's content starts
   *  at the viewport top, not wherever the previous tab left scroll. */
  function scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }

  function next() {
    // If we're leaving the AM step, apply the draft to character data.
    if (STEPS[step].id === 'artistic') {
      applyArtisticMod();
    }
    step = Math.min(STEPS.length - 1, step + 1);
    // If we're entering the AM step, hydrate the draft from current state.
    if (STEPS[step].id === 'artistic') {
      hydrateAmDraft();
    }
    scrollToTop();
  }
  function back() {
    if (STEPS[step].id === 'artistic') {
      // Going back from AM also commits the choice — keeps appliedRefs in
      // sync with what's visible on the character if the player jumps to
      // earlier steps and edits unrelated fields.
      applyArtisticMod();
    }
    step = Math.max(0, step - 1);
    if (STEPS[step].id === 'artistic') {
      hydrateAmDraft();
    }
    scrollToTop();
  }

  /**
   * Direct step jump (via the breadcrumbs). Apply / hydrate around the AM
   * step. NOTE: clicking the breadcrumb for the CURRENT step is a no-op —
   * we don't re-hydrate the draft and discard in-flight form edits.
   */
  function jumpTo(i: number) {
    if (i === step) return;
    if (STEPS[step].id === 'artistic' && STEPS[i].id !== 'artistic') {
      applyArtisticMod();
    }
    step = i;
    if (STEPS[step].id === 'artistic') {
      hydrateAmDraft();
    }
    scrollToTop();
  }

  // ===== Computed allowed life-forms =====
  const allowedLfs = $derived(allowedLifeForms(pairs()));

  const TYPE_OPTS = CHARACTER_TYPES.map((t) => ({ value: t.id, label: t.label }));
  const LIFE_OPTS_ALL = LIFE_FORMS.map((l) => ({ value: l.id, label: l.label }));
  const BG_OPTS = BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }));
</script>

<svelte:head>
  <title>New character — Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-6">
  <!-- Same canonical card chrome as the view + edit page headers. <div> not
       <header> to avoid the global app.css header rule colliding in light mode. -->
  <div class="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-md shadow-black/20">
    <a href="/" class="text-sm text-cyan-400 hover:underline">← Cancel & return</a>
    <h1 class="mt-2 text-2xl font-bold text-neutral-100">Creation Wizard</h1>
    <p class="text-sm text-neutral-400">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</p>
  </div>

  <ol class="mb-6 flex flex-wrap gap-1 text-xs">
    {#each STEPS as s, i (s.id)}
      <li>
        <button
          type="button"
          onclick={() => jumpTo(i)}
          class={`rounded-full border px-2 py-0.5 transition ${
            i === step ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200' : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
          }`}
        >
          {i + 1}. {s.label}
        </button>
      </li>
    {/each}
  </ol>

  {#if STEPS[step].id === 'name'}
    <Card title="Name your character">
      <div class="space-y-3">
        <Input label="Name" bind:value={character.name} required />
        <Input label="Title (sheet header, e.g. 'The Quiet Hand')" bind:value={character.title} />
      </div>
    </Card>
  {:else if STEPS[step].id === 'type'}
    <Card title="Pick a type">
      <p class="text-sm text-neutral-400 mb-3">
        Your type sets your origo (starting Spaces / Implants / Combat) and the ability shape of your character. Switch any time during this
        step — downstream picks revalidate automatically.
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        {#each TYPES_DATA as t (t.id)}
          {@const selected = typeChosen && character.type === t.id}
          <button
            type="button"
            onclick={() => setType(t.id)}
            class={`rounded-xl border-2 p-3 text-left transition ${
              selected
                ? 'border-cyan-400 bg-cyan-900/30 shadow-md shadow-cyan-500/20'
                : 'border-neutral-700 bg-neutral-900/40 hover:border-cyan-700 hover:bg-neutral-900/70'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-neutral-100">{t.label}</p>
              {#if selected}
                <span class="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">selected</span>
              {/if}
            </div>
            <p class="text-xs italic text-neutral-400">{t.tagline}</p>
            <div class="mt-2 flex flex-wrap gap-1 text-[10px]">
              <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">Sp {t.origo.spaces}</span>
              <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">Imp {t.origo.implants}</span>
              <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">Cl {t.origo.closeStart}</span>
              <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">Rng {t.origo.rangedStart}</span>
            </div>
            <p class="mt-2 text-[10px] text-neutral-400">
              <span class="font-semibold text-neutral-300">Examples:</span>
              {t.examples.join(', ')}
            </p>
          </button>
        {/each}
      </div>
      {#if !typeChosen}
        <p class="mt-3 text-sm italic text-amber-300">No type selected — pick one to continue.</p>
      {:else}
        {@const td = getType(character.type)}
        <div class="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3 space-y-3">
          <p class="text-sm text-neutral-200">{td.description}</p>
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wide text-cyan-300">Mechanics</h4>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-xs text-neutral-300">
              {#each td.rules as r}
                <li>{r}</li>
              {/each}
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wide text-cyan-300">Spaces</h4>
            <p class="mt-1 text-xs text-neutral-300">
              <span class="font-semibold text-neutral-200">Holds:</span>
              {td.spaceContent}
            </p>
            <p class="mt-1 text-xs text-neutral-300">
              <span class="font-semibold text-neutral-200">Effect:</span>
              {td.spacesDoWhat}
            </p>
          </div>
        </div>
      {/if}
      {#if typeChosen && character.type === 'apt'}
        <p class="mt-3 text-xs italic text-neutral-500">
          Apt picks which combat stack (Close or Ranged) starts at 1 — handled on the Bonus distribution step.
        </p>
      {:else if typeChosen && character.type === 'core'}
        {@const coreTd = getType('core')}
        <h3 class="mt-4 mb-2 text-sm font-semibold text-neutral-100">Pick a deep bond</h3>
        <p class="mb-3 text-xs text-neutral-400">
          Core characters bond with one of three forces. Switching is possible at black nodes during play. Your bond shapes which formulae
          you can use on the Spaces step.
        </p>
        <div class="grid gap-2 sm:grid-cols-3">
          {#each coreTd.bonds ?? [] as b (b.id)}
            {@const selected = character.coreBond === b.id}
            <button
              type="button"
              onclick={() => {
                character.coreBond = b.id;
                revalidate();
              }}
              class={`rounded-xl border-2 p-3 text-left transition ${
                selected
                  ? 'border-cyan-400 bg-cyan-900/30 shadow-md shadow-cyan-500/20'
                  : 'border-neutral-700 bg-neutral-900/40 hover:border-cyan-700 hover:bg-neutral-900/70'
              }`}
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-semibold text-neutral-100">{b.label}</p>
                {#if selected}
                  <span class="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">selected</span>
                {/if}
              </div>
              <p class="mt-1 text-[11px] text-neutral-400">{b.description}</p>
            </button>
          {/each}
        </div>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'stacks'}
    <Card title="Stack rolls">
      <p class="text-sm text-neutral-400">
        For each primary stack, roll <strong>2d6</strong> — the app rolls them, or punch in your own physical rolls. The lowest die reads as
        a d3 (1-2→1, 3-4→2, 5-6→3). A pair (matched dice) scores <strong>0</strong> and counts toward the pair gate that decides which life-forms
        you can play.
      </p>
      {@const anyRolling = PRIMARY_STACKS.some((s) => stackRolling[s])}
      <div class="my-3 flex flex-wrap gap-2">
        <Button onclick={rollStacks} disabled={anyRolling}>Roll all stacks</Button>
      </div>

      <!-- Per-stack card. On narrow screens (mobile) the row wraps so dice
           inputs + roll button stay reachable. No <table> — old version blew
           out horizontally on iPhone widths. -->
      <ul class="space-y-2">
        {#each PRIMARY_STACKS as s}
          {@const roll = stackRolls[s]}
          {@const derived = deriveResult(roll.d1, roll.d2)}
          {@const rolling = stackRolling[s]}
          {@const d1Shown = rolling ? stackDisplay[s].d1 : roll.d1}
          {@const d2Shown = rolling ? stackDisplay[s].d2 : roll.d2}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span class="min-w-[5rem] font-semibold text-neutral-100">{STACK_LABELS[s]}</span>

              <!-- Dice inputs — fixed compact width so they always render
                   side-by-side, no overlap. -->
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="6"
                  placeholder="d6"
                  value={d1Shown ?? ''}
                  disabled={rolling}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value;
                    setDie(s, 'd1', raw === '' ? null : parseInt(raw, 10));
                  }}
                  class="w-12 rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-center text-sm text-neutral-100 placeholder-neutral-600 focus:border-cyan-600 focus:outline-none disabled:opacity-90"
                />
                <input
                  type="number"
                  min="1"
                  max="6"
                  placeholder="d6"
                  value={d2Shown ?? ''}
                  disabled={rolling}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value;
                    setDie(s, 'd2', raw === '' ? null : parseInt(raw, 10));
                  }}
                  class="w-12 rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-center text-sm text-neutral-100 placeholder-neutral-600 focus:border-cyan-600 focus:outline-none disabled:opacity-90"
                />
              </div>

              <!-- Pair indicator -->
              {#if !derived.complete}
                <span class="text-xs text-neutral-600">—</span>
              {:else if derived.isPair}
                <span class="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">PAIR</span>
              {:else}
                <span class="text-xs text-neutral-600">—</span>
              {/if}

              <!-- Derived score -->
              <span class="ml-auto flex items-center gap-2">
                <span class="text-[10px] uppercase text-neutral-500">Score</span>
                <span class="text-lg font-bold text-cyan-300 tabular-nums">
                  {#if derived.complete}{derived.result}{:else}<span class="text-neutral-600">–</span>{/if}
                </span>
                <Button variant="ghost" onclick={() => rollOnly(s)} disabled={rolling}>Roll</Button>
              </span>
            </div>
          </li>
        {/each}
      </ul>

      <p class="mt-3 text-sm text-neutral-300">
        Pairs (zero rolls): <strong>{pairs()}</strong>
      </p>
      <p class="text-xs text-neutral-500">0 → Blood or Alien · 1 → Blood only · 2 → Blood/Alien/Tank Born · 3+ → all (incl Construct).</p>
    </Card>
  {:else if STEPS[step].id === 'lifeform'}
    <Card title="Life-form">
      <p class="text-sm text-neutral-400 mb-3">
        Your <strong>life-form</strong> is the species/origin of your character — it sets stack bonuses, set/cap rules, mandatory languages,
        and special physical traits. Some life-forms are gated by your <strong>pair count</strong>
        from stack rolls (rules/18).
      </p>
      <p class="text-xs text-neutral-500 mb-3">
        Pairs rolled: <strong class="text-neutral-300">{pairs()}</strong> · Allowed:
        <strong class="text-neutral-300">{allowedLfs.map((l) => LIFE_FORMS.find((x) => x.id === l)?.label).join(', ')}</strong>
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each LIFE_FORMS_DATA as lf (lf.id)}
          {@const enabled = allowedLfs.includes(lf.id)}
          {@const selected = lifeFormChosen && character.lifeForm === lf.id}
          <button
            type="button"
            disabled={!enabled}
            onclick={() => setLifeForm(lf.id)}
            class={`rounded-xl border-2 p-3 text-left transition ${
              selected
                ? 'border-cyan-400 bg-cyan-900/30 shadow-md shadow-cyan-500/20'
                : enabled
                  ? 'border-neutral-700 bg-neutral-900/40 hover:border-cyan-700 hover:bg-neutral-900/70'
                  : 'border-neutral-800/50 bg-neutral-900/20 opacity-40 cursor-not-allowed'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-neutral-100">{lf.label}</p>
              <div class="flex items-center gap-1 shrink-0">
                <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-bold uppercase text-neutral-300">{lf.group}</span>
                {#if selected}
                  <span class="rounded-full bg-cyan-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">selected</span>
                {:else if !enabled}
                  <span class="rounded-full bg-red-700 px-2 py-0.5 text-[9px] font-bold uppercase text-white">gated</span>
                {/if}
              </div>
            </div>
            <p class="mt-1 text-[11px] italic text-neutral-400">{lf.blurb}</p>
            <p class="mt-2 text-[10px] font-medium text-emerald-300">{lf.bonusSummary}</p>
            {#if lf.notes && lf.notes.length}
              <ul class="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-neutral-400">
                {#each lf.notes.slice(0, 4) as n}
                  <li>{n}</li>
                {/each}
              </ul>
            {/if}
            {#if lf.mandatoryLanguages && lf.mandatoryLanguages.length}
              <p class="mt-1 text-[10px] text-amber-300">
                <span class="font-semibold">Mandatory language:</span>
                {lf.mandatoryLanguages.join(', ')}
              </p>
            {/if}
          </button>
        {/each}
      </div>

      {#if lifeFormChosen}
        {@const sel = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm)!}
        <div class="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3 space-y-2">
          <p class="text-sm text-neutral-200">{sel.description}</p>
          {#if sel.fictionNotes && sel.fictionNotes.length}
            <div>
              <h4 class="text-xs font-semibold uppercase tracking-wide text-cyan-300">Fiction / body</h4>
              <ul class="mt-1 list-disc space-y-1 pl-5 text-xs text-neutral-300">
                {#each sel.fictionNotes as n}
                  <li>{n}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <!-- ===== Alien sub-system (Palp + Amphibious) ===== -->
        {#if sel.rollsAlienTables}
          {@const alienInnateOpts = BASIC_FORMULAE.filter((f) => f.alien).map((f) => ({
            value: f.name,
            label: `${f.name} → ${f.alien!.name} (${f.alien!.cost} H)`
          }))}
          <div class="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 space-y-3">
            <p class="text-sm font-semibold text-amber-300">Alien details (rules/18)</p>

            {#if character.lifeForm === 'amphibious_alien'}
              <p class="text-xs text-amber-200">
                ⚠ <strong>Amphibious:</strong> needs to be underwater at least <strong>30 minutes/day</strong>
                or becomes lethargic (clean rolls only) and falls into a <strong>d3-day coma</strong>.
              </p>
            {/if}
            {#if character.lifeForm === 'palp_alien'}
              <p class="text-xs text-amber-200">
                ⚠ <strong>Palp:</strong> hair = thin palps (visible up close). Always knows Palp.
              </p>
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
                  options={[{ value: '', label: '— pick a basic formula —' }, ...alienInnateOpts]}
                  value={character.alienInnateFormula ?? ''}
                  onchange={(v) => (character.alienInnateFormula = v || undefined)}
                />
              </div>
            </div>
            <p class="text-[10px] italic text-neutral-500">Aliens also have trouble finding implants that fit + are shunned in blood high society (except the Jaded Diva archetype).</p>
          </div>
        {/if}

        <!-- ===== Construct sub-system (Droid + Holid) ===== -->
        {#if sel.group === 'construct'}
          {@const constructFormulaOpts = BASIC_FORMULAE.filter((f) => f.construct).map((f) => ({
            value: f.name,
            label: `${f.name} → ${f.construct!.name} (${f.construct!.cost} H)`
          }))}
          {@const builtIns = character.constructBuiltIns ?? []}
          {@const isDroid = character.lifeForm === 'droid'}
          <div class="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 space-y-3">
            <p class="text-sm font-semibold text-amber-300">Construct details (rules/18)</p>

            <ul class="list-disc space-y-0.5 pl-5 text-[11px] text-neutral-300">
              <li>Immune to suffocation, poison, and disease.</li>
              <li>Vulnerable to <strong>energy weapons</strong>.</li>
              <li>Must pass a <strong>Ghost roll</strong> before deliberately hurting bloods.</li>
              {#if isDroid}
                <li><strong>Droid:</strong> 2 e + 2 hours maintenance/day. Double rolls vs harm.</li>
                <li>Implants are mechanical upgrades — easy to find.</li>
              {:else}
                <li><strong>Holid:</strong> needs a holofield + 2 hours/day recompile (sleep equivalent).</li>
                <li><strong>Resistant to regular physical damage</strong> — only disturbs the forces holding it solid.</li>
                <li>Implants are software "hacks" — hard to find.</li>
              {/if}
            </ul>

            <div>
              <p class="mb-1 text-xs font-medium text-neutral-300">Construct formula adaptation (one, equivalent to alien innate)</p>
              <Select
                options={[{ value: '', label: '— pick a basic formula —' }, ...constructFormulaOpts]}
                value={character.constructFormula ?? ''}
                onchange={(v) => (character.constructFormula = v || undefined)}
              />
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <p class="text-xs font-medium text-neutral-300">Built-in tools (up to 3, one may be a weapon, total ≤ 50 P)</p>
                {#if builtIns.length < 3}
                  <Button variant="ghost" onclick={() => (character.constructBuiltIns = [...(character.constructBuiltIns ?? []), ''])}>+ Add</Button>
                {/if}
              </div>
              {#if builtIns.length === 0}
                <p class="text-[11px] italic text-neutral-500">None added yet.</p>
              {:else}
                <ul class="space-y-1">
                  {#each builtIns as bi, i (i)}
                    <li class="flex items-center gap-2">
                      <Input
                        value={bi}
                        placeholder={`Tool ${i + 1} (e.g. "Built-in lighter", "Crow-bar arm")`}
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

            <!-- Construct Inspiration prompts -->
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

            <p class="text-[10px] italic text-neutral-500">Any unilateral advantage from the construct shape must be matched by hard character data.</p>
          </div>
        {/if}
      {:else}
        <p class="mt-3 text-sm italic text-amber-300">No life-form selected — pick one to continue.</p>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'distribution'}
    {@const lf = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm)!}
    <Card title="Bonus distribution">
      <p class="text-sm text-neutral-400 mb-3">
        Assign the {lf.label} bonuses to your stacks. Final stacks below show the live total
        <strong>raw + life-form{backgroundChosen ? ' + background' : ''}</strong>{backgroundChosen
          ? ''
          : ' — background bonuses apply once you pick one on the next step.'}
      </p>

      {#if lf.pickCapStack}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">Set & cap (8) — pick one</h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each lf.capStackOptions ?? [] as s}
            {@const checked = distribution.capped === s}
            <button
              type="button"
              onclick={() => setCappedStack(checked ? undefined : (s as 'archive' | 'bulk' | 'morph'))}
              class={`rounded-full border-2 px-3 py-1 text-sm font-medium transition ${
                checked
                  ? 'border-amber-400 bg-amber-600 text-white shadow-md shadow-amber-500/30'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-200 hover:border-amber-600 hover:bg-neutral-700'
              }`}
            >
              {STACK_LABELS[s]}
            </button>
          {/each}
        </div>
        {#if distribution.capped}
          {@const appearance = tankBornAppearance(distribution.capped)}
          {#if appearance}
            <p class="mb-2 text-xs italic text-amber-300">
              ⚠ Tank Born appearance: <strong>{appearance}</strong> (rules/18 — corresponding to the {STACK_LABELS[distribution.capped]} cap).
            </p>
          {/if}
        {/if}
      {/if}

      {#if lf.plus2Count > 0}
        {@const plus2AtCap = distribution.plus2.length >= lf.plus2Count}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">
          +2 to {lf.plus2Count} stacks ({distribution.plus2.length}/{lf.plus2Count})
        </h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each PRIMARY_STACKS as s}
            {@const checked = distribution.plus2.includes(s)}
            {@const inOther = distribution.plus1.includes(s)}
            {@const setCap = isSetOrCapped(s)}
            {@const atCap = plus2AtCap && !checked}
            {@const blocked = setCap}
            <button
              type="button"
              disabled={atCap || blocked}
              title={blocked
                ? lf.pickCapStack && distribution.capped === s
                  ? 'Capped at 8 — bonus would be ignored.'
                  : 'Stack value set by life-form — bonus would be ignored.'
                : atCap
                  ? `+2 cap reached — uncheck another stack first.`
                  : inOther
                    ? 'Currently in +1 — clicking will move it to +2'
                    : ''}
              onclick={() => toggleDistributionPick(s, 'plus2')}
              class={`rounded-full border-2 px-3 py-1 text-sm font-medium transition ${
                checked
                  ? 'border-cyan-400 bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                  : blocked
                    ? 'border-neutral-800 bg-neutral-900/50 text-neutral-600 cursor-not-allowed opacity-70'
                    : atCap
                      ? 'border-red-900/40 bg-neutral-900 text-neutral-700 line-through opacity-50 cursor-not-allowed'
                      : inOther
                        ? 'border-amber-500/60 bg-amber-900/40 text-amber-200 italic'
                        : 'border-neutral-600 bg-neutral-800 text-neutral-200 hover:border-cyan-600 hover:bg-neutral-700'
              }`}
            >
              {STACK_LABELS[s]}{blocked ? ' (set/capped)' : inOther ? ' (in +1)' : ''}
            </button>
          {/each}
        </div>
      {/if}

      {#if lf.plus1Count > 0}
        {@const plus1AtCap = distribution.plus1.length >= lf.plus1Count}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">
          +1 to {lf.plus1Count} stacks ({distribution.plus1.length}/{lf.plus1Count})
        </h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each PRIMARY_STACKS as s}
            {@const checked = distribution.plus1.includes(s)}
            {@const inOther = distribution.plus2.includes(s)}
            {@const setCap = isSetOrCapped(s)}
            {@const atCap = plus1AtCap && !checked}
            {@const blocked = setCap}
            <button
              type="button"
              disabled={atCap || blocked}
              title={blocked
                ? lf.pickCapStack && distribution.capped === s
                  ? 'Capped at 8 — bonus would be ignored.'
                  : 'Stack value set by life-form — bonus would be ignored.'
                : atCap
                  ? `+1 cap reached — uncheck another stack first.`
                  : inOther
                    ? 'Currently in +2 — clicking will move it to +1'
                    : ''}
              onclick={() => toggleDistributionPick(s, 'plus1')}
              class={`rounded-full border-2 px-3 py-1 text-sm font-medium transition ${
                checked
                  ? 'border-cyan-400 bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                  : blocked
                    ? 'border-neutral-800 bg-neutral-900/50 text-neutral-600 cursor-not-allowed opacity-70'
                    : atCap
                      ? 'border-red-900/40 bg-neutral-900 text-neutral-700 line-through opacity-50 cursor-not-allowed'
                      : inOther
                        ? 'border-amber-500/60 bg-amber-900/40 text-amber-200 italic'
                        : 'border-neutral-600 bg-neutral-800 text-neutral-200 hover:border-cyan-600 hover:bg-neutral-700'
              }`}
            >
              {STACK_LABELS[s]}{blocked ? ' (set/capped)' : inOther ? ' (in +2)' : ''}
            </button>
          {/each}
        </div>
      {/if}

      {#if character.type === 'apt' || lf.combatBonusMode === 'either'}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">Combat pick — Close OR Ranged</h3>
        <div class="my-2 flex gap-2">
          <Button
            variant={distribution.combatPick === 'close' ? 'primary' : 'secondary'}
            onclick={() => (character.type === 'apt' ? pickAptCombat('close') : (distribution.combatPick = 'close'))}
          >
            Close
          </Button>
          <Button
            variant={distribution.combatPick === 'ranged' ? 'primary' : 'secondary'}
            onclick={() => (character.type === 'apt' ? pickAptCombat('ranged') : (distribution.combatPick = 'ranged'))}
          >
            Ranged
          </Button>
        </div>
      {/if}

      <h3 class="mt-4 text-sm font-semibold text-neutral-200">Current final stacks</h3>
      <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {#each PRIMARY_STACKS as s}
          {@const comp = character.stackComposition?.[s]}
          {@const parts = comp
            ? [
                { label: 'raw', value: comp.base },
                { label: 'LF', value: comp.lifeFormBonus },
                { label: 'BG', value: comp.backgroundBonus },
                { label: 'imp', value: comp.implantBonus },
                { label: 'oth', value: comp.other }
              ].filter((p) => p.value !== 0)
            : []}
          <div class="rounded-lg bg-neutral-800/50 p-2">
            <dt class="text-neutral-400">{STACK_LABELS[s]}</dt>
            <dd class="text-xl font-bold text-neutral-100">{character.stacks[s]}</dd>
            {#if parts.length > 1}
              <dd class="text-[10px] text-neutral-500 mt-0.5">
                {parts.map((p) => `${p.value > 0 ? '+' : ''}${p.value} ${p.label}`).join(' ')}
              </dd>
            {/if}
          </div>
        {/each}
        {#each ['close', 'ranged'] as const as s}
          {@const comp = character.stackComposition?.[s]}
          {@const parts = comp
            ? [
                { label: 'origo', value: comp.base },
                { label: 'LF', value: comp.lifeFormBonus },
                { label: 'BG', value: comp.backgroundBonus },
                { label: 'imp', value: comp.implantBonus },
                { label: 'oth', value: comp.other }
              ].filter((p) => p.value !== 0)
            : []}
          <div class="rounded-lg bg-neutral-800/50 p-2">
            <dt class="text-neutral-400">{s === 'close' ? 'Close' : 'Ranged'}</dt>
            <dd class="text-xl font-bold text-neutral-100">{character.stacks[s]}</dd>
            {#if parts.length > 1}
              <dd class="text-[10px] text-neutral-500 mt-0.5">
                {parts.map((p) => `${p.value > 0 ? '+' : ''}${p.value} ${p.label}`).join(' ')}
              </dd>
            {/if}
          </div>
        {/each}
      </dl>
    </Card>
  {:else if STEPS[step].id === 'background'}
    <Card title="Background">
      <p class="text-sm text-neutral-400 mb-3">
        Pick a background. Each grants combat + primary bonuses and offers six keyword choices on the next step.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each BACKGROUNDS_DATA as bg (bg.id)}
          {@const selected = backgroundChosen && character.background === bg.id}
          <button
            type="button"
            onclick={() => {
              character.background = bg.id;
              backgroundChosen = true;
              revalidate();
              recomputeFinalStacks();
            }}
            class={`rounded-xl border-2 p-3 text-left transition ${
              selected
                ? 'border-cyan-400 bg-cyan-900/30 shadow-md shadow-cyan-500/20'
                : 'border-neutral-700 bg-neutral-900/40 hover:border-cyan-700 hover:bg-neutral-900/70'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-neutral-100">{bg.label}</p>
              {#if selected}
                <span class="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Selected</span>
              {/if}
            </div>
            <p class="mt-1 text-xs italic text-neutral-400">{bg.blurb}</p>
            <p class="mt-2 text-xs font-medium text-cyan-300">{bg.bonusSummary}</p>

            <div class="mt-2 flex flex-wrap gap-1">
              {#each Object.entries(bg.primaryBonuses) as [s, v]}
                <span class="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-200 capitalize">
                  +{v}
                  {s}
                </span>
              {/each}
              {#if bg.closeBonus > 0}
                <span class="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  +{bg.closeBonus} Close
                </span>
              {/if}
              {#if bg.rangedBonus > 0}
                <span class="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  +{bg.rangedBonus} Ranged
                </span>
              {/if}
            </div>

            <p class="mt-2 text-[10px] text-neutral-500">
              <span class="font-semibold text-neutral-400">Keywords:</span>
              {bg.keywords.map((k) => k.name).join(' · ')}
            </p>
            <p class="mt-1 text-[10px] text-neutral-500">
              <span class="font-semibold text-neutral-400">Examples:</span>
              {bg.examples.slice(0, 4).join(', ')}
            </p>
          </button>
        {/each}
      </div>
      {#if backgroundChosen}
        {@const bg = BACKGROUNDS_DATA.find((b) => b.id === character.background)!}
        <div class="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3">
          <p class="text-sm text-neutral-200">{bg.description}</p>
        </div>
      {:else}
        <p class="mt-3 text-sm italic text-neutral-500">No background selected — pick one to apply its bonuses.</p>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'keywords'}
    {@const bgPicks = character.keywords.filter((k) => k.source === 'background').length}
    {@const crossPicks = character.keywords.filter((k) => k.source === 'cross').length}
    {@const bgFull = bgPicks >= 3}
    {@const crossFull = crossPicks >= 1}
    {@const bgLabel = BACKGROUNDS_DATA.find((b) => b.id === character.background)?.label ?? character.background}
    <Card title="Keywords">
      {#if !backgroundChosen}
        <p class="text-sm italic text-amber-300">
          Pick a background first — keywords are drawn from your background's list. Use <strong>Back</strong> to return to step 6.
        </p>
      {:else}
        <p class="text-sm text-neutral-400 mb-1">
          Pick <strong>3 keywords</strong> from your background ({bgLabel}) and
          <strong>1 cross-pick</strong> from a different background. Each keyword sits under <strong>one stack column</strong> — placement changes
          what it boosts. Same keyword can't be picked twice.
        </p>
        <div class="mt-2 mb-3 flex gap-3 text-xs">
          <span class={`rounded-full px-2 py-0.5 font-medium ${bgFull ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300'}`}>
            Background {bgPicks}/3
          </span>
          <span
            class={`rounded-full px-2 py-0.5 font-medium ${crossFull ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300'}`}
          >
            Cross-pick {crossPicks}/1
          </span>
        </div>

        <h3 class="mt-2 mb-2 text-sm font-semibold text-neutral-100">Background keywords — {bgLabel}</h3>
        <div class="grid gap-3">
          {#each availableKw as k (k.name)}
            {@const entry = getKeywordEntry(k.name)}
            {@const picked = pickedKwByName(k.name)}
            {@const isCrossElsewhere = picked && picked.source === 'cross'}
            {@const slotFull = !picked && bgFull}
            <div
              class={`rounded-xl border-2 p-3 transition ${
                picked && picked.source === 'background'
                  ? 'border-cyan-400 bg-cyan-900/20'
                  : isCrossElsewhere
                    ? 'border-amber-500/50 bg-amber-900/10'
                    : 'border-neutral-700 bg-neutral-900/40'
              }`}
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                  <p class="font-semibold text-neutral-100">
                    {k.name}
                    {#if picked && picked.source === 'background'}
                      <span class="ml-1 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">picked</span>
                    {:else if isCrossElsewhere}
                      <span class="ml-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                        >in cross-pick</span
                      >
                    {/if}
                  </p>
                  <p class="mt-0.5 text-xs text-neutral-400">{entry.description}</p>
                </div>
                {#if picked}
                  <button
                    type="button"
                    class="text-red-400 hover:text-red-300 text-lg leading-none"
                    onclick={() => removeKwByName(k.name)}
                    aria-label="Remove">×</button
                  >
                {/if}
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                {#each PRIMARY_STACKS as s}
                  {@const isHint = k.stackHints.includes(s)}
                  {@const slotted = picked?.stack === s && picked?.source === 'background'}
                  {@const slotNote = entry.perStack[s]}
                  {@const disabled = slotFull && !slotted}
                  <button
                    type="button"
                    {disabled}
                    title={slotNote ?? STACK_BLURBS[s]}
                    onclick={() => pickKeyword(k.name, 'background', character.background, s)}
                    class={`rounded-full border-2 px-2 py-1 text-[11px] font-medium transition ${
                      slotted
                        ? 'border-cyan-400 bg-cyan-600 text-white'
                        : isHint
                          ? 'border-cyan-500 bg-cyan-900/30 text-cyan-100 hover:bg-cyan-900/50'
                          : 'border-neutral-500 bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
                    } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    {STACK_LABELS[s]}{isHint ? ' ★' : ''}
                  </button>
                {/each}
              </div>
              {#if picked && picked.source === 'background'}
                <p class="mt-2 text-xs italic text-cyan-200">
                  <span class="font-semibold not-italic">{STACK_LABELS[picked.stack]}:</span>
                  {entry.perStack[picked.stack] ?? STACK_BLURBS[picked.stack]}
                </p>
              {/if}
            </div>
          {/each}
        </div>

        <h3 class="mt-6 mb-2 text-sm font-semibold text-neutral-100">Cross-pick — from a different background</h3>
        <div class="space-y-3">
          {#each otherBackgrounds as bg (bg.id)}
            <details
              class="rounded-xl border border-neutral-700 bg-neutral-900/40 p-3 group"
              open={character.keywords.some((k) => k.source === 'cross' && k.fromBackground === bg.id)}
            >
              <summary class="cursor-pointer text-sm font-semibold text-neutral-200 hover:text-cyan-200">
                {bg.label} <span class="text-xs text-neutral-500 font-normal">— {bg.bonusSummary}</span>
              </summary>
              <div class="mt-3 grid gap-2">
                {#each bg.keywords as k (k.name)}
                  {@const entry = getKeywordEntry(k.name)}
                  {@const picked = pickedKwByName(k.name)}
                  {@const isBgElsewhere = picked && picked.source === 'background'}
                  {@const slotFull = !picked && crossFull}
                  <div
                    class={`rounded-lg border p-2 transition ${
                      picked && picked.source === 'cross'
                        ? 'border-amber-400 bg-amber-900/20'
                        : isBgElsewhere
                          ? 'border-cyan-500/40 bg-cyan-900/10'
                          : 'border-neutral-800 bg-neutral-900/30'
                    }`}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1">
                        <p class="text-sm font-semibold text-neutral-100">
                          {k.name}
                          {#if picked && picked.source === 'cross'}
                            <span class="ml-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                              >cross-pick</span
                            >
                          {:else if isBgElsewhere}
                            <span class="ml-1 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                              >in background</span
                            >
                          {/if}
                        </p>
                        <p class="mt-0.5 text-[11px] text-neutral-400">{entry.description}</p>
                      </div>
                      {#if picked}
                        <button
                          type="button"
                          class="text-red-400 hover:text-red-300 text-lg leading-none"
                          onclick={() => removeKwByName(k.name)}
                          aria-label="Remove">×</button
                        >
                      {/if}
                    </div>
                    <div class="mt-2 flex flex-wrap gap-1">
                      {#each PRIMARY_STACKS as s}
                        {@const isHint = k.stackHints.includes(s)}
                        {@const slotted = picked?.stack === s && picked?.source === 'cross'}
                        {@const slotNote = entry.perStack[s]}
                        {@const disabled = slotFull && !slotted}
                        <button
                          type="button"
                          {disabled}
                          title={slotNote ?? STACK_BLURBS[s]}
                          onclick={() => pickKeyword(k.name, 'cross', bg.id, s)}
                          class={`rounded-full border-2 px-2 py-0.5 text-[10px] font-medium transition ${
                            slotted
                              ? 'border-amber-400 bg-amber-600 text-white'
                              : isHint
                                ? 'border-amber-500 bg-amber-900/30 text-amber-200 hover:bg-amber-900/50'
                                : 'border-neutral-500 bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
                          } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                        >
                          {STACK_LABELS[s]}{isHint ? ' ★' : ''}
                        </button>
                      {/each}
                    </div>
                    {#if picked && picked.source === 'cross'}
                      <p class="mt-2 text-xs italic text-amber-200">
                        <span class="font-semibold not-italic">{STACK_LABELS[picked.stack]}:</span>
                        {entry.perStack[picked.stack] ?? STACK_BLURBS[picked.stack]}
                      </p>
                    {/if}
                  </div>
                {/each}
              </div>
            </details>
          {/each}
        </div>

        <h3 class="mt-6 mb-2 text-sm font-semibold text-neutral-100">Your keywords</h3>
        {#if character.keywords.length === 0}
          <p class="text-sm text-neutral-500 italic">None picked yet.</p>
        {:else}
          <ul class="space-y-1 text-sm">
            {#each character.keywords as k (k.id)}
              <li
                class={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  k.source === 'background' ? 'bg-cyan-900/20 border border-cyan-800/40' : 'bg-amber-900/20 border border-amber-800/40'
                }`}
              >
                <div>
                  <span class="font-semibold text-neutral-100">{k.name}</span>
                  <span class="ml-2 text-xs text-neutral-300">under <strong>{STACK_LABELS[k.stack]}</strong></span>
                  <span
                    class={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      k.source === 'background' ? 'bg-cyan-700 text-white' : 'bg-amber-700 text-white'
                    }`}
                  >
                    {k.source === 'background' ? bgLabel : `cross — ${BACKGROUNDS_DATA.find((b) => b.id === k.fromBackground)?.label}`}
                  </span>
                </div>
                <button class="text-red-400 hover:text-red-300 text-lg leading-none" onclick={() => removeKw(k.id)} aria-label="Remove"
                  >×</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </Card>
  {:else if STEPS[step].id === 'languages'}
    {@const slots = languageSlotsAllowed()}
    {@const picked = extraLanguagesPicked()}
    {@const overPicked = picked > slots}
    {@const atCap = picked >= slots}
    {@const mandatory = mandatoryLanguageForLifeForm(character.lifeForm)}
    {@const rollDone = !!character.thirdLanguageRoll}
    {@const gotThird = character.thirdLanguageRoll === 3}
    <Card title="Languages">
      <p class="text-sm text-neutral-400 mb-3">
        Every character speaks <strong>Pidgin</strong> for free. Pick one more language as your second, then roll a d3 — only a
        <strong>3</strong>
        unlocks a third pick.
      </p>

      {@const d3Shown = rollingD3 ? displayD3 : character.thirdLanguageRoll}
      <div class="my-3 rounded-lg border border-neutral-700 bg-neutral-900/40 p-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm font-semibold text-neutral-200">Third-language roll</p>
          <div class="flex items-center gap-2">
            <Button onclick={rollThirdLanguage} disabled={rollingD3}>{rollDone ? 'Re-roll d3' : 'Roll d3'}</Button>
            <input
              type="number"
              min="1"
              max="3"
              placeholder="d3"
              value={d3Shown ?? ''}
              disabled={rollingD3}
              oninput={(e) => {
                const raw = (e.currentTarget as HTMLInputElement).value;
                const n = raw === '' ? null : Math.max(1, Math.min(3, parseInt(raw, 10) || 0));
                character.thirdLanguageRoll = n ?? undefined;
                revalidate();
              }}
              class="w-14 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center text-sm text-neutral-100 placeholder-neutral-600 focus:border-cyan-600 focus:outline-none disabled:opacity-90"
              title="Manual d3 entry (1-3)"
            />
          </div>
        </div>
        {#if rollingD3}
          <p class="mt-2 text-sm font-medium text-neutral-300">
            d3 → <strong class="text-lg tabular-nums">{d3Shown}</strong>
            · <span class="text-neutral-500 italic">rolling…</span>
          </p>
        {:else if rollDone}
          <p class={`mt-2 text-sm font-medium ${gotThird ? 'text-emerald-300' : 'text-neutral-300'}`}>
            d3 → <strong class="text-lg tabular-nums">{character.thirdLanguageRoll}</strong>
            {#if gotThird}
              · <span class="text-emerald-300">Third language unlocked! You get 2 extra picks.</span>
            {:else}
              · <span class="text-neutral-400">No third language — you get 1 extra pick.</span>
            {/if}
          </p>
        {:else}
          <p class="mt-2 text-xs italic text-neutral-500">Roll to find out if you get a third language slot.</p>
        {/if}
      </div>

      <div class="mb-3 flex flex-wrap gap-2 text-xs">
        <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
          Pidgin <span class="text-neutral-500">(free, locked)</span>
        </span>
        {#if mandatory}
          {@const mDef = LANGUAGES_DATA.find((l) => l.id === mandatory)}
          <span class="rounded-full bg-amber-900/30 px-2 py-0.5 text-amber-200">
            {mDef?.name ?? mandatory} <span class="opacity-70">(life-form locked)</span>
          </span>
        {/if}
        <span
          class={`rounded-full px-2 py-0.5 font-medium ${
            atCap && !overPicked ? 'bg-emerald-700 text-white' : overPicked ? 'bg-red-700 text-white' : 'bg-neutral-800 text-neutral-300'
          }`}
        >
          Extra picks {picked}/{slots}{overPicked ? ' — too many!' : atCap ? ' — full' : ''}
        </span>
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        {#each LANGUAGES_DATA as l (l.id)}
          {@const isPidgin = l.id === 'pidgin'}
          {@const isMandatory = l.id === mandatory}
          {@const locked = isPidgin || isMandatory}
          {@const checked = character.languages.includes(l.id) || locked}
          {@const restrictReason = !checked && !locked ? languagePickEligibility(l, character.lifeForm, gotThird, picked) : null}
          {@const disabled = locked || (atCap && !checked) || !!restrictReason}
          <button
            type="button"
            {disabled}
            onclick={() => toggleLang(l.id)}
            title={locked
              ? isPidgin
                ? 'Pidgin is universal — always known.'
                : 'Required by your life-form.'
              : restrictReason
                ? `Restricted: ${restrictReason}`
                : atCap && !checked
                  ? 'Slot cap reached — un-pick another language first.'
                  : ''}
            class={`rounded-lg border-2 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
              checked
                ? 'border-cyan-400 bg-cyan-600 text-white'
                : restrictReason
                  ? 'border-red-900/40 bg-neutral-900 text-neutral-200 opacity-40 cursor-not-allowed'
                  : disabled
                    ? 'border-neutral-700 bg-neutral-900 text-neutral-200 opacity-40 cursor-not-allowed'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-cyan-500'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold">{l.name}</p>
              <div class="flex flex-wrap items-center justify-end gap-1">
                {#if checked}
                  <span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-700">picked</span>
                {/if}
                {#if isPidgin}
                  <span class={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${checked ? 'bg-white/25 text-white' : 'bg-neutral-700 text-white'}`}>free</span>
                {:else if isMandatory}
                  <span class={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${checked ? 'bg-white/25 text-white' : 'bg-amber-700 text-white'}`}>required</span>
                {:else if restrictReason}
                  <span class="rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">restricted</span>
                {/if}
              </div>
            </div>
            <p class={`mt-1 text-[11px] ${checked ? 'text-cyan-50' : 'text-neutral-400'}`}>
              <span class={`font-semibold ${checked ? 'text-white' : 'text-neutral-300'}`}>{l.family}.</span>
              {l.description}
            </p>
            {#if l.note}
              <p class={`mt-1 text-[10px] italic ${checked ? 'text-amber-100' : 'text-amber-300'}`}>Note: {l.note}</p>
            {/if}
            {#if restrictReason}
              <p class="mt-1 text-[10px] font-medium text-red-300">
                Blocked: {restrictReason}
              </p>
            {/if}
            {#if l.sampleNames && l.sampleNames.length}
              <p class={`mt-1 text-[10px] italic ${checked ? 'text-cyan-100' : 'text-neutral-500'}`}>
                Example names: {l.sampleNames.join(', ')}
              </p>
            {/if}
          </button>
        {/each}
      </div>
    </Card>
  {:else if STEPS[step].id === 'spaces'}
    {@const spaceCap = character.origo.spaces}
    <Card title="Spaces (type-specific)">
      {#if character.type === 'apt'}
        {@const aptSpaces = character.spaces.filter((s) => s.kind !== 'formula' && s.kind !== 'bested_enemy')}
        {@const atCap = aptSpaces.length >= spaceCap}
        <p class="text-sm text-neutral-400 mb-2">
          Apt characters hold one space at origo. Fill it with an
          <strong>equipment</strong>, <strong>master</strong>,
          <strong>place</strong>, or <strong>pet</strong> the character has mastered — once per 24 hours, when an action relates to the space
          content, treat the relevant stack as one scale higher.
        </p>
        <p class="mb-3 text-xs text-neutral-500">
          You can fill this now or skip and fill it in play. Slots:
          <strong>{aptSpaces.length}</strong> / {spaceCap}.
        </p>

        {#if aptSpaces.length === 0}
          <div class="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-3 text-sm italic text-neutral-500">
            No spaces filled. Empty is fine — you can fill it later.
          </div>
        {:else}
          <ul class="space-y-3">
            {#each aptSpaces as s (s.id)}
              {@const form = aptSpaceForm[s.id] ?? { catalog: '', alias: '' }}
              <li class="rounded-lg border border-neutral-700 bg-neutral-900/40 p-3 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex flex-wrap gap-1">
                    {#each ['equipment', 'master', 'place', 'pet'] as const as k}
                      <button
                        type="button"
                        onclick={() => updateAptSpace(s.id, { kind: k })}
                        class={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                          s.kind === k
                            ? 'border-cyan-400 bg-cyan-600 text-white'
                            : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}>{k}</button
                      >
                    {/each}
                  </div>
                  <button class="text-red-400 hover:text-red-300 text-lg leading-none" onclick={() => removeSpace(s.id)} aria-label="Remove"
                    >×</button
                  >
                </div>

                {#if s.kind === 'equipment'}
                  <Select
                    label="Pick from catalog"
                    options={APT_EQUIP_OPTIONS}
                    value={form.catalog}
                    onchange={(v) => setSpaceCatalog(s.id, v)}
                  />
                  <Input
                    label={'Cool name (alias) — e.g. "Last Chance"'}
                    value={form.alias}
                    placeholder="optional"
                    onchange={(v: string) => setSpaceAlias(s.id, v)}
                  />
                  <Input
                    label="Final display name"
                    value={s.name}
                    placeholder="Picked item appears here, or type a custom name"
                    onchange={(v: string) => updateAptSpace(s.id, { name: v })}
                  />
                  {#if form.catalog && form.catalog !== 'custom'}
                    <p class="text-[10px] italic text-emerald-300">→ also added to your character's equipment list (next step).</p>
                  {/if}
                {:else if s.kind === 'pet'}
                  <Select
                    label="Pick from catalog"
                    options={APT_PET_OPTIONS}
                    value={form.catalog}
                    onchange={(v) => setSpacePetCatalog(s.id, v)}
                  />
                  <Input
                    label={'Cool name (alias) — e.g. "Stomper"'}
                    value={form.alias}
                    placeholder="optional"
                    onchange={(v: string) => setSpacePetAlias(s.id, v)}
                  />
                  <Input
                    label="Final display name"
                    value={s.name}
                    placeholder="Picked pet appears here, or type a custom name"
                    onchange={(v: string) => updateAptSpace(s.id, { name: v })}
                  />
                  {#if form.catalog && form.catalog !== 'custom'}
                    <p class="text-[10px] italic text-emerald-300">→ also added to your character's pets list.</p>
                  {/if}
                {:else}
                  <Input
                    label={s.kind === 'master' ? 'Master name' : 'Place name'}
                    value={s.name}
                    placeholder={s.kind === 'master' ? 'Master Sho the bladesmith' : 'Cradle Lower Bath District'}
                    onchange={(v: string) => updateAptSpace(s.id, { name: v })}
                  />
                {/if}

                <Input
                  label="Boost effect (which stack + when it applies)"
                  value={s.effect}
                  placeholder={'e.g. "Boost Ranged 1/24h when using this"'}
                  onchange={(v: string) => updateAptSpace(s.id, { effect: v })}
                />
                <Input
                  label="Notes (optional)"
                  value={s.notes ?? ''}
                  placeholder="Drawbacks, fluff, story hooks…"
                  onchange={(v: string) => updateAptSpace(s.id, { notes: v })}
                />
              </li>
            {/each}
          </ul>
        {/if}

        {#if !atCap}
          <div class="mt-3">
            <Button onclick={addAptSpace}>+ Add space content</Button>
          </div>
        {:else}
          <p class="mt-3 text-xs italic text-neutral-500">Slot cap reached.</p>
        {/if}
      {:else if character.type === 'core'}
        {@const coreFormulae = character.formulae}
        {@const atCap = coreFormulae.length >= spaceCap * 2}
        {@const subspaceUnlocked = character.coreBond === 'subspace_nanites'}
        <p class="text-sm text-neutral-400 mb-2">
          Core characters hold one space at origo, with both an
          <strong>active</strong> and an <strong>inactive</strong> formula slot. Switching active in play takes a long turn of
          concentration. You may pick up to <strong>{spaceCap * 2}</strong> formulae ({spaceCap} space × 2 slots).
        </p>
        <p class="mb-3 text-xs text-neutral-500">
          Bond: <strong class="text-neutral-300">{character.coreBond ?? '— not picked —'}</strong>
          · Picked: <strong>{coreFormulae.length}</strong> / {spaceCap * 2}
        </p>

        <div class="mt-3 flex items-center justify-between gap-3 mb-2">
          <h3 class="text-sm font-semibold text-neutral-100">Basic formulae</h3>
          <input
            type="search"
            placeholder="Filter…"
            bind:value={basicFormulaFilter}
            class="w-40 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-600 focus:outline-none"
          />
        </div>
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {#each BASIC_FORMULAE.filter((f) => !basicFormulaFilter || f.name
                .toLowerCase()
                .includes(basicFormulaFilter.toLowerCase()) || f.description
                .toLowerCase()
                .includes(basicFormulaFilter.toLowerCase())) as f (f.id)}
            {@const already = coreFormulae.some((p) => p.name === f.name)}
            {@const picked = coreFormulae.find((p) => p.name === f.name)}
            <div
              class={`relative rounded-lg border p-2 text-xs transition ${
                already
                  ? picked?.active
                    ? 'border-cyan-400 bg-cyan-900/20'
                    : 'border-neutral-600 bg-neutral-900/40'
                  : 'border-neutral-700 bg-neutral-900/30'
              }`}
            >
              <div class="mb-1 flex items-start justify-between gap-2">
                <p class="font-semibold text-neutral-100 leading-tight flex-1 min-w-0">
                  {f.name}
                  <span class="ml-1 whitespace-nowrap text-[10px] font-medium text-neutral-400">{f.formulaCost} H</span>
                </p>
                {#if already}
                  <div class="flex items-center gap-1 shrink-0">
                    {#if picked?.active}
                      <span class="rounded-full bg-cyan-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">active</span>
                    {:else}
                      <button
                        type="button"
                        title="Make active"
                        onclick={() => picked && setActiveFormula(picked.id)}
                        class="rounded-full border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[9px] font-medium text-neutral-300 hover:bg-neutral-700"
                        >★</button
                      >
                    {/if}
                    <button
                      class="text-red-400 hover:text-red-300 text-base leading-none"
                      onclick={() => picked && removeFormula(picked.id)}
                      aria-label="Remove">×</button
                    >
                  </div>
                {:else}
                  <button
                    type="button"
                    disabled={atCap}
                    onclick={() => addCoreFormula(f.id)}
                    class={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                      atCap
                        ? 'border-neutral-800 bg-neutral-900 text-neutral-700 cursor-not-allowed'
                        : 'border-cyan-600 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-900/50'
                    }`}>+ Pick</button
                  >
                {/if}
              </div>
              <p class="text-[10px] leading-snug text-neutral-400">{f.description}</p>
            </div>
          {/each}
        </div>

        <div class="mt-5 flex items-center justify-between gap-3 mb-2">
          <h3 class="text-sm font-semibold text-neutral-100">
            Subspace formulae
            {#if !subspaceUnlocked}
              <span class="ml-1 rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">locked</span>
            {/if}
          </h3>
          <input
            type="search"
            placeholder="Filter…"
            bind:value={subspaceFormulaFilter}
            disabled={!subspaceUnlocked}
            class="w-40 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-600 focus:outline-none disabled:opacity-50"
          />
        </div>
        {#if !subspaceUnlocked}
          <p class="mb-2 text-xs italic text-amber-300">
            Subspace formulae require the <strong>Subspace Nanites</strong>
            bond — change your bond on the Type step to unlock these.
          </p>
        {/if}
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {#each SUBSPACE_FORMULAE.filter((f) => !subspaceFormulaFilter || f.name
                .toLowerCase()
                .includes(subspaceFormulaFilter.toLowerCase()) || f.description
                .toLowerCase()
                .includes(subspaceFormulaFilter.toLowerCase())) as f (f.id)}
            {@const already = coreFormulae.some((p) => p.name === f.name)}
            {@const picked = coreFormulae.find((p) => p.name === f.name)}
            <div
              class={`relative rounded-lg border p-2 text-xs transition ${
                !subspaceUnlocked
                  ? 'border-neutral-800 bg-neutral-900/20 opacity-60'
                  : already
                    ? picked?.active
                      ? 'border-cyan-400 bg-cyan-900/20'
                      : 'border-neutral-600 bg-neutral-900/40'
                    : 'border-neutral-700 bg-neutral-900/30'
              }`}
            >
              <div class="mb-1 flex items-start justify-between gap-2">
                <p class="font-semibold text-neutral-100 leading-tight flex-1 min-w-0">
                  {f.name}
                  <span class="ml-1 whitespace-nowrap text-[10px] font-medium text-neutral-400">{f.bondedCost} H</span>
                </p>
                {#if already}
                  <div class="flex items-center gap-1 shrink-0">
                    {#if picked?.active}
                      <span class="rounded-full bg-cyan-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">active</span>
                    {:else}
                      <button
                        type="button"
                        title="Make active"
                        onclick={() => picked && setActiveFormula(picked.id)}
                        class="rounded-full border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[9px] font-medium text-neutral-300 hover:bg-neutral-700"
                        >★</button
                      >
                    {/if}
                    <button
                      class="text-red-400 hover:text-red-300 text-base leading-none"
                      onclick={() => picked && removeFormula(picked.id)}
                      aria-label="Remove">×</button
                    >
                  </div>
                {:else}
                  <button
                    type="button"
                    disabled={!subspaceUnlocked || atCap}
                    onclick={() => addSubspaceFormula(f.id)}
                    class={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                      !subspaceUnlocked || atCap
                        ? 'border-neutral-800 bg-neutral-900 text-neutral-700 cursor-not-allowed'
                        : 'border-cyan-600 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-900/50'
                    }`}>+ Pick</button
                  >
                {/if}
              </div>
              <p class="text-[10px] leading-snug text-neutral-400">{f.description}</p>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-neutral-400 mb-2">
          Prime characters hold one space at origo. It fills with
          <strong>bested-enemy memories</strong> during play — single-handed defeats only. When invoked (1/24h), treat a stack as if it were 9,
          raise damage one step, or roll Bulk vs harm instead of clean.
        </p>
        <div class="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-3 text-sm italic text-neutral-500">
          {spaceCap} space slot · empty at character generation, fills in play.
        </div>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'equipment'}
    {@const freeUsed = freePicksUsed()}
    {@const freeFull = freeUsed >= 5}
    <Card title="Starter funds">
      <p class="text-sm text-neutral-400 mb-2">
        Roll d6 for starter Parts (per life-form table). You can re-roll, type the d6 result manually, or override the Parts amount
        directly.
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <div>
          <p class="block text-xs font-medium text-neutral-400 mb-1">d6 roll</p>
          <div class="flex items-center gap-2">
            <Button onclick={rollFunds} disabled={rollingFunds}>Roll</Button>
            <input
              type="number"
              min="1"
              max="6"
              value={rollingFunds ? (displayFundsD6 ?? '') : (character.startingFundsRoll ?? '')}
              disabled={rollingFunds}
              oninput={(e) => setFundsRoll(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
              class="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center text-neutral-100 focus:border-cyan-600 focus:outline-none disabled:opacity-90"
            />
          </div>
        </div>
        <div>
          <p class="block text-xs font-medium text-neutral-400 mb-1">Starting Parts (auto from d6, or override)</p>
          <input
            type="number"
            min="0"
            value={character.startingFunds ?? 0}
            oninput={(e) => setFundsParts(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
            class="w-24 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 focus:border-cyan-600 focus:outline-none"
          />
        </div>
        <div>
          <p class="block text-xs font-medium text-neutral-400 mb-1">Cash on hand</p>
          <p class={`mt-1 text-xl font-bold ${character.purse.parts < 0 ? 'text-red-400' : 'text-neutral-100'}`}>
            {character.purse.parts} P
          </p>
        </div>
      </div>
    </Card>

    <Card title="Starter equipment">
      <p class="text-sm text-neutral-400 mb-2">
        Pick up to <strong>5 free items</strong> (each ≤ 100 P) AND buy more with your starting Parts. Items added here flow into your character
        sheet's weapons, armor, inventory, and pet records.
      </p>
      <div class="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span class={`rounded-full px-2 py-0.5 font-medium ${freeFull ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300'}`}>
          Free picks {freeUsed}/5
        </span>
        <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
          Cash: <strong class="text-neutral-100">{character.purse.parts} P</strong>
        </span>
      </div>

      <div class="mb-2 flex flex-wrap gap-1">
        {#each [{ id: 'gear', label: 'Gear' }, { id: 'kit', label: 'Kits' }, { id: 'weapon', label: 'Weapons' }, { id: 'armor', label: 'Armor' }, { id: 'vehicle', label: 'Vehicles' }, { id: 'pet', label: 'Pets' }] as const as t}
          <button
            type="button"
            onclick={() => (equipTab = t.id)}
            class={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              equipTab === t.id
                ? 'border-cyan-400 bg-cyan-600 text-white'
                : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}>{t.label}</button
          >
        {/each}
      </div>
      <input
        type="search"
        placeholder="Filter…"
        bind:value={equipFilter}
        class="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-600 focus:outline-none"
      />

      {@const catalog =
        equipTab === 'weapon'
          ? WEAPONS_DATA.filter((w) => w.cost > 0).map((w) => ({
              id: w.id,
              name: w.name,
              cost: w.cost,
              slots: w.slots,
              extra: `${w.damage} ${w.damageType}, ${w.range}`,
              warning: weaponWarningForType(w, character.type)
            }))
          : equipTab === 'armor'
            ? ARMOR_DATA.filter((a) => a.cost > 0).map((a) => ({
                id: a.id,
                name: a.name,
                cost: a.cost,
                slots: a.slots,
                extra: a.strength ? `resists ${a.strength}` : '',
                warning: armorWarningForType(a, character.type)
              }))
            : equipTab === 'gear'
              ? GEAR_DATA.filter((g) => g.cost > 0).map((g) => ({
                  id: g.id,
                  name: g.name,
                  cost: g.cost,
                  slots: g.slots,
                  extra: g.energy ?? g.notes ?? '',
                  warning: null as string | null
                }))
              : equipTab === 'kit'
                ? KITS_DATA.filter((k) => k.cost > 0).map((k) => ({
                    id: k.id,
                    name: k.id === 'M' ? 'Maker' : `${k.name} Kit (${k.id})`,
                    cost: k.cost,
                    slots: k.slots,
                    extra: k.buildableWithKit ? `build with kit ${k.buildableWithKit}` : (k.notes ?? ''),
                    warning: null as string | null
                  }))
                : equipTab === 'vehicle'
                  ? VEHICLES_DATA.filter((v) => v.cost > 0).map((v) => ({
                      id: v.id,
                      name: v.name,
                      cost: v.cost,
                      slots: 0,
                      extra: `${v.use}${v.energyPerDay > 0 ? `, ${v.energyPerDay} e/day` : ''}`,
                      warning: null as string | null
                    }))
                  : PETS_DATA.filter((p) => p.cost > 0).map((p) => ({
                      id: p.id,
                      name: p.name,
                      cost: p.cost,
                      slots: 0,
                      extra: `upkeep ${p.upkeepPerWeek}/wk`,
                      warning: null as string | null
                    }))}
      {@const filtered = catalog.filter((c) => !equipFilter || c.name.toLowerCase().includes(equipFilter.toLowerCase()))}

      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-96 overflow-y-auto">
        {#each filtered as item (item.id)}
          {@const tooPricey = !isFreeEligible(item.cost)}
          {@const cantAfford = character.purse.parts < item.cost}
          <div
            class={`rounded-lg border p-2 text-xs ${item.warning ? 'border-amber-700/60 bg-amber-950/20' : 'border-neutral-700 bg-neutral-900/40'}`}
          >
            <p class="font-semibold text-neutral-100">
              {item.name}
              <span class="ml-1 text-[10px] font-medium text-neutral-400"
                >{item.cost} P · {item.slots} slot{item.slots === 1 ? '' : 's'}</span
              >
            </p>
            {#if item.extra}<p class="mt-1 text-[10px] text-neutral-400">{item.extra}</p>{/if}
            {#if item.warning}
              <p class="mt-1 text-[10px] font-medium text-amber-300">⚠ {item.warning}</p>
            {/if}
            <div class="mt-2 flex gap-1">
              <button
                type="button"
                disabled={freeFull || tooPricey}
                title={tooPricey ? 'Too expensive — over 100 P' : freeFull ? 'Free cap reached' : 'Add as a free starter pick'}
                onclick={() => addStarterItem(equipTab, item.id, 'free')}
                class={`flex-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                  freeFull || tooPricey
                    ? 'border-neutral-800 bg-neutral-900 text-neutral-700 cursor-not-allowed'
                    : 'border-emerald-600 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50'
                }`}>+ Free</button
              >
              <button
                type="button"
                disabled={cantAfford}
                title={cantAfford ? `Not enough Parts (${item.cost} P needed)` : 'Buy with starting Parts'}
                onclick={() => addStarterItem(equipTab, item.id, 'buy')}
                class={`flex-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                  cantAfford
                    ? 'border-neutral-800 bg-neutral-900 text-neutral-700 cursor-not-allowed'
                    : 'border-cyan-600 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-900/50'
                }`}>+ Buy ({item.cost} P)</button
              >
            </div>
          </div>
        {/each}
        {#if filtered.length === 0}
          <p class="col-span-full text-sm italic text-neutral-500">No matches.</p>
        {/if}
      </div>
    </Card>

    <Card title="Your starter loadout">
      {@const allItems = [
        ...character.weapons.map((w) => ({
          source: 'weapon' as const,
          id: w.id,
          name: w.name,
          cost: w.cost ?? 0,
          free: !!(w as any).freePick
        })),
        ...character.armor.map((a) => ({
          source: 'armor' as const,
          id: a.id,
          name: a.name,
          cost: a.cost ?? 0,
          free: !!(a as any).freePick
        })),
        ...character.inventory.map((i) => ({ source: 'gear' as const, id: i.id, name: i.name, cost: i.cost ?? 0, free: !!i.freePick })),
        ...character.pets.map((p) => ({ source: 'pet' as const, id: p.id, name: p.name, cost: 0, free: false }))
      ]}
      {#if allItems.length === 0}
        <p class="text-sm italic text-neutral-500">Nothing picked yet.</p>
      {:else}
        <ul class="space-y-1">
          {#each allItems as it (`${it.source}-${it.id}`)}
            <li class="flex items-center justify-between gap-2 rounded-lg bg-neutral-900/40 px-3 py-1.5 text-sm">
              <div class="flex-1 min-w-0">
                <span class="font-medium text-neutral-100">{it.name}</span>
                <span class="ml-2 text-[10px] text-neutral-500">{it.source}</span>
                {#if it.free}
                  <span class="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-bold uppercase text-white">free</span>
                {:else if it.cost > 0}
                  <span class="ml-2 text-[10px] text-neutral-400">{it.cost} P</span>
                {/if}
              </div>
              <button
                class="text-red-400 hover:text-red-300 text-lg leading-none"
                onclick={() => removeStarterItem(it.source, it.id)}
                aria-label="Remove">×</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'identity'}
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
      </div>
    </Card>
  {:else if STEPS[step].id === 'artistic'}
    <Card title="Artistic Modification">
      <p class="text-sm text-neutral-400 mb-3">
        Pick one mechanical modification. The wired effect is applied to your character on Next / Save. You can revisit this step to change
        your pick — the previous effect is undone first.
      </p>
      <Select
        label="Artistic Mod kind"
        options={AM_KIND_OPTS}
        value={amDraft.kind}
        onchange={(v) => (amDraft.kind = v as ArtisticModKind)}
      />

      <!-- ===== Per-kind sub-form ===== -->
      <div class="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
        {#if amDraft.kind === 'language'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Add a language</h3>
          <p class="mb-2 text-xs text-neutral-500">Picks one language not already known. Already-known languages are filtered out.</p>
          {#if amAvailableLanguages.length === 0}
            <p class="text-sm text-amber-300">You already know every language in the catalogue — nothing to add.</p>
          {:else}
            <Select
              label="Language"
              placeholder="Select a language..."
              options={[
                { value: '', label: '— pick one —' },
                ...amAvailableLanguages.map((l) => ({ value: l.id, label: `${l.name} — ${l.family}` }))
              ]}
              value={amDraft.languageId}
              onchange={(v) => (amDraft.languageId = v as Language | '')}
            />
          {/if}
          <div class="mt-3">
            <TextArea label="Notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'extra_keyword'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Extra keyword</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Pick any background's keyword list, then choose one keyword not already known + a stack to attach it to.
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <Select
              label="From background"
              placeholder="Pick background..."
              options={[{ value: '', label: '— pick background —' }, ...BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }))]}
              value={amDraft.keywordSourceBg}
              onchange={(v) => {
                amDraft.keywordSourceBg = v as Background | '';
                amDraft.keywordName = '';
              }}
            />
            {#if amDraft.keywordSourceBg && amAvailableKeywords.length > 0}
              <Select
                label="Keyword"
                placeholder="Pick keyword..."
                options={[
                  { value: '', label: '— pick keyword —' },
                  ...amAvailableKeywords.map((k) => ({
                    value: k.name,
                    label: `${k.name} (${k.stackHints.join(', ')})`
                  }))
                ]}
                value={amDraft.keywordName}
                onchange={(v) => {
                  amDraft.keywordName = v;
                  // Default the stack to the first hint of the chosen keyword.
                  const kw = amAvailableKeywords.find((k) => k.name === v);
                  if (kw && kw.stackHints[0]) amDraft.keywordStack = kw.stackHints[0];
                }}
              />
            {:else if amDraft.keywordSourceBg}
              <p class="text-sm text-amber-300">
                No keywords left in {amDraft.keywordSourceBg} you don't already know.
              </p>
            {/if}
            <Select
              label="Place under stack"
              options={ALL_STACKS.map((s) => ({ value: s, label: STACK_LABELS[s] }))}
              value={amDraft.keywordStack}
              onchange={(v) => (amDraft.keywordStack = v as Stack)}
            />
          </div>
          <div class="mt-3">
            <TextArea label="Notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'reputation'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Set reputation (1-8)</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Sets <code>character.reputation</code> directly. Acts as the floor / starting value.
          </p>
          <NumberInput label="Reputation" value={amDraft.reputationValue} min={1} max={8} onchange={(v) => (amDraft.reputationValue = v)} />
          <div class="mt-3">
            <TextArea label="Reason / notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'gunta_plus'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Gunta +1</h3>
          <p class="text-sm text-neutral-300">
            Will set <code>guntaValue</code> from <strong>{character.guntaValue}</strong> to
            <strong>{character.guntaValue + 1}</strong>.
          </p>
          <div class="mt-3">
            <TextArea label="Reason / notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'special_coin'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Special Gunta coin</h3>
          <div class="grid gap-2 sm:grid-cols-2">
            <Input label="Coin name" bind:value={amDraft.coinName} />
            <Select
              label="Refresh"
              options={AM_REFRESH_OPTS}
              value={amDraft.coinRefresh}
              onchange={(v) => (amDraft.coinRefresh = v as AmDraft['coinRefresh'])}
            />
          </div>
          <div class="mt-2">
            <TextArea label="Effect" rows={2} bind:value={amDraft.coinEffect} />
          </div>
          {#if amDraft.coinRefresh === 'other'}
            <div class="mt-2">
              <Input label="Refresh notes" bind:value={amDraft.coinRefreshNotes} />
            </div>
          {/if}
          <div class="mt-3">
            <TextArea label="Notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'shadow_plus'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Shadow +1-3 with reason</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Increments <code>shadow</code> AND <code>typeGraphPosition.x</code> by the chosen amount. The reason text is recorded as the AM description.
          </p>
          <NumberInput label="Shadow delta" value={amDraft.shadowDelta} min={1} max={3} onchange={(v) => (amDraft.shadowDelta = v)} />
          <div class="mt-2">
            <TextArea label="Reason" rows={3} bind:value={amDraft.shadowReason} />
          </div>
        {:else if amDraft.kind === 'expensive_equipment'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Expensive equipment + debt</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Adds an inventory item AND a matching debt for the same amount. Pick the slot location now (or default to Storage and adjust in
            the inventory editor later).
          </p>
          <div class="mb-2">
            <Select
              label="Pick from catalog"
              options={AM_EQUIP_CATALOG}
              value={amEquipCatalogPick}
              onchange={(v) => pickAmEquipCatalog(v as string)}
            />
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <Input label="Item name" bind:value={amDraft.equipmentName} />
            <NumberInput label="Cost (P)" value={amDraft.equipmentCost} min={0} onchange={(v) => (amDraft.equipmentCost = v)} />
          </div>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <NumberInput label="Slots" value={amDraft.equipmentSlots} min={0} step={0.5} onchange={(v) => (amDraft.equipmentSlots = v)} />
            <Select
              label="Location"
              options={[
                { value: 'storage', label: 'Storage (off-character)' },
                { value: 'worn', label: 'Worn (slots 1-9)' },
                { value: 'slot10', label: 'Slot 10' },
                { value: 'backpack', label: 'In backpack' },
                { value: 'no_slot', label: 'No-slot / cosmetic' },
                { value: 'mission', label: 'Given by mission' },
                { value: 'other', label: 'Other' }
              ]}
              value={amDraft.equipmentLocation}
              onchange={(v) => (amDraft.equipmentLocation = v as AmDraft['equipmentLocation'])}
            />
          </div>
          <div class="mt-2">
            <Input label="Debt holder (e.g. 'A loan shark')" bind:value={amDraft.equipmentHolder} />
          </div>
          {#if amDraft.equipmentName && amDraft.equipmentCost > 0}
            <p class="mt-2 text-xs text-neutral-400">
              Will add <strong>{amDraft.equipmentName}</strong> ({amDraft.equipmentCost} P,
              {amDraft.equipmentSlots} slot{amDraft.equipmentSlots === 1 ? '' : 's'},
              {amDraft.equipmentLocation}) to inventory AND a <strong>{amDraft.equipmentCost} P</strong> debt to
              <strong>{amDraft.equipmentHolder || 'Unknown creditor'}</strong>.
            </p>
          {/if}
          <div class="mt-3">
            <TextArea label="Notes (optional)" rows={2} bind:value={amDraft.description} />
          </div>
        {:else if amDraft.kind === 'implant'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Implant (Apt only)</h3>
          {#if character.type !== 'apt'}
            <p class="text-sm text-amber-300">
              Implants via Artistic Modification are restricted to Apt characters. Pick another AM kind, or change your character type on
              Step 2.
            </p>
          {:else}
            <p class="mb-2 text-xs text-neutral-500">Drawback is required for powerful implants.</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <Input label="Implant name" bind:value={amDraft.implantName} />
              <Select
                label="Body part"
                options={AM_BODY_PART_OPTS}
                value={amDraft.implantBodyPart}
                onchange={(v) => (amDraft.implantBodyPart = v as AmDraft['implantBodyPart'])}
              />
            </div>
            <div class="mt-2">
              <TextArea label="Effect (e.g. '+2 Ranged via heads-up display')" rows={2} bind:value={amDraft.implantEffect} />
            </div>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              <Select
                label="Stack bonus (optional)"
                options={AM_STACK_OPTS}
                value={amDraft.implantStack}
                onchange={(v) => (amDraft.implantStack = v as Stack | '')}
              />
              {#if amDraft.implantStack}
                <NumberInput
                  label="Bonus amount"
                  value={amDraft.implantStackBonus}
                  min={0}
                  max={4}
                  onchange={(v) => (amDraft.implantStackBonus = v)}
                />
              {/if}
            </div>
            <div class="mt-2">
              <TextArea label="Drawback (REQUIRED for powerful implants)" rows={2} bind:value={amDraft.drawback} />
            </div>
          {/if}
        {:else}
          <!-- off_list -->
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Off-list</h3>
          <p class="mb-2 text-xs text-neutral-500">Discuss with the AI / GM — describe the bespoke modification and any drawback.</p>
          <TextArea label="Description" rows={3} bind:value={amDraft.description} />
          <div class="mt-2">
            <TextArea label="Drawback (if any)" rows={2} bind:value={amDraft.drawback} />
          </div>
        {/if}
      </div>
    </Card>
  {:else if STEPS[step].id === 'hooks'}
    <Card title="Backstory hooks (light, deliberately partial)">
      <p class="text-sm text-neutral-400 mb-2">Add up to a few hooks. Mark them open if unresolved.</p>
      {#each character.hooks as h (h.id)}
        <div class="mb-3 rounded-lg border border-neutral-800 p-3">
          <Input bind:value={h.title} placeholder="Title" />
          <div class="mt-2"><TextArea bind:value={h.body} rows={3} placeholder="Body" /></div>
          <div class="mt-2 flex items-center justify-between">
            <Toggle label="Open thread" bind:checked={h.open} />
            <Button variant="ghost" onclick={() => (character.hooks = character.hooks.filter((x) => x.id !== h.id))}>Remove</Button>
          </div>
        </div>
      {/each}
      <Button
        variant="secondary"
        onclick={() => (character.hooks = [...character.hooks, { id: crypto.randomUUID(), title: '', body: '', open: true }])}
      >
        Add hook
      </Button>
    </Card>
  {:else if STEPS[step].id === 'review'}
    <Card title="Review">
      <p class="mb-3 text-sm text-neutral-400">Use the full editor below to fine-tune any field before saving.</p>
      <CharacterEditForm bind:character />
    </Card>
    {#if saveError}
      <p class="mt-3 text-sm text-red-400">{saveError}</p>
    {/if}
  {/if}

  <div class="mt-6 flex items-center justify-between">
    {#if step > 0}
      <Button variant="ghost" onclick={back}>Back</Button>
    {:else}
      <span></span>
    {/if}
    {#if step < STEPS.length - 1}
      <Button
        onclick={next}
        disabled={((STEPS[step].id === 'background' || STEPS[step].id === 'keywords') && !backgroundChosen) ||
          (STEPS[step].id === 'type' && (!typeChosen || (character.type === 'core' && !character.coreBond))) ||
          (STEPS[step].id === 'lifeform' && !lifeFormChosen)}>Next</Button
      >
    {:else}
      <Button onclick={finish} loading={saving}>Save character</Button>
    {/if}
  </div>
</main>

<style>
  /* Roll buttons in the stack-rolls table need explicit padding because the
     shared `.stacks-table .relative` rule (lives in CharacterEditForm.svelte)
     zeroes internal padding to make NumberInputs flat — and the Button
     component renders a <button class="... relative">, which the zeroing
     rule also matches. We need higher specificity than `.stacks-table .relative`
     to win — chain two .stacks-table classes via .stacks-table.stacks-table
     to bump specificity above .stacks-table .relative. */
  :global(.stacks-table button.relative) {
    padding: 0.5rem 0.875rem !important;
  }
</style>

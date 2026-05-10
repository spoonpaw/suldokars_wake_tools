<script lang="ts">
  import { goto } from '$app/navigation';
  import type { SWCharacter, ArtisticModKind, ArtisticModRecord } from '$lib/models';
  import { createDefaultCharacter, type CharacterType, type LifeForm, type Background, type PrimaryStack, type Stack, PRIMARY_STACKS, ALL_STACKS, STACK_LABELS, BACKGROUNDS, LIFE_FORMS, CHARACTER_TYPES, allowedLifeForms, type Language, recomputeStacks } from '$lib/models';
  import { characterStore } from '$lib/stores';
  import { Button, Card, Input, NumberInput, Select, TextArea, Toggle } from '$lib/components/ui';
  import { BACKGROUNDS_DATA, LIFE_FORMS_DATA, getTypeGraph, mandatoryLanguageForLifeForm, LANGUAGES_DATA, BASIC_FORMULAE, lifeFormGroup, startingPartsFor } from '$lib/data';
  import { rollD3, rollD6, rollD12 } from '$lib/utils/dice';
  import { applyBonuses, applyBonusesComposed, type LifeFormBonusDistribution } from '$lib/utils/computed';
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
    { id: 'implants', label: 'Implants' },
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

  /**
   * Apply life-form + background bonuses + type origo to the raw stack rolls
   * and write the result into character.stacks. Idempotent: re-runnable when
   * the user revisits earlier steps.
   */
  function recomputeFinalStacks() {
    const raw = character.baseStackRolls ?? {
      archive: character.stacks.archive,
      bulk: character.stacks.bulk,
      ghost: character.stacks.ghost,
      morph: character.stacks.morph,
      speed: character.stacks.speed,
      tech: character.stacks.tech
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

  function toggleDistributionPick(stack: PrimaryStack, slot: 'plus2' | 'plus1') {
    const arr = distribution[slot];
    if (arr.includes(stack)) {
      distribution[slot] = arr.filter((s) => s !== stack);
    } else {
      distribution[slot] = [...arr, stack];
    }
  }

  // ===== Stack rolling =====
  // SW: roll 6 stacks (one per primary). Conventional: 2d6 with cap at 6, but
  // the rules-as-written say roll one die per stack and pair zero rolls (doubles)
  // to gate life-form. For the wizard we offer a simple "roll 2d6 then -6 capped 0-6"
  // approach plus a manual override; the "doubles" count is what determines
  // life-form choice (number of zeroes).

  function rollStacks() {
    for (const s of PRIMARY_STACKS) {
      // 1d6 - 1 → 0..5 distribution. Adjust as desired.
      character.stacks[s] = Math.max(0, rollD6() - 1);
    }
    character.baseStackRolls = { ...character.stacks };
  }

  function pairs(): number {
    let n = 0;
    for (const s of PRIMARY_STACKS) if ((character.stacks[s] ?? 0) === 0) n++;
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
    applyOrigo(t);
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
  }

  function setLifeForm(lf: LifeForm) {
    character.lifeForm = lf;
    // Reset mandatory language
    const mand = mandatoryLanguageForLifeForm(lf);
    if (mand && !character.languages.includes(mand)) {
      character.languages = [...character.languages.filter((l) => l !== 'pidgin'), 'pidgin', mand];
    }
  }

  function setBackground(bg: Background) {
    character.background = bg;
  }

  // ===== Keywords =====
  let availableKw = $derived(BACKGROUNDS_DATA.find((b) => b.id === character.background)?.keywords ?? []);
  const allKws = BACKGROUNDS_DATA.flatMap((b) =>
    b.keywords.map((k) => ({ ...k, fromBackground: b.id, label: `${k.name} (${b.label})` }))
  );

  function addBackgroundKw(name: string, stackHint: string) {
    character.keywords = [
      ...character.keywords,
      {
        id: crypto.randomUUID(),
        name,
        stack: stackHint as PrimaryStack,
        notes: '',
        source: 'background',
        fromBackground: character.background
      }
    ];
  }

  function addCrossKw(name: string, fromBackground: Background, stackHint: string) {
    character.keywords = [
      ...character.keywords,
      {
        id: crypto.randomUUID(),
        name,
        stack: stackHint as PrimaryStack,
        notes: '',
        source: 'cross',
        fromBackground
      }
    ];
  }

  function removeKw(id: string) {
    character.keywords = character.keywords.filter((k) => k.id !== id);
  }

  // ===== Languages =====
  function rollThirdLanguage() {
    character.thirdLanguageRoll = rollD3();
  }
  function toggleLang(l: typeof LANGUAGES_DATA[number]['id']) {
    // Pidgin is universal — never removable.
    if (l === 'pidgin') return;
    // Mandatory life-form language is also locked once life-form is set.
    const mandatory = mandatoryLanguageForLifeForm(character.lifeForm);
    if (l === mandatory) return;
    if (character.languages.includes(l)) {
      character.languages = character.languages.filter((x) => x !== l);
    } else {
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
    return character.languages.filter(
      (l) => l !== 'pidgin' && l !== mandatory
    ).length;
  }

  // ===== Funds =====
  function rollFunds() {
    const r = rollD6();
    character.startingFundsRoll = r;
    character.startingFunds = startingPartsFor(character.lifeForm, r);
    character.purse.parts = character.startingFunds;
  }

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
    equipmentLocation:
      | 'worn'
      | 'slot10'
      | 'backpack'
      | 'no_slot'
      | 'mission'
      | 'storage'
      | 'other';
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

  const AM_BODY_PART_OPTS = [
    { value: 'head', label: 'Head' },
    { value: 'body', label: 'Body' },
    { value: 'leg', label: 'Leg' },
    { value: 'arm', label: 'Arm' },
    { value: 'hand', label: 'Hand' },
    { value: 'eye', label: 'Eye' },
    { value: 'other', label: 'Other' }
  ];

  const AM_STACK_OPTS = [
    { value: '', label: '— None —' },
    ...ALL_STACKS.map((s) => ({ value: s, label: STACK_LABELS[s] }))
  ];

  /**
   * Languages available to the AM language picker — minus the ones already
   * known. EXCEPTION: include the AM-owned language so the player still sees
   * their current selection in the dropdown after Back/Next round trip
   * (otherwise the option list filters their pick out and the select renders
   * blank, inviting accidental loss).
   */
  const amAvailableLanguages = $derived.by(() => {
    const ownLang = character.artisticMod?.appliedRefs?.languageId;
    return LANGUAGES_DATA.filter(
      (l) => !character.languages.includes(l.id) || l.id === ownLang
    );
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
    const ownKwName = ownKwId
      ? character.keywords.find((k) => k.id === ownKwId)?.name?.toLowerCase()
      : undefined;
    const known = new Set(
      character.keywords
        .filter((k) => k.id !== ownKwId)
        .map((k) => k.name.toLowerCase())
    );
    return bg.keywords.filter(
      (k) => !known.has(k.name.toLowerCase()) || k.name.toLowerCase() === ownKwName
    );
  });

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
            i === step
              ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
              : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
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
    <Card title="Pick a type (rules/18)">
      <div class="grid gap-3 sm:grid-cols-3">
        {#each CHARACTER_TYPES as t (t.id)}
          <button
            type="button"
            onclick={() => setType(t.id)}
            class={`rounded-xl border p-3 text-left transition ${
              character.type === t.id
                ? 'border-cyan-500/50 bg-cyan-900/30'
                : 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70'
            }`}
          >
            <p class="font-semibold text-neutral-100">{t.label}</p>
            <p class="text-xs text-neutral-400">{t.tagline}</p>
          </button>
        {/each}
      </div>
      {#if character.type === 'apt'}
        <div class="mt-4">
          <p class="text-sm text-neutral-300">Apt picks which combat stack starts at 1:</p>
          <div class="mt-2 flex gap-2">
            <Button
              variant={character.aptCombatPick === 'close' ? 'primary' : 'secondary'}
              onclick={() => pickAptCombat('close')}
            >
              Close
            </Button>
            <Button
              variant={character.aptCombatPick === 'ranged' ? 'primary' : 'secondary'}
              onclick={() => pickAptCombat('ranged')}
            >
              Ranged
            </Button>
          </div>
        </div>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'stacks'}
    <Card title="Stack rolls (rules/16)">
      <p class="text-sm text-neutral-400">
        Roll one die per primary stack (1d6 - 1 = 0..5). Zeros count as "doubles" and gate
        life-form. You may swap any two scores after rolling.
      </p>
      <div class="my-3">
        <Button onclick={rollStacks}>Roll all stacks</Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        {#each PRIMARY_STACKS as s}
          <NumberInput
            label={STACK_LABELS[s]}
            value={character.stacks[s]}
            min={0}
            max={9}
            onchange={(v) => (character.stacks[s] = v)}
          />
        {/each}
      </div>
      <p class="mt-3 text-sm text-neutral-300">Pairs (zero rolls): <strong>{pairs()}</strong></p>
      <p class="text-xs text-neutral-500">
        0 → Blood or Alien · 1 → Blood only · 2 → Blood/Alien/Tank Born · 3+ → all (incl Construct).
      </p>
    </Card>
  {:else if STEPS[step].id === 'lifeform'}
    <Card title="Life-form (rules/18)">
      <p class="text-sm text-neutral-400 mb-3">
        Allowed for your pair count: {allowedLfs.map((l) => LIFE_FORMS.find((x) => x.id === l)?.label).join(', ')}.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each LIFE_FORMS_DATA as lf (lf.id)}
          {@const enabled = allowedLfs.includes(lf.id)}
          <button
            type="button"
            disabled={!enabled}
            onclick={() => setLifeForm(lf.id)}
            class={`rounded-xl border p-3 text-left transition ${
              character.lifeForm === lf.id
                ? 'border-cyan-500/50 bg-cyan-900/30'
                : enabled
                  ? 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70'
                  : 'border-neutral-800/50 bg-neutral-900/20 opacity-40'
            }`}
          >
            <p class="font-semibold text-neutral-100">{lf.label}</p>
            <p class="text-xs text-neutral-400">{lf.blurb}</p>
          </button>
        {/each}
      </div>
      <p class="mt-3 text-xs text-neutral-500">Distribute the life-form's stack bonuses on the next step.</p>
    </Card>
  {:else if STEPS[step].id === 'distribution'}
    {@const lf = LIFE_FORMS_DATA.find((l) => l.id === character.lifeForm)!}
    <Card title="Bonus distribution (rules/18)">
      <p class="text-sm text-neutral-400 mb-3">
        Assign the {lf.label} bonuses to your stacks. Recompute when done — that
        applies origo + life-form + background to your raw rolls.
      </p>

      {#if lf.pickCapStack}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">Set & cap (8) — pick one</h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each lf.capStackOptions ?? [] as s}
            {@const checked = distribution.capped === s}
            <button
              type="button"
              onclick={() => (distribution.capped = checked ? undefined : s)}
              class={`rounded-full border px-3 py-1 text-sm transition ${
                checked
                  ? 'border-amber-500/50 bg-amber-900/30 text-amber-200'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
              }`}
            >
              {STACK_LABELS[s]}
            </button>
          {/each}
        </div>
      {/if}

      {#if lf.plus2Count > 0}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">+2 to {lf.plus2Count} stacks ({distribution.plus2.length}/{lf.plus2Count})</h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each PRIMARY_STACKS as s}
            {@const checked = distribution.plus2.includes(s)}
            <button
              type="button"
              onclick={() => toggleDistributionPick(s, 'plus2')}
              class={`rounded-full border px-3 py-1 text-sm transition ${
                checked
                  ? 'border-cyan-500/50 bg-cyan-900/30 text-cyan-200'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
              }`}
            >
              {STACK_LABELS[s]}
            </button>
          {/each}
        </div>
      {/if}

      {#if lf.plus1Count > 0}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">+1 to {lf.plus1Count} stacks ({distribution.plus1.length}/{lf.plus1Count})</h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each PRIMARY_STACKS as s}
            {@const checked = distribution.plus1.includes(s)}
            <button
              type="button"
              onclick={() => toggleDistributionPick(s, 'plus1')}
              class={`rounded-full border px-3 py-1 text-sm transition ${
                checked
                  ? 'border-cyan-500/50 bg-cyan-900/30 text-cyan-200'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
              }`}
            >
              {STACK_LABELS[s]}
            </button>
          {/each}
        </div>
      {/if}

      {#if character.type === 'apt' || lf.combatBonusMode === 'either'}
        <h3 class="mt-2 text-sm font-semibold text-neutral-200">Combat pick — Close OR Ranged</h3>
        <div class="my-2 flex gap-2">
          <Button
            variant={distribution.combatPick === 'close' ? 'primary' : 'secondary'}
            onclick={() => (distribution.combatPick = 'close')}
          >
            Close
          </Button>
          <Button
            variant={distribution.combatPick === 'ranged' ? 'primary' : 'secondary'}
            onclick={() => (distribution.combatPick = 'ranged')}
          >
            Ranged
          </Button>
        </div>
      {/if}

      <div class="mt-4">
        <Button onclick={recomputeFinalStacks}>Recompute final stacks</Button>
      </div>

      <h3 class="mt-4 text-sm font-semibold text-neutral-200">Current final stacks</h3>
      <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {#each PRIMARY_STACKS as s}
          <div class="rounded-lg bg-neutral-800/50 p-2">
            <dt class="text-neutral-400">{STACK_LABELS[s]}</dt>
            <dd class="text-xl font-bold text-neutral-100">{character.stacks[s]}</dd>
          </div>
        {/each}
        <div class="rounded-lg bg-neutral-800/50 p-2">
          <dt class="text-neutral-400">Close</dt>
          <dd class="text-xl font-bold text-neutral-100">{character.stacks.close}</dd>
        </div>
        <div class="rounded-lg bg-neutral-800/50 p-2">
          <dt class="text-neutral-400">Ranged</dt>
          <dd class="text-xl font-bold text-neutral-100">{character.stacks.ranged}</dd>
        </div>
      </dl>
    </Card>
  {:else if STEPS[step].id === 'background'}
    <Card title="Background (rules/19)">
      <Select
        label="Background"
        options={BG_OPTS}
        value={character.background}
        onchange={(v) => {
          character.background = v as Background;
          // Re-apply bonuses so background changes flow into final stacks.
          recomputeFinalStacks();
        }}
      />
      {#if character.background}
        {@const bg = BACKGROUNDS_DATA.find((b) => b.id === character.background)!}
        <p class="mt-3 text-sm text-neutral-300">{bg.blurb}</p>
        <p class="mt-1 text-sm text-neutral-300">
          Combat: +{bg.closeBonus} Close, +{bg.rangedBonus} Ranged.
          Primary:
          {#each Object.entries(bg.primaryBonuses) as [s, v]}
            +{v} <span class="capitalize">{s}</span>{' '}
          {/each}
        </p>
        <div class="mt-3">
          <Button variant="secondary" onclick={recomputeFinalStacks}>Recompute final stacks</Button>
        </div>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'keywords'}
    {@const bgPicks = character.keywords.filter((k) => k.source === 'background').length}
    {@const crossPicks = character.keywords.filter((k) => k.source === 'cross').length}
    <Card title="Pick 3 keywords from your background, plus 1 cross-pick">
      <p class="text-sm text-neutral-400 mb-2">Background: <strong>{character.background}</strong>. Suggested stack hints in parentheses.</p>
      <p class="mb-2 text-xs text-neutral-500">
        Picked: <strong>{bgPicks}</strong> / 3 background, <strong>{crossPicks}</strong> / 1 cross.
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        {#each availableKw as k (k.name)}
          <button
            type="button"
            onclick={() => addBackgroundKw(k.name, k.stackHints[0])}
            class="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2 text-left text-sm hover:bg-neutral-900/80"
          >
            <span class="text-neutral-100">{k.name}</span>
            <span class="text-neutral-500"> ({k.stackHints.join(', ')})</span>
          </button>
        {/each}
      </div>

      <h3 class="mt-4 mb-2 font-semibold text-neutral-200">Cross-pick (any background)</h3>
      <div class="max-h-48 overflow-y-auto rounded-lg border border-neutral-800 p-2">
        {#each allKws as k (`${k.fromBackground}-${k.name}`)}
          <button
            type="button"
            onclick={() => addCrossKw(k.name, k.fromBackground, k.stackHints[0])}
            class="block w-full text-left text-sm text-neutral-300 hover:text-cyan-200"
          >
            {k.label} <span class="text-neutral-500">({k.stackHints.join(', ')})</span>
          </button>
        {/each}
      </div>

      <h3 class="mt-4 mb-2 font-semibold text-neutral-200">Picked</h3>
      {#if character.keywords.length === 0}
        <p class="text-sm text-neutral-500">None picked yet.</p>
      {:else}
        <ul class="space-y-1 text-sm">
          {#each character.keywords as k (k.id)}
            <li class="flex items-center justify-between rounded-lg bg-neutral-800/50 px-2 py-1">
              <span>{k.name} <span class="text-neutral-500">({k.stack}, {k.source})</span></span>
              <button class="text-red-400 hover:text-red-300" onclick={() => removeKw(k.id)} aria-label="Remove">×</button>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'languages'}
    {@const slots = languageSlotsAllowed()}
    {@const picked = extraLanguagesPicked()}
    {@const overPicked = picked > slots}
    <Card title="Languages (rules/20)">
      <p class="text-sm text-neutral-400">
        Pidgin always known. Pick a second language. Roll d3 — on a 3, gain a third.
      </p>
      {#if mandatoryLanguageForLifeForm(character.lifeForm)}
        <p class="text-xs text-amber-300 mt-1">
          Your life-form requires <strong>{mandatoryLanguageForLifeForm(character.lifeForm)}</strong> as second language (locked).
        </p>
      {/if}
      <div class="my-3 flex items-center gap-3">
        <Button onclick={rollThirdLanguage}>Roll d3</Button>
        {#if character.thirdLanguageRoll}
          <span class="text-sm text-neutral-300">d3 → {character.thirdLanguageRoll}{character.thirdLanguageRoll === 3 ? ' (third language unlocked!)' : ''}</span>
        {/if}
      </div>
      <p class="mb-2 text-xs {overPicked ? 'text-red-300' : 'text-neutral-500'}">
        Extra languages picked: <strong>{picked}</strong> / {slots} allowed
        {overPicked ? ' — too many for your slots' : ''}
      </p>
      <div class="flex flex-wrap gap-2">
        {#each LANGUAGES_DATA as l (l.id)}
          {@const checked = character.languages.includes(l.id)}
          <button
            type="button"
            onclick={() => toggleLang(l.id)}
            class={`rounded-full border px-3 py-1 text-sm transition ${
              checked
                ? 'border-cyan-500/50 bg-cyan-900/30 text-cyan-200'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
            }`}
          >
            {l.name}
          </button>
        {/each}
      </div>
    </Card>
  {:else if STEPS[step].id === 'spaces'}
    <Card title="Spaces (type-specific)">
      {#if character.type === 'core'}
        <p class="text-sm text-neutral-400 mb-2">Core: pick basic formulae for your spaces. First pick is active.</p>
        <div class="max-h-72 overflow-y-auto rounded-lg border border-neutral-800 p-2">
          {#each BASIC_FORMULAE as f (f.id)}
            <button
              type="button"
              onclick={() => addCoreFormula(f.id)}
              class="block w-full rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800/50"
            >
              {f.name} <span class="text-neutral-500">({f.formulaCost} H)</span>
            </button>
          {/each}
        </div>
        <h3 class="mt-3 mb-2 text-sm font-semibold text-neutral-200">Picked formulae</h3>
        {#if character.formulae.length === 0}
          <p class="text-sm text-neutral-500">None picked.</p>
        {:else}
          <ul class="space-y-1 text-sm">
            {#each character.formulae as f (f.id)}
              <li class="flex items-center justify-between rounded-lg bg-neutral-800/50 px-2 py-1">
                <span>{f.name} {f.active ? '(active)' : '(inactive)'} — {f.hCost} H</span>
                <button class="text-red-400" onclick={() => removeFormula(f.id)}>×</button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if character.type === 'apt'}
        <p class="text-sm text-neutral-400">
          Apt: spaces hold equipment, masters, places, or pets that boost a stack 1/24h.
          Add via the full editor (Equipment / Identity / Notes) — these can be filled in
          as your character finds them.
        </p>
      {:else}
        <p class="text-sm text-neutral-400">
          Prime: spaces fill with bested-enemy memories during play. Leave empty at gen.
        </p>
      {/if}
    </Card>
  {:else if STEPS[step].id === 'equipment'}
    <Card title="Starter equipment & funds (rules/23–29)">
      <p class="text-sm text-neutral-400">
        Pick up to 5 free items, each ≤ 100 P. Roll d6 for starter Parts (per life-form table) and buy the rest.
      </p>
      <div class="my-3 flex items-center gap-3">
        <Button onclick={rollFunds}>Roll d6 for funds</Button>
        {#if character.startingFundsRoll}
          <span class="text-sm text-neutral-300">
            d6 → {character.startingFundsRoll} → <strong>{character.startingFunds} P</strong>
          </span>
        {/if}
      </div>
      <p class="text-xs text-neutral-500">
        Build out weapons, armor, and inventory in detail using the editor on the next steps and after saving.
      </p>
    </Card>
  {:else if STEPS[step].id === 'implants'}
    <Card title="Implants (rules/24)">
      {#if character.type !== 'apt'}
        <p class="text-sm text-neutral-400">
          Only Apt characters can pre-install an implant at character generation
          (via Artistic Modification, next step). Other types acquire implants in play.
        </p>
      {:else}
        <p class="text-sm text-neutral-400">
          Apt origo grants Implants 1. You may pre-install via Artistic Modification (next step) — note the implant name + drawback.
        </p>
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
    <Card title="Artistic Modification (rules/30)">
      <p class="text-sm text-neutral-400 mb-3">
        Pick one mechanical modification. The wired effect is applied to your character on Next / Save.
        You can revisit this step to change your pick — the previous effect is undone first.
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
          <p class="mb-2 text-xs text-neutral-500">
            Picks one language not already known. Already-known languages are filtered out.
          </p>
          {#if amAvailableLanguages.length === 0}
            <p class="text-sm text-amber-300">
              You already know every language in the catalogue — nothing to add.
            </p>
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
            <TextArea
              label="Notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
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
              options={[
                { value: '', label: '— pick background —' },
                ...BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }))
              ]}
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
            <TextArea
              label="Notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
          </div>
        {:else if amDraft.kind === 'reputation'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Set reputation (1-8)</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Sets <code>character.reputation</code> directly. Acts as the floor / starting value.
          </p>
          <NumberInput
            label="Reputation"
            value={amDraft.reputationValue}
            min={1}
            max={8}
            onchange={(v) => (amDraft.reputationValue = v)}
          />
          <div class="mt-3">
            <TextArea
              label="Reason / notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
          </div>
        {:else if amDraft.kind === 'gunta_plus'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Gunta +1</h3>
          <p class="text-sm text-neutral-300">
            Will set <code>guntaValue</code> from <strong>{character.guntaValue}</strong> to
            <strong>{character.guntaValue + 1}</strong>.
          </p>
          <div class="mt-3">
            <TextArea
              label="Reason / notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
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
            <TextArea
              label="Notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
          </div>
        {:else if amDraft.kind === 'shadow_plus'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Shadow +1-3 with reason</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Increments <code>shadow</code> AND <code>typeGraphPosition.x</code> by the chosen
            amount. The reason text is recorded as the AM description.
          </p>
          <NumberInput
            label="Shadow delta"
            value={amDraft.shadowDelta}
            min={1}
            max={3}
            onchange={(v) => (amDraft.shadowDelta = v)}
          />
          <div class="mt-2">
            <TextArea label="Reason" rows={3} bind:value={amDraft.shadowReason} />
          </div>
        {:else if amDraft.kind === 'expensive_equipment'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Expensive equipment + debt</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Adds an inventory item AND a matching debt for the same amount.
            Pick the slot location now (or default to Storage and adjust in the
            inventory editor later).
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <Input label="Item name" bind:value={amDraft.equipmentName} />
            <NumberInput
              label="Cost (P)"
              value={amDraft.equipmentCost}
              min={0}
              onchange={(v) => (amDraft.equipmentCost = v)}
            />
          </div>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <NumberInput
              label="Slots"
              value={amDraft.equipmentSlots}
              min={0}
              step={0.5}
              onchange={(v) => (amDraft.equipmentSlots = v)}
            />
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
              {amDraft.equipmentLocation}) to inventory
              AND a <strong>{amDraft.equipmentCost} P</strong> debt to
              <strong>{amDraft.equipmentHolder || 'Unknown creditor'}</strong>.
            </p>
          {/if}
          <div class="mt-3">
            <TextArea
              label="Notes (optional)"
              rows={2}
              bind:value={amDraft.description}
            />
          </div>
        {:else if amDraft.kind === 'implant'}
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Implant (Apt only)</h3>
          {#if character.type !== 'apt'}
            <p class="text-sm text-amber-300">
              Implants via Artistic Modification are restricted to Apt characters.
              Pick another AM kind, or change your character type on Step 2.
            </p>
          {:else}
            <p class="mb-2 text-xs text-neutral-500">
              Drawback is required for powerful implants per rules/30.
            </p>
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
              <TextArea
                label="Effect (e.g. '+2 Ranged via heads-up display')"
                rows={2}
                bind:value={amDraft.implantEffect}
              />
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
              <TextArea
                label="Drawback (REQUIRED for powerful implants)"
                rows={2}
                bind:value={amDraft.drawback}
              />
            </div>
          {/if}
        {:else}
          <!-- off_list -->
          <h3 class="mb-2 text-sm font-semibold text-neutral-200">Off-list</h3>
          <p class="mb-2 text-xs text-neutral-500">
            Discuss with the AI / GM — describe the bespoke modification and any drawback.
          </p>
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
        onclick={() =>
          (character.hooks = [
            ...character.hooks,
            { id: crypto.randomUUID(), title: '', body: '', open: true }
          ])}
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
    <Button variant="ghost" onclick={back} disabled={step === 0}>Back</Button>
    {#if step < STEPS.length - 1}
      <Button onclick={next}>Next</Button>
    {:else}
      <Button onclick={finish} loading={saving}>Save character</Button>
    {/if}
  </div>
</main>

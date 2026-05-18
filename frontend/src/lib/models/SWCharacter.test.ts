import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImportText, serializeCharacters } from '$lib/utils/importExport';
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultCharacter,
  emptyStackComposition,
  normalizeCharacter,
  recomputeStacks,
  sumComposition,
  type SWCharacter,
  type StackComposition,
  type StackScores
} from './SWCharacter';

const canonicalPartyText = readFileSync(new URL('./__fixtures__/canonical-party-2026-05-18.json', import.meta.url), 'utf8');

const zeroSlot = (base: number, final = base): StackComposition => ({
  base,
  lifeFormBonus: 0,
  backgroundBonus: 0,
  implantBonus: 0,
  other: final - base,
  final
});

const stacks = (values: StackScores): StackScores => values;

const stableCharacter = (character: SWCharacter): SWCharacter => ({
  ...structuredClone(character),
  id: '<import-generated-id>',
  updatedAt: '<import-generated-updated-at>'
});

const byName = (characters: SWCharacter[]): SWCharacter[] => characters.map(stableCharacter).sort((a, b) => a.name.localeCompare(b.name));

describe('SWCharacter import/export stack composition', () => {
  it('preserves explicit stack composition columns across export/import', () => {
    const character = normalizeCharacter({
      id: 'round-trip-original',
      name: 'Round Trip',
      type: 'core',
      lifeForm: 'blood',
      background: 'archivist',
      purse: {
        parts: 12,
        smallParts: 5,
        energyPacks: 4,
        energyCells: 3,
        stashedParts: 90,
        stashedSmallParts: 6,
        stashedEnergyPacks: 7,
        stashedEnergyCells: 8
      },
      stacks: stacks({
        archive: 9,
        bulk: 1,
        ghost: 1,
        morph: 1,
        speed: 1,
        tech: 1,
        close: 2,
        ranged: 2
      }),
      stackComposition: {
        archive: { base: 2, lifeFormBonus: 2, backgroundBonus: 1, implantBonus: 1, other: 3, final: 9 },
        bulk: zeroSlot(1),
        ghost: zeroSlot(1),
        morph: zeroSlot(1),
        speed: zeroSlot(1),
        tech: zeroSlot(1),
        close: { base: 0, lifeFormBonus: 2, backgroundBonus: 0, implantBonus: 0, other: 0, final: 2 },
        ranged: { base: 0, lifeFormBonus: 2, backgroundBonus: 0, implantBonus: 0, other: 0, final: 2 }
      }
    });

    const [imported] = parseImportText(serializeCharacters([character]));

    expect(imported.id).not.toBe(character.id);
    expect(imported.stackComposition?.archive).toMatchObject({
      base: 2,
      lifeFormBonus: 2,
      backgroundBonus: 1,
      implantBonus: 1,
      other: 3,
      final: 9
    });
    expect(imported.stackComposition?.close).toMatchObject({
      base: 0,
      lifeFormBonus: 2,
      backgroundBonus: 0,
      implantBonus: 0,
      other: 0,
      final: 2
    });
    expect(imported.purse).toMatchObject({
      parts: 12,
      smallParts: 5,
      energyPacks: 4,
      energyCells: 3,
      stashedParts: 90,
      stashedSmallParts: 6,
      stashedEnergyPacks: 7,
      stashedEnergyCells: 8
    });
  });

  it('round-trips the canonical party fixture without stack data loss', () => {
    const fixtureCharacters = (JSON.parse(canonicalPartyText).characters as SWCharacter[]).map(normalizeCharacter);
    const firstImport = parseImportText(canonicalPartyText);
    const secondImport = parseImportText(serializeCharacters(firstImport));

    expect(byName(firstImport)).toEqual(byName(fixtureCharacters));
    expect(byName(secondImport)).toEqual(byName(firstImport));

    const osric = firstImport.find((character) => character.name === 'Osric Ward');

    expect(osric?.beginnerGuntaCoins).toBe(1);
    expect(osric?.stackComposition?.ranged).toMatchObject({
      base: 1,
      lifeFormBonus: 2,
      backgroundBonus: 1,
      implantBonus: 2,
      other: 0,
      final: 6
    });
  });
});

describe('sumComposition + emptyStackComposition', () => {
  it('returns 0 for an empty composition', () => {
    expect(sumComposition(emptyStackComposition())).toBe(0);
  });

  it('sums every slot ignoring the cached final', () => {
    expect(
      sumComposition({
        base: 2,
        lifeFormBonus: 2,
        backgroundBonus: 1,
        implantBonus: 1,
        other: 3,
        final: 999 // intentionally stale cache — sumComposition recomputes
      })
    ).toBe(9);
  });
});

describe('recomputeStacks', () => {
  it('rebuilds stacks + each composition.final from the slot sums', () => {
    const c = createDefaultCharacter();
    c.stackComposition!.archive = {
      base: 2,
      lifeFormBonus: 2,
      backgroundBonus: 1,
      implantBonus: 0,
      other: 0,
      final: 0 // intentionally stale
    };
    c.stacks.archive = 0;

    const out = recomputeStacks(c);
    expect(out.stacks.archive).toBe(5);
    expect(out.stackComposition?.archive.final).toBe(5);
  });

  it('does not mutate the input character', () => {
    const c = createDefaultCharacter();
    c.stackComposition!.bulk.base = 3;
    const before = structuredClone(c);
    recomputeStacks(c);
    expect(c).toEqual(before);
  });

  it('refreshes implantBonus from implants[].stackBonus when asked', () => {
    const c = createDefaultCharacter();
    c.implants = [
      {
        id: 'imp-1',
        name: 'Witness Eye',
        bodyPart: 'eye',
        effect: '+2 Ranged',
        stackBonus: [{ stack: 'ranged', bonus: 2 }]
      }
    ];
    // Composition default for ranged is base=1, final=1 (Apt origo).
    const out = recomputeStacks(c, true);
    expect(out.stackComposition?.ranged.implantBonus).toBe(2);
    expect(out.stacks.ranged).toBe(3); // base 1 + implant 2
  });

  it('zeroes implantBonus when implants no longer grant it (refreshImplantBonus=true)', () => {
    const c = createDefaultCharacter();
    c.stackComposition!.bulk = {
      base: 1,
      lifeFormBonus: 0,
      backgroundBonus: 0,
      implantBonus: 3,
      other: 0,
      final: 4
    };
    c.implants = [];
    const out = recomputeStacks(c, true);
    expect(out.stackComposition?.bulk.implantBonus).toBe(0);
    expect(out.stacks.bulk).toBe(1);
  });
});

describe('normalizeCharacter migration', () => {
  it('stamps current schemaVersion on legacy saves missing the field', () => {
    const legacy = { id: 'old', name: 'Legacy', type: 'apt' };
    const out = normalizeCharacter(legacy);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('upgrades old naniteCap=5 to the correct 20 (rules/50:36)', () => {
    const out = normalizeCharacter({
      id: 'old',
      name: 'OldNanite',
      harm: { naniteCap: 5, naniteTaken: 0, harmTaken: 0, harmCap: 20, status: 'unharmed' }
    });
    expect(out.harm.naniteCap).toBe(20);
  });

  it('normalizes legacy harm.status aliases', () => {
    expect(normalizeCharacter({ harm: { status: 'clean' } }).harm.status).toBe('unharmed');
    expect(normalizeCharacter({ harm: { status: 'at-risk' } }).harm.status).toBe('end-roll-pending');
    expect(normalizeCharacter({ harm: { status: 'injured-ko' } }).harm.status).toBe('injured-knocked-out');
    expect(normalizeCharacter({ harm: { status: 'something-bogus' } }).harm.status).toBe('unharmed');
  });

  it('backfills stackComposition from baseStackRolls when missing', () => {
    const out = normalizeCharacter({
      id: 'rollsonly',
      name: 'BaseOnly',
      stacks: { archive: 3, bulk: 1, ghost: 1, morph: 1, speed: 1, tech: 1, close: 0, ranged: 0 },
      baseStackRolls: { archive: 3 }
    });
    expect(out.stackComposition?.archive.base).toBe(3);
    // No bonuses recorded → entire final goes into base, other stays 0.
    expect(out.stackComposition?.archive.final).toBe(3);
  });

  it('folds cached-stack delta into `other` so composition sum matches cached final', () => {
    // Legacy character: cached stack final = 7, but only base = 2 is stored.
    // Migration should add 5 to `other` so composition reconciles.
    const out = normalizeCharacter({
      stacks: { archive: 7, bulk: 0, ghost: 0, morph: 0, speed: 0, tech: 0, close: 0, ranged: 0 },
      stackComposition: {
        archive: { base: 2, lifeFormBonus: 0, backgroundBonus: 0, implantBonus: 0, other: 0, final: 2 }
      }
    });
    expect(out.stackComposition?.archive.final).toBe(7);
    expect(out.stackComposition?.archive.other).toBe(5);
    expect(out.stacks.archive).toBe(7);
  });

  it('seeds a default OwnedGraph for legacy characters with no graph library', () => {
    const out = normalizeCharacter({ id: 'no-graph', type: 'core' });
    expect(out.ownedGraphs?.length).toBeGreaterThanOrEqual(1);
    expect(out.ownedGraphs?.[0].source).toBe('default');
    expect(out.activeGraphId).toBe(out.ownedGraphs?.[0].id);
  });

  it('prepends a default graph when the player only has custom/looted entries', () => {
    const custom = {
      id: 'custom-g',
      name: 'Homebrew Path',
      source: 'custom' as const,
      graph: { type: 'core' as const, nodes: [] },
      acquiredAt: '2025-01-01T00:00:00.000Z'
    };
    const out = normalizeCharacter({
      type: 'core',
      ownedGraphs: [custom],
      activeGraphId: 'custom-g'
    });
    expect(out.ownedGraphs?.some((g) => g.source === 'default')).toBe(true);
    // Active graph stays on the player's pick (we don't reset it just because we prepended).
    expect(out.activeGraphId).toBe('custom-g');
  });

  it('coerces stashed/equipped consistency for legacy inventory items', () => {
    const out = normalizeCharacter({
      inventory: [
        { id: 'a', name: 'A', location: 'storage' }, // no flags → infer stashed=true
        { id: 'b', name: 'B', equipped: true, stashed: true } // conflict → equipped forced false
      ]
    });
    expect(out.inventory[0].stashed).toBe(true);
    expect(out.inventory[0].equipped).toBe(false);
    expect(out.inventory[1].equipped).toBe(false);
    expect(out.inventory[1].stashed).toBe(true);
  });

  it('coerces NaN / negative purse values to 0 (defensive against bad imports)', () => {
    const out = normalizeCharacter({
      purse: { parts: -5, smallParts: NaN, energyPacks: 'abc', energyCells: 12 }
    });
    expect(out.purse.parts).toBe(0);
    expect(out.purse.smallParts).toBe(0);
    expect(out.purse.energyPacks).toBe(0);
    expect(out.purse.energyCells).toBe(12);
  });

  it('replaces explicit-undefined optional string fields with empty strings (Svelte bind safety)', () => {
    const out = normalizeCharacter({
      notes: undefined,
      title: undefined,
      identity: { age: undefined, gender: undefined }
    });
    expect(out.notes).toBe('');
    expect(out.title).toBe('');
    expect(out.identity.age).toBe('');
    expect(out.identity.gender).toBe('');
  });
});

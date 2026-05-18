import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImportText, serializeCharacters } from '$lib/utils/importExport';
import { normalizeCharacter, type SWCharacter, type StackComposition, type StackScores } from './SWCharacter';

const canonicalPartyText = readFileSync(new URL('./__fixtures__/canonical-party-2026-05-15.json', import.meta.url), 'utf8');

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

    expect(osric?.beginnerGuntaCoins).toBe(2);
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

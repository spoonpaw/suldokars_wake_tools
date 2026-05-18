import { describe, expect, it } from 'vitest';
import { createDefaultCharacter, normalizeCharacter } from '$lib/models';
import {
  applyNaniteHarm,
  applyPhysicalHarm,
  carriedMoneySlots,
  endRollFail,
  equippedArmor,
  healNaniteHarm,
  resetHarm,
  statusBadge,
  totalSlots,
  usedSlots
} from './computed';

describe('equipment carrying state', () => {
  it('grants container capacity only while the container is equipped and not stashed', () => {
    const character = createDefaultCharacter();
    character.inventory = [
      {
        id: 'backpack',
        name: 'Backpack',
        slots: 1,
        cost: 5,
        location: 'slot10',
        equipped: true,
        stashed: false,
        isContainer: true,
        containerSlots: 5
      }
    ];

    expect(totalSlots(character)).toBe(14);
    expect(usedSlots(character)).toBe(1);

    character.inventory[0].equipped = false;
    expect(totalSlots(character)).toBe(10);
    expect(usedSlots(character)).toBe(1);

    character.inventory[0].stashed = true;
    character.inventory[0].location = 'storage';
    expect(totalSlots(character)).toBe(10);
    expect(usedSlots(character)).toBe(0);
  });

  it('counts carried weapons and armor, but ignores stashed entries', () => {
    const character = createDefaultCharacter();
    character.weapons = [
      {
        id: 'sidearm',
        name: 'Sidearm',
        damage: 'd6',
        damageType: 'kinetic',
        slots: 1,
        range: 'range',
        cost: 0,
        equipped: false,
        stashed: false
      }
    ];
    character.armor = [
      {
        id: 'jacket',
        name: 'Soft Jacket',
        slots: 2,
        cost: 0,
        equipped: false,
        stashed: false
      }
    ];

    expect(usedSlots(character)).toBe(3);

    character.weapons[0].stashed = true;
    character.armor[0].stashed = true;
    expect(usedSlots(character)).toBe(0);
  });

  it('does not treat stashed armor as equipped protection', () => {
    const character = createDefaultCharacter();
    character.armor = [
      {
        id: 'stashed-armor',
        name: 'Stashed Armor',
        slots: 2,
        cost: 0,
        equipped: true,
        stashed: true
      },
      {
        id: 'worn-armor',
        name: 'Worn Armor',
        slots: 2,
        cost: 0,
        equipped: true,
        stashed: false
      }
    ];

    expect(equippedArmor(character)?.id).toBe('worn-armor');
  });

  it('counts on-hand money as carried slots while ignoring stashed money', () => {
    const character = createDefaultCharacter();
    character.purse.parts = 11;
    character.purse.smallParts = 5;
    character.purse.energyPacks = 10;
    character.purse.energyCells = 101;
    character.purse.stashedParts = 999;
    character.purse.stashedSmallParts = 999;
    character.purse.stashedEnergyPacks = 999;
    character.purse.stashedEnergyCells = 999;

    expect(carriedMoneySlots(character.purse)).toBe(5);
    expect(usedSlots(character)).toBe(5);
  });
});

describe('harm status language', () => {
  it('uses rules-facing labels instead of clean/KO shorthand', () => {
    const character = createDefaultCharacter();
    character.stacks.bulk = 2;

    expect(character.harm.status).toBe('unharmed');
    expect(statusBadge(character.harm.status).label).toBe('Unharmed');

    character.harm = applyPhysicalHarm(character, 3);
    expect(character.harm.status).toBe('end-roll-pending');
    expect(statusBadge(character.harm.status).label).toBe('End roll pending');

    character.harm = endRollFail(character);
    expect(character.harm.status).toBe('injured-knocked-out');
    expect(statusBadge(character.harm.status).label).toBe('Injured + knocked out');

    character.harm.status = 'injured';
    expect(statusBadge(character.harm.status).label).toBe('Injured');

    character.harm.status = 'injured-knocked-down';
    expect(statusBadge(character.harm.status).label).toBe('Injured + knocked down');
  });

  it('normalizes pre-release harm status names from older local exports', () => {
    expect(normalizeCharacter({ harm: { status: 'clean' } }).harm.status).toBe('unharmed');
    expect(normalizeCharacter({ harm: { status: 'at-risk' } }).harm.status).toBe('end-roll-pending');
    expect(normalizeCharacter({ harm: { status: 'injured-ko' } }).harm.status).toBe('injured-knocked-out');
  });

  it('treats nanite-only harm as harm, not as unharmed', () => {
    const character = createDefaultCharacter();

    character.harm = applyNaniteHarm(character, 1);
    expect(character.harm.status).toBe('harmed');
    expect(statusBadge(character.harm.status).label).toBe('Harmed');

    character.harm = healNaniteHarm(character, 1);
    expect(character.harm.status).toBe('unharmed');

    character.harm = applyNaniteHarm(character, 20);
    expect(character.harm.status).toBe('comatose');
    expect(statusBadge(character.harm.status).label).toBe('Comatose');
  });

  it('keeps and clears a manual status note with the harm tracker state', () => {
    const character = createDefaultCharacter();
    character.harm.status = 'injured';
    character.harm.statusNote = 'True Grit special success';

    expect(character.harm.statusNote).toBe('True Grit special success');

    character.harm = resetHarm(character);
    expect(character.harm.status).toBe('unharmed');
    expect(character.harm.statusNote).toBe('');
  });
});

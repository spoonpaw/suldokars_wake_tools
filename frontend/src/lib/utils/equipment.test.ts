import { describe, expect, it } from 'vitest';
import {
  armorFromDef,
  buildArmorFromCatalog,
  buildGearFromCatalog,
  buildWeaponFromCatalog,
  gearFromDef,
  kitFromDef,
  newItemId,
  petFromDef,
  vehicleFromDef,
  weaponFromDef
} from './equipment';
import type { ArmorDef, GearDef, KitDef, PetDef, VehicleDef, WeaponDef } from '$lib/data';

describe('newItemId', () => {
  it('returns a non-empty string and unique values across calls', () => {
    const a = newItemId();
    const b = newItemId();
    expect(a).toBeTypeOf('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe('weaponFromDef', () => {
  it('seeds equipped=true, stashed=false, and a full clip with 0 spare', () => {
    const def: WeaponDef = {
      id: 'test-w',
      name: 'Test Blaster',
      damage: 'd6',
      damageType: 'energy',
      slots: 1,
      range: 'range',
      clip: 6,
      cost: 100,
      kit: 'W',
      specials: ['Burst']
    };
    const w = weaponFromDef(def);
    expect(w.name).toBe('Test Blaster');
    expect(w.equipped).toBe(true);
    expect(w.stashed).toBe(false);
    expect(w.ammoLoaded).toBe(6);
    expect(w.ammoSpare).toBe(0);
    expect(w.specials).toEqual(['Burst']);
  });

  it('copies specials by value (mutations to result do not bleed back to catalog)', () => {
    const def: WeaponDef = {
      id: 'w2',
      name: 'W2',
      damage: 'd6',
      damageType: 'kinetic',
      slots: 1,
      range: 'melee',
      cost: 0,
      kit: 'W',
      specials: ['One']
    };
    const w = weaponFromDef(def);
    w.specials!.push('Two');
    expect(def.specials).toEqual(['One']);
  });

  it('returns empty [] for specials when catalog has none (never undefined)', () => {
    const def: WeaponDef = {
      id: 'w3',
      name: 'W3',
      damage: 'd6',
      damageType: 'kinetic',
      slots: 1,
      range: 'melee',
      cost: 0,
      kit: 'W',
      specials: []
    };
    const w = weaponFromDef(def);
    expect(w.specials).toEqual([]);
  });

  it('buildWeaponFromCatalog returns null for unknown id', () => {
    expect(buildWeaponFromCatalog('not-a-real-weapon')).toBeNull();
  });
});

describe('armorFromDef', () => {
  function armor(over: Partial<ArmorDef>): ArmorDef {
    return {
      id: 'jacket',
      name: 'Soft Jacket',
      strength: '',
      weakness: '',
      notes: '',
      slots: 1,
      cost: 25,
      weightRank: 1,
      primeOnly: false,
      ...over
    };
  }

  it('starts unequipped + unstashed and defaults isShield/isHelmet to false', () => {
    const a = armorFromDef(armor({}));
    expect(a.equipped).toBe(false);
    expect(a.stashed).toBe(false);
    expect(a.isShield).toBe(false);
    expect(a.isHelmet).toBe(false);
  });

  it('preserves explicit shield / helmet / primeOnly flags', () => {
    expect(armorFromDef(armor({ id: 's', name: 'Buckler', isShield: true })).isShield).toBe(true);
    expect(armorFromDef(armor({ id: 'h', name: 'Plate', primeOnly: true })).primeOnly).toBe(true);
  });

  it('buildArmorFromCatalog returns null for unknown id', () => {
    expect(buildArmorFromCatalog('not-real')).toBeNull();
  });
});

describe('gearFromDef', () => {
  it('routes backpack-named items to slot10 with 5 container slots', () => {
    const def: GearDef = { id: 'bp', name: 'Backpack', slots: 1, cost: 5 };
    const g = gearFromDef(def);
    expect(g.location).toBe('slot10');
    expect(g.isContainer).toBe(true);
    expect(g.containerSlots).toBe(5);
  });

  it('routes carrier-bot items to worn with 10 container slots', () => {
    const def: GearDef = { id: 'cb', name: 'Carrier Bot', slots: 1, cost: 200 };
    const g = gearFromDef(def);
    expect(g.location).toBe('worn');
    expect(g.containerSlots).toBe(10);
    expect(g.isContainer).toBe(true);
  });

  it('routes 0-slot gear to no_slot, non-zero-slot non-container to worn', () => {
    const noSlot: GearDef = { id: 'badge', name: 'ID Badge', slots: 0, cost: 1 };
    const worn: GearDef = { id: 'tool', name: 'Multi-Tool', slots: 1, cost: 5 };
    expect(gearFromDef(noSlot).location).toBe('no_slot');
    expect(gearFromDef(worn).location).toBe('worn');
    expect(gearFromDef(worn).isContainer).toBe(false);
  });

  it('mirrors notes "" when catalog notes absent (bind safety)', () => {
    const def: GearDef = { id: 'g', name: 'Thing', slots: 1, cost: 5 };
    const g = gearFromDef(def);
    expect(g.notes).toBe('');
  });

  it('buildGearFromCatalog returns null for unknown id', () => {
    expect(buildGearFromCatalog('not-real')).toBeNull();
  });
});

describe('kitFromDef', () => {
  function kit(over: Partial<KitDef>): KitDef {
    return {
      id: 'W',
      name: 'Weapon',
      slots: 1,
      cost: 50,
      buildableWithKit: null,
      ...over
    };
  }

  it('renames "M" → "Maker (M)" and "B" → "Blueprint (B)"', () => {
    expect(kitFromDef(kit({ id: 'M', name: 'Mechanic', slots: 0, cost: 200 })).name).toBe('Maker (M)');
    expect(kitFromDef(kit({ id: 'B', name: 'Blueprint', slots: 0, cost: 100 })).name).toBe('Blueprint (B)');
  });

  it('builds the kit name suffix from id for non-M/B kits', () => {
    expect(kitFromDef(kit({ id: 'W', name: 'Weapon', slots: 1, cost: 50 })).name).toBe('Weapon Kit (W)');
  });

  it('treats positive-slot kits as portable (worn) and 0-slot kits as storage/stashed', () => {
    const p = kitFromDef(kit({ id: 'W', name: 'Weapon', slots: 1 }));
    const f = kitFromDef(kit({ id: 'M', name: 'Maker', slots: 0 }));
    expect(p.location).toBe('worn');
    expect(p.stashed).toBe(false);
    expect(f.location).toBe('storage');
    expect(f.stashed).toBe(true);
  });

  it('annotates notes with the buildable-with kit if present, fallback otherwise', () => {
    expect(kitFromDef(kit({ id: 'W', name: 'Weapon', buildableWithKit: 'M' })).notes).toContain('Buildable with M');
    expect(kitFromDef(kit({ id: 'M', name: 'Maker', slots: 0, buildableWithKit: null })).notes).toContain('Not field-buildable');
  });
});

describe('vehicleFromDef', () => {
  function vehicle(over: Partial<VehicleDef>): VehicleDef {
    return {
      id: 'r',
      name: 'Roller',
      use: 'Ground travel',
      cost: 1000,
      energyPerDay: 2,
      category: 'vehicle',
      ...over
    };
  }

  it('stashes the vehicle and appends energy-per-day to notes when > 0', () => {
    const v = vehicleFromDef(vehicle({}));
    expect(v.location).toBe('storage');
    expect(v.stashed).toBe(true);
    expect(v.notes).toContain('Ground travel');
    expect(v.notes).toContain('2 e/day');
    expect(v.energyDraw).toBe('2e/d');
  });

  it('omits the energy clause when energyPerDay is 0', () => {
    const v = vehicleFromDef(vehicle({ id: 'b', name: 'Bike', use: 'Pedal', cost: 50, energyPerDay: 0 }));
    expect(v.notes).not.toMatch(/e\/day/);
    expect(v.energyDraw).toBeUndefined();
  });
});

describe('petFromDef', () => {
  it('stashes the pet and appends weekly upkeep to notes when > 0', () => {
    const def: PetDef = { id: 'z', name: 'Zotusk', use: 'Pack animal', cost: 200, upkeepPerWeek: 5 };
    const p = petFromDef(def);
    expect(p.stashed).toBe(true);
    expect(p.location).toBe('storage');
    expect(p.notes).toContain('Pack animal');
    expect(p.notes).toContain('upkeep 5 P/week');
  });

  it('skips the upkeep clause for upkeep 0', () => {
    const def: PetDef = { id: 'm', name: 'Monkey', use: 'Companion', cost: 50, upkeepPerWeek: 0 };
    expect(petFromDef(def).notes).not.toMatch(/upkeep/);
  });
});

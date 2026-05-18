/**
 * equipment.ts - Helpers to add a character item from one of the SW catalogs
 * (weapons / armor / gear / kits / vehicles / pets). Each helper:
 *   - Generates a fresh `id`.
 *   - Copies all relevant stat fields from the catalog entry.
 *   - Returns the freshly built item — caller appends it to the character.
 *
 * The catalog → character item shape is *almost* one-to-one but not quite:
 *   - WeaponDef → CharacterWeapon adds `equipped` (default true), drops
 *     ammoLoaded/ammoSpare seeds (player fills in).
 *   - ArmorDef → CharacterArmor preserves isShield/isHelmet/primeOnly flags
 *     and starts unequipped (player toggles).
 *   - GearDef / KitDef / VehicleDef / PetDef → EquipmentItem with sensible defaults
 *     for location/cost. Energy draw label is mirrored verbatim from
 *     `GearDef.energy` so the sheet shows e.g. "1e/d" or "1e/w" as-is.
 */

import type { WeaponDef, ArmorDef, GearDef, KitDef, VehicleDef, PetDef } from '$lib/data';
import { WEAPONS_DATA, ARMOR_DATA, GEAR_DATA } from '$lib/data';
import type { CharacterWeapon, CharacterArmor, EquipmentItem, EquipmentLocation } from '$lib/models';

/** Stable id helper — UUID where available, fallback for older runtimes. */
export function newItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a CharacterWeapon from a WEAPONS_DATA entry. Returns null if not found. */
export function buildWeaponFromCatalog(weaponId: string): CharacterWeapon | null {
  const def = WEAPONS_DATA.find((w) => w.id === weaponId);
  if (!def) return null;
  return weaponFromDef(def);
}

export function weaponFromDef(def: WeaponDef): CharacterWeapon {
  return {
    id: newItemId(),
    name: def.name,
    damage: def.damage,
    damageType: def.damageType,
    slots: def.slots,
    range: def.range,
    clip: def.clip,
    cost: def.cost,
    kit: def.kit,
    // Always emit a [] (not undefined) — WeaponEditor binds the joined
    // value via onchange; an undefined `specials` would render "" but
    // re-typing in the field would resurrect a stale slice from the
    // catalog comparison upstream. Keep the array as the source of truth.
    specials: def.specials.length > 0 ? [...def.specials] : [],
    notes: def.notes ?? '',
    equipped: true,
    stashed: false,
    // ammo seeded to "full clip loaded, no spare" so a freshly-picked
    // weapon is immediately usable in play.
    ammoLoaded: def.clip,
    ammoSpare: 0
  };
}

/** Build a CharacterArmor from an ARMOR_DATA entry. Returns null if not found. */
export function buildArmorFromCatalog(armorId: string): CharacterArmor | null {
  const def = ARMOR_DATA.find((a) => a.id === armorId);
  if (!def) return null;
  return armorFromDef(def);
}

export function armorFromDef(def: ArmorDef): CharacterArmor {
  // Catalog ArmorDef has optional isShield/isHelmet/notes fields; default to
  // safe primitives so the editor's `bind:checked` Toggle never sees
  // undefined (Svelte 5 $bindable(false) throws props_invalid_value).
  return {
    id: newItemId(),
    name: def.name,
    strength: def.strength,
    weakness: def.weakness,
    slots: def.slots,
    cost: def.cost,
    kit: def.kit,
    notes: def.notes ?? '',
    primeOnly: def.primeOnly,
    isShield: def.isShield ?? false,
    isHelmet: def.isHelmet ?? false,
    equipped: false,
    stashed: false
  };
}

/** Build an EquipmentItem from a GEAR_DATA entry. */
export function buildGearFromCatalog(gearId: string): EquipmentItem | null {
  const def = GEAR_DATA.find((g) => g.id === gearId);
  if (!def) return null;
  return gearFromDef(def);
}

export function gearFromDef(def: GearDef): EquipmentItem {
  // Default location: backpack-name items go to slot10, no-slot items
  // (slots === 0) go to no_slot, everything else worn. The player can
  // re-target after add. `notes` is always seeded as '' (catalog notes
  // mirrored verbatim) so the GearEditor TextArea bind doesn't see undefined.
  const isBackpackish = /backpack|valise/i.test(def.name);
  const isCarrierBot = /carrier bot/i.test(def.name);
  const defaultLocation: EquipmentLocation = isBackpackish ? 'slot10' : def.slots === 0 ? 'no_slot' : 'worn';
  const isContainer = isBackpackish || isCarrierBot;
  return {
    id: newItemId(),
    name: def.name,
    slots: def.slots,
    cost: def.cost,
    location: defaultLocation,
    equipped: true,
    stashed: false,
    isContainer,
    containerSlots: isCarrierBot ? 10 : isBackpackish ? 5 : 0,
    notes: def.notes ?? '',
    kit: def.kit,
    // Catalog energy is a free string ("1e/d", "2e/w", etc.); leave undefined
    // when absent so the editor doesn't display "" as if "no draw configured".
    energyDraw: def.energy
  };
}

export function kitFromDef(def: KitDef): EquipmentItem {
  const isPortable = def.slots > 0;
  const buildNote = def.buildableWithKit ? `Buildable with ${def.buildableWithKit} kit.` : 'Not field-buildable from a kit.';
  const notes = [def.notes, buildNote].filter(Boolean).join(' ');
  return {
    id: newItemId(),
    name: def.id === 'M' ? 'Maker (M)' : def.id === 'B' ? 'Blueprint (B)' : `${def.name} Kit (${def.id})`,
    slots: def.slots,
    cost: def.cost,
    location: isPortable ? 'worn' : 'storage',
    equipped: false,
    stashed: !isPortable,
    isContainer: false,
    containerSlots: 0,
    notes,
    kit: def.buildableWithKit ?? undefined
  };
}

/**
 * Vehicles & pets are stored as inventory items so they share the same
 * card chrome and slot/cost columns. We stash kind & energy/upkeep in
 * the notes field so the player can see them at a glance.
 */
export function vehicleFromDef(def: VehicleDef): EquipmentItem {
  const energyNote = def.energyPerDay > 0 ? ` · ${def.energyPerDay} e/day` : '';
  const baseNotes = def.notes ? `${def.notes} ` : '';
  return {
    id: newItemId(),
    name: def.name,
    slots: 0,
    cost: def.cost,
    location: 'storage',
    equipped: false,
    stashed: true,
    isContainer: false,
    containerSlots: 0,
    notes: `${baseNotes}${def.use}${energyNote}`,
    energyDraw: def.energyPerDay > 0 ? `${def.energyPerDay}e/d` : undefined
  };
}

export function petFromDef(def: PetDef): EquipmentItem {
  const upkeepNote = def.upkeepPerWeek > 0 ? ` · upkeep ${def.upkeepPerWeek} P/week` : '';
  const baseNotes = def.notes ? `${def.notes} ` : '';
  return {
    id: newItemId(),
    name: def.name,
    slots: 0,
    cost: def.cost,
    location: 'storage',
    equipped: false,
    stashed: true,
    isContainer: false,
    containerSlots: 0,
    notes: `${baseNotes}${def.use}${upkeepNote}`
  };
}

/**
 * Blank-slate weapon for the Custom tab. Sensible defaults for free entry.
 * IMPORTANT: every optional `string?` / `boolean?` field that the
 * WeaponEditor binds via `bind:value` / `bind:checked` to a
 * `$bindable('')` / `$bindable(false)` rune must be initialised to a
 * primitive — Svelte 5 throws props_invalid_value on undefined.
 */
export function blankWeapon(): CharacterWeapon {
  return {
    id: newItemId(),
    name: '',
    damage: 'd6',
    damageType: 'kinetic',
    slots: 1,
    range: 'range',
    cost: 0,
    equipped: true,
    stashed: false,
    notes: '',
    specials: []
  };
}

/** Blank-slate armor for the Custom tab. */
export function blankArmor(): CharacterArmor {
  return {
    id: newItemId(),
    name: '',
    strength: '',
    weakness: '',
    slots: 1,
    cost: 0,
    equipped: false,
    stashed: false,
    notes: '',
    isShield: false,
    isHelmet: false,
    primeOnly: false
  };
}

/** Blank-slate gear for the Custom tab. */
export function blankGear(): EquipmentItem {
  return {
    id: newItemId(),
    name: '',
    slots: 1,
    cost: 0,
    location: 'worn',
    equipped: true,
    stashed: false,
    isContainer: false,
    containerSlots: 0,
    notes: ''
  };
}

/** Format slots with units for display ("½ slot", "1 slot", "2 slots", "no slot"). */
export function formatSlots(slots: number): string {
  if (slots === 0) return 'no slot';
  if (slots === 0.5) return '½ slot';
  if (slots === 1) return '1 slot';
  return `${slots} slots`;
}

/** Format cost as Parts ("50 P", "—" for free / 0). */
export function formatCost(cost: number): string {
  if (!cost) return '—';
  return `${cost.toLocaleString()} P`;
}

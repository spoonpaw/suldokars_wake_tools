/**
 * gear.ts - Adventuring gear list (rules/26).
 */

import type { ConstructionKit } from '$lib/models/Enums';

export interface GearDef {
  id: string;
  name: string;
  slots: number; // 0 = no-slot
  cost: number; // Parts
  kit?: ConstructionKit;
  /** Energy draw label e.g. "1e/d", "1e/w", or empty. */
  energy?: string;
  notes?: string;
}

export const GEAR_DATA: GearDef[] = [
  { id: 'arrows_bolts', name: 'Arrows or Bolts (20)', slots: 1, cost: 8, kit: 'W' },
  { id: 'autocleaner', name: 'Autocleaner', slots: 1, cost: 50, kit: 'B' },
  { id: 'be_tools', name: 'B & E Tools', slots: 1, cost: 20, kit: 'T' },
  { id: 'backpack', name: 'Backpack (5 slots)', slots: 1, cost: 5, kit: 'G', notes: 'Uses 1 slot; holds 5 slots.' },
  { id: 'binoculars', name: 'Binoculars (HUD)', slots: 0.5, cost: 40, kit: 'B' },
  { id: 'camera_instagraphic', name: 'Camera (Instagraphic)', slots: 0.5, cost: 30, kit: 'B' },
  { id: 'carrier_bot', name: 'Carrier Bot (10 slots)', slots: 8, cost: 120, kit: 'B', energy: '1e/d' },
  { id: 'code_breaker', name: 'Code Breaker', slots: 0.5, cost: 180, kit: 'B' },
  { id: 'cube_recorder', name: 'Cube Recorder', slots: 1, cost: 20, kit: 'B', energy: '1e/w' },
  { id: 'cube_templates', name: 'Cube Templates (5)', slots: 0, cost: 2, kit: 'B' },
  { id: 'diving_full', name: 'Diving Equipment (Full)', slots: 5, cost: 150, kit: 'B' },
  { id: 'dynamite', name: 'Dynamite (5)', slots: 1, cost: 10, kit: 'W' },
  { id: 'eternal_paper', name: 'Eternal Paper', slots: 0, cost: 40, kit: 'M' },
  { id: 'first_aid_kit', name: 'First Aid Kit (5 uses)', slots: 0.5, cost: 2, kit: 'G' },
  { id: 'flares', name: 'Flares (5)', slots: 1, cost: 5, kit: 'W' },
  { id: 'flashlight', name: 'Flashlight', slots: 0.5, cost: 2, kit: 'G' },
  { id: 'folding_stick', name: 'Folding Stick', slots: 0.5, cost: 5, kit: 'B' },
  { id: 'food_water_5', name: 'Food & Water (5 days)', slots: 2, cost: 3 },
  { id: 'gas_mask', name: 'Gas Mask', slots: 0.5, cost: 20, kit: 'A' },
  { id: 'holo_hacker_iface', name: 'Holographic Hacker Interface', slots: 0, cost: 300, kit: 'M', energy: '1e/w' },
  { id: 'hook_wire', name: 'Hook & Wire (20 dots)', slots: 1, cost: 8, kit: 'T' },
  { id: 'info_visor', name: 'Info Visor', slots: 0.5, cost: 200, kit: 'B', energy: '1e/w' },
  { id: 'info_slate', name: 'Info Slate (general)', slots: 0.5, cost: 100, kit: 'B', energy: '1e/w' },
  { id: 'lighter', name: 'Lighter', slots: 0.5, cost: 5, kit: 'T' },
  { id: 'lockpicks', name: 'Lockpicks', slots: 0, cost: 60, kit: 'G' },
  { id: 'mag_kinetic', name: 'Mag (Kinetic, 5-shot)', slots: 0.5, cost: 3, kit: 'E' },
  { id: 'makeup', name: 'Make Up (beauty or disguise)', slots: 0.5, cost: 50, kit: 'G' },
  { id: 'map_slate', name: 'Map Slate (3D)', slots: 0.5, cost: 100, kit: 'B', energy: '1e/w' },
  { id: 'medical_bag', name: 'Medical Bag', slots: 1, cost: 60, kit: 'G' },
  { id: 'medifact_minor', name: 'Medifact (Minor)', slots: 0.5, cost: 25, kit: 'C' },
  { id: 'medifact_medium', name: 'Medifact (Medium)', slots: 0.5, cost: 40, kit: 'C' },
  { id: 'medifact_major', name: 'Medifact (Major)', slots: 0.5, cost: 75, kit: 'C' },
  { id: 'mini_guardbot', name: 'Miniature GuardBot', slots: 1, cost: 150, kit: 'B', energy: '1e/w' },
  { id: 'mirror', name: 'Mirror', slots: 0.5, cost: 1, kit: 'G' },
  { id: 'nav_heptant', name: 'Nav Equipment (Heptant)', slots: 0.5, cost: 30, kit: 'T' },
  { id: 'net', name: 'Net', slots: 1, cost: 8, kit: 'G' },
  { id: 'scroll_case', name: 'Scroll Case (10)', slots: 1, cost: 7, kit: 'G' },
  { id: 'short_wave_radio', name: 'Short Wave Radio', slots: 2, cost: 16, kit: 'G' },
  { id: 'sleeping_bag', name: 'Sleeping Bag', slots: 2, cost: 15, kit: 'G' },
  { id: 'stim_antidote', name: 'Stim (Antidote)', slots: 0.5, cost: 15, kit: 'M' },
  { id: 'stim_antirad', name: 'Stim (Antirad)', slots: 0.5, cost: 25, kit: 'M' },
  { id: 'stim_antibiotics', name: 'Stim (Antibiotics)', slots: 0.5, cost: 15, kit: 'M' },
  { id: 'stylo', name: 'Stylo (de Plume)', slots: 0, cost: 5, kit: 'G' },
  { id: 'tent', name: 'Tent', slots: 3, cost: 15, kit: 'G' },
  { id: 'toolbox', name: 'Tool-box (Various standard tools)', slots: 2, cost: 50, kit: 'T' },
  { id: 'traps', name: 'Traps', slots: 2, cost: 10, kit: 'T' },
  { id: 'travel_typewriter', name: 'Travel Typewriter', slots: 3, cost: 100, kit: 'B' },
  { id: 'valise', name: 'Valise (Suitcase, 5 slots)', slots: 1, cost: 15, kit: 'G' },
  { id: 'voice_simulator', name: 'Voice Simulator', slots: 0.5, cost: 120, kit: 'M', energy: '1e/w' },
  { id: 'water_flask', name: 'Water Flask', slots: 1, cost: 1, kit: 'G' },
  { id: 'weather_detector', name: 'Weather Detector', slots: 1, cost: 250, kit: 'B' },
  { id: 'wet_suit', name: 'Wet Suit', slots: 3, cost: 30, kit: 'B' }
];

/**
 * vehicles.ts - Vehicles, drones & helper bots (rules/27).
 */

export interface VehicleDef {
  id: string;
  name: string;
  use: string;
  cost: number;        // Parts; "k" notation handled in UI ("8k" → 8000).
  energyPerDay: number; // 0 = none / passive
  /** "vehicle", "drone", "bot". */
  category: 'vehicle' | 'drone' | 'bot';
  notes?: string;
}

export const VEHICLES_DATA: VehicleDef[] = [
  { id: 'cargo_exo', name: 'Cargo Exo', use: 'Load cargo', cost: 5000, energyPerDay: 2, category: 'vehicle' },
  { id: 'exo_skeleton', name: 'Exo-skeleton', use: 'Any, including fighting', cost: 10000, energyPerDay: 4, category: 'vehicle' },
  { id: 'float_barge', name: 'Float Barge', use: 'Heavy transports', cost: 2000, energyPerDay: 2, category: 'vehicle' },
  { id: 'solar_dingy', name: 'Solar Dingy', use: 'Personal transport', cost: 500, energyPerDay: 0, category: 'vehicle', notes: 'Solar.' },
  { id: 'solar_junk', name: 'Solar Junk', use: 'Trade, transports', cost: 8000, energyPerDay: 0, category: 'vehicle', notes: 'Solar.' },
  { id: 'submarine', name: 'Submarine', use: 'Exploration, hunting', cost: 500000, energyPerDay: 30, category: 'vehicle' },
  { id: 'walker', name: 'Walker', use: 'Riding machine', cost: 3000, energyPerDay: 5, category: 'vehicle' },
  { id: 'crawler', name: 'Crawler', use: 'Transportation, work', cost: 80000, energyPerDay: 10, category: 'vehicle' },
  { id: 'roller', name: 'Roller', use: 'Fast personal transports', cost: 2000, energyPerDay: 6, category: 'vehicle', notes: 'Mono-wheel antigrav.' },
  { id: 'copter_drone', name: 'Copter Drone', use: 'Standard propeller drone', cost: 200, energyPerDay: 1, category: 'drone' },
  { id: 'scorpion_drone', name: 'Scorpion Drone', use: 'Small, crawling drone', cost: 180, energyPerDay: 1, category: 'drone' },
  { id: 'eye_drone', name: 'Eye Drone', use: 'Surveillance drone', cost: 160, energyPerDay: 1, category: 'drone' },
  { id: 'spyfly', name: 'Spyfly (drone)', use: 'Spying drone', cost: 100, energyPerDay: 0, category: 'drone' },
  { id: 'carrier_bot_big', name: 'Carrier Bot', use: 'Cargo bot', cost: 300, energyPerDay: 3, category: 'bot' },
  { id: 'assistant_bot', name: 'Assistant Bot', use: 'Servant bot', cost: 400, energyPerDay: 2, category: 'bot' },
  { id: 'guardbot', name: 'Guardbot', use: 'Guard or attack bot', cost: 500, energyPerDay: 4, category: 'bot' },
  { id: 'recbot', name: 'Recbot', use: 'Reconnaissance bot', cost: 700, energyPerDay: 4, category: 'bot' }
];

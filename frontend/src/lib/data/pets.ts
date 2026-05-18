/**
 * pets.ts - Pet & riding/work animals (rules/28).
 */

export interface PetDef {
  id: string;
  name: string;
  use: string;
  cost: number; // Parts
  upkeepPerWeek: number; // Parts per week
  notes?: string;
}

export const PETS_DATA: PetDef[] = [
  {
    id: 'babel_bug',
    name: 'Babel Bug',
    use: 'Simple translations',
    cost: 200,
    upkeepPerWeek: 0,
    notes: 'Symbiont. Price doubles per extra known language.'
  },
  {
    id: 'monkey',
    name: 'Monkey',
    use: 'Pet, helper',
    cost: 110,
    upkeepPerWeek: 2,
    notes: 'Upkeep 1-3 P/W depending on workload.'
  },
  {
    id: 'ratxla',
    name: 'Ratxla',
    use: 'Pet, helper',
    cost: 50,
    upkeepPerWeek: 0,
    notes: 'Symbiont with XLA. Limited Palp communication.'
  },
  {
    id: 'riding_ostrich',
    name: 'Riding Ostrich',
    use: 'Fast riding animal',
    cost: 200,
    upkeepPerWeek: 3
  },
  {
    id: 'waku_waku',
    name: 'Waku-Waku',
    use: 'Sturdy work animal',
    cost: 300,
    upkeepPerWeek: 4
  },
  {
    id: 'zotusk',
    name: 'Zotusk',
    use: 'Smart riding animal',
    cost: 150,
    upkeepPerWeek: 3,
    notes: 'Smart fur lizards with tusks. Common with explorers.'
  },
  {
    id: 'babbophant',
    name: 'Babbophant',
    use: 'Immense work animal',
    cost: 800,
    upkeepPerWeek: 15,
    notes: 'Crossbreed look of elephant + baboon.'
  }
];

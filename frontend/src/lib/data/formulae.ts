/**
 * formulae.ts - Basic formulae from rules/21.
 *
 * Three-mode listing: Formula Name X, Alien Innate Y, Construct Built-In Z.
 * "-" means that mode does not exist for that formula. Zero-cost second/third
 * versions are permanent / at will.
 */

export interface BasicFormulaDef {
  id: string;
  name: string;
  /** H-cost when used as a normal scrolled / spaced formula. */
  formulaCost: string;
  /** Alien innate version label + cost (or null if unavailable). */
  alien?: { name: string; cost: string };
  /** Construct built-in version label + cost. */
  construct?: { name: string; cost: string };
  description: string;
}

export const BASIC_FORMULAE: BasicFormulaDef[] = [
  {
    id: 'analyze',
    name: 'Analyze',
    formulaCost: '2',
    construct: { name: 'Analyze', cost: '1' },
    description: 'Analyze nanites in another device, to know what it does and what it costs to use.'
  },
  {
    id: 'aquatic',
    name: 'Aquatic',
    formulaCost: '2',
    alien: { name: 'Gills & Fins', cost: '0' },
    construct: { name: 'Submode', cost: '1' },
    description: '1 turn of subsurface actions with regular movement and without the need for air.'
  },
  {
    id: 'bend_light',
    name: 'Bend Light',
    formulaCost: '2',
    construct: { name: 'Holoflage', cost: '2' },
    description:
      'Become invisible for 1 turn. Anyone fighting you rolls as a blind attacker. Moving: contest Morph vs. Speed; you double, searcher half.'
  },
  {
    id: 'bonds',
    name: 'Bonds',
    formulaCost: '2',
    alien: { name: 'Roots', cost: '1' },
    construct: { name: '(Force) Net', cost: '2' },
    description: 'Nanite or actual cords entangle and hold a victim for 3 rounds. A DN 20 Speed roll negates this effect.'
  },
  {
    id: 'build',
    name: 'Build',
    formulaCost: '3',
    construct: { name: 'Build', cost: '1' },
    description: 'Nanobots build anything that you have the parts for, without the needed kit.'
  },
  {
    id: 'carry',
    name: 'Carry',
    formulaCost: '1',
    alien: { name: 'Strong', cost: '0' },
    construct: { name: 'Carrier', cost: '0' },
    description: 'Get 5 extra equipment slots for 1 long turn.'
  },
  {
    id: 'decipher',
    name: 'Decipher',
    formulaCost: '1',
    construct: { name: 'Babel Function', cost: '0' },
    description: 'Babel function — read or listen to a foreign message, EXCEPT in Æonic.'
  },
  {
    id: 'detect_presence',
    name: 'Detect Presence',
    formulaCost: '1',
    alien: { name: 'Detect Presence', cost: '1' },
    construct: { name: 'Radar', cost: '1' },
    description: 'Detect the presence of moving objects or creatures within a 100-dot radius.'
  },
  {
    id: 'dot',
    name: 'DoT (Damage over Time)',
    formulaCost: '1',
    alien: { name: 'Poison', cost: '1' },
    construct: { name: 'Poison', cost: '1' },
    description: 'Give a victim 1 point of damage per round, for d10 rounds. A Bulk roll halves the duration.'
  },
  {
    id: 'force_armor',
    name: 'Force Armor',
    formulaCost: '1',
    alien: { name: 'Leather', cost: '0' },
    construct: { name: 'Tank Armor', cost: '0' },
    description: 'Get these armor types as Armor 2, in addition to other armor.'
  },
  {
    id: 'heal',
    name: 'Heal',
    formulaCost: '1',
    alien: { name: 'Heal', cost: '1' },
    construct: { name: 'Stim', cost: '1' },
    description: 'Remove physical harm by d6 points.'
  },
  {
    id: 'iron_fist',
    name: 'Iron Fist',
    formulaCost: '1',
    alien: { name: 'Claw & Fang', cost: '0' },
    construct: { name: 'Melee Boost', cost: '0' },
    description: 'Step damage up one step when fighting unarmed.'
  },
  {
    id: 'levitate',
    name: 'Levitate',
    formulaCost: '2',
    alien: { name: 'Wings', cost: '0' },
    construct: { name: 'Rockets', cost: '1' },
    description: 'Three rounds of regular movement — in the air.'
  },
  {
    id: 'make_a_log',
    name: 'Make a Log',
    formulaCost: '2',
    alien: { name: 'Memory', cost: '1' },
    construct: { name: 'Log Files', cost: '0' },
    description: 'Your thoughts write a photographic log to revisit later.'
  },
  {
    id: 'open_lock',
    name: 'Open Lock',
    formulaCost: '2',
    construct: { name: 'Unikey', cost: '1' },
    description: 'Open any mechanical or electronic lock with max DN 20. Nanite locks may succeed but pay ed6 extra Harm.'
  },
  {
    id: 'purify',
    name: 'Purify',
    formulaCost: '1',
    alien: { name: 'Omnivore', cost: '0' },
    construct: { name: 'Purify', cost: '1' },
    description: 'Process 1 meal to make it safe to consume.'
  },
  {
    id: 'resistance',
    name: 'Resistance',
    formulaCost: '1',
    alien: { name: 'Resistance', cost: '0' },
    construct: { name: 'Resistance', cost: '0' },
    description: 'Gain resistance for 1 hour against heat, cold, radiation, or disease (choose each use).'
  },
  {
    id: 'send_thought',
    name: 'Send Thought',
    formulaCost: '1',
    alien: { name: 'Telepathy', cost: '1' },
    description: 'Send 1 round of thoughts to a person you know or can see (beyond visual +1 H).'
  },
  {
    id: 'shape_change',
    name: 'Shape Change',
    formulaCost: '2',
    alien: { name: 'Shape Change', cost: '1' },
    construct: { name: 'Shape Change', cost: '2' },
    description: 'Disguise as another humanoid of similar size; Morph reveals on investigation.'
  },
  {
    id: 'sleep',
    name: 'Sleep',
    formulaCost: '1',
    alien: { name: 'Sleep Spores', cost: '1' },
    construct: { name: 'Sleep Powder', cost: '1' },
    description: 'Put everyone in a room to sleep. Victims roll Ghost to negate.'
  },
  {
    id: 'split_space',
    name: 'Split Space',
    formulaCost: '1',
    construct: { name: 'Neural Overclock', cost: '1' },
    description: 'Split a space in two for 1 turn; afterwards reverts and the original space is used for the day.'
  },
  {
    id: 'spot_eyes',
    name: 'Spot Eyes',
    formulaCost: '1',
    construct: { name: 'Spot Lights', cost: '0' },
    description: 'Your eyes function like flashlights for 1 turn.'
  },
  {
    id: 'sound_wave',
    name: 'Sound Wave',
    formulaCost: '1',
    alien: { name: 'Sound Wave', cost: '1' },
    construct: { name: 'Sound Wave', cost: '1' },
    description: 'Make a 10-dot cone infrasonic attack, doing d6 damage.'
  },
  {
    id: 'telekinesis',
    name: 'Telekinesis',
    formulaCost: '1',
    alien: { name: 'Reach', cost: '0' },
    construct: { name: 'Telekinesis', cost: '2' },
    description: 'Grab and handle something from 40 ft away as if with your hands.'
  },
  {
    id: 'virtual_map',
    name: 'Virtual Map',
    formulaCost: '1',
    alien: { name: 'Sonar', cost: '1' },
    construct: { name: 'Sonar', cost: '1' },
    description: 'Sense the closest stair, elevator, or exit at 100-dot radius.'
  }
];

/**
 * lifeforms.ts - Life-form bonuses and rules (rules/18 PDF body).
 *
 * - Bloods: 4 stacks +2, 2 stacks +1, +2 Close, +2 Ranged.
 * - Aliens (palp / amphibious): 2 stacks +2, 4 stacks +1, +2 Close, +2 Ranged.
 *   Plus innate features and an innate formula at -1 H.
 * - Tank Born: 1 stack set/cap to 8 (Archive | Bulk | Morph), 5 stacks +1,
 *   +2 to Close OR Ranged.
 * - Constructs:
 *   - Droid → 4 stacks +2, two special, +1 Close, +1 Ranged.
 *     Tech set to 8, Ghost set to 3 (disregarding initial roll + bg).
 *   - Holid → same baseline; Archive set 7, starting Ghost set 4.
 */

import type { LifeForm, PrimaryStack } from '$lib/models/Enums';

export interface LifeFormDef {
  id: LifeForm;
  label: string;
  group: 'blood' | 'alien' | 'tank_born' | 'construct';
  blurb: string;
  /** Multi-paragraph narrative description from rules/18 body text. */
  description: string;
  /** Bonus summary string for headers ("(Two stacks +2, four stacks +1, ...)"). */
  bonusSummary: string;
  /** "+2 stacks" -> count, "+1 stacks" -> count for the player to assign. */
  plus2Count: number;
  plus1Count: number;
  closeBonus: number;
  rangedBonus: number;
  /** Either both — or pick one. */
  combatBonusMode: 'both' | 'either';
  /** Stacks set to specific values (overrides rolls). */
  stackSets?: Partial<Record<PrimaryStack, number>>;
  /** True if player must pick which stack to set/cap to 8 (Tank Born). */
  pickCapStack?: boolean;
  capStackOptions?: PrimaryStack[];
  capValue?: number;
  /** Special properties / quick notes for the UI. */
  notes: string[];
  /** Mandatory languages this life-form must take alongside Pidgin. */
  mandatoryLanguages?: string[];
  /** Body / fiction notes (food, sleep, maintenance, etc.). */
  fictionNotes?: string[];
  /** Whether this life-form rolls a d12 on the alien res/vuln + feature tables. */
  rollsAlienTables?: boolean;
}

export const LIFE_FORMS_DATA: LifeFormDef[] = [
  {
    id: 'blood',
    label: 'Blood',
    group: 'blood',
    blurb: 'Future descendants of Earth-stock humans. The norm on Zira-Ka.',
    description:
      "The character's life-form defaults to 'blood' — a future descendant of man, with little heritage from other species. Bloods come in all shapes, colors and cultures. They dominate in most contexts all over the planet, except underground, where the Great Mycelium, horroms and ptilians have their domains. Most implants are made for bloods, making stack improvement easier than for other life-forms except droids. There are numerous and competing accounts of the history of the blood species, and Earth does figure in a few of them.",
    bonusSummary: '(Four stacks +2, two stacks +1, +2 to Close and Ranged)',
    plus2Count: 4,
    plus1Count: 2,
    closeBonus: 2,
    rangedBonus: 2,
    combatBonusMode: 'both',
    notes: [
      '+2 to four stacks, +1 to two stacks (player assigns).',
      'Most implants designed for bloods — easiest to upgrade.'
    ]
  },
  {
    id: 'palp_alien',
    label: 'Palp Alien',
    group: 'alien',
    blurb: 'Hair is in fact thin palps. Speaks Palp.',
    description:
      "The 'alien' denomination originates in a xenophobic blood perspective, but this large minority has long since made it its own and uses it interchangeably with 'k'lsixla' — meaning 'tainted with the XLA' in a long forgotten proto-Imperial dialect. Aliens look like bloods in most respects, but their bodies live in symbiosis with the alien species XLA. The Palp Alien's hair is in fact thin palps, clearly visible if you come close. The character speaks Palp.",
    bonusSummary: '(Two stacks +2, four stacks +1, +2 to Close and Ranged)',
    plus2Count: 2,
    plus1Count: 4,
    closeBonus: 2,
    rangedBonus: 2,
    combatBonusMode: 'both',
    rollsAlienTables: true,
    mandatoryLanguages: ['palp'],
    notes: [
      'Hair = palps; visible up close.',
      'Knows Palp language as second language.',
      'One innate formula at 1 H lower cost (mental ability or physical fit).',
      'Roll d12 twice for one resistance + one vulnerability.',
      'Roll d12 once for an alien feature.',
      'Trouble finding implants that fit; shunned in blood high society.'
    ]
  },
  {
    id: 'amphibious_alien',
    label: 'Amphibious Alien',
    group: 'alien',
    blurb: "Gills, webbing, scaled skin. Speaks K'lsixla. Needs water.",
    description:
      "The Amphibious Alien has gills on the sides of the neck, webbing and scaled skin. She can breathe under water and needs to do so at least one half hour per day or become lethargic (only clean rolls) and pass out into a coma in d days. Aliens look like bloods in most respects but live in symbiosis with the XLA, resulting in physical variations.",
    bonusSummary: '(Two stacks +2, four stacks +1, +2 to Close and Ranged)',
    plus2Count: 2,
    plus1Count: 4,
    closeBonus: 2,
    rangedBonus: 2,
    combatBonusMode: 'both',
    rollsAlienTables: true,
    mandatoryLanguages: ['klsixla'],
    notes: [
      'Breathes underwater.',
      'Needs at least ½ hour underwater per day or risks lethargy and coma in d days.',
      "Knows K'lsixla as second language.",
      'One innate formula at 1 H lower cost.',
      'Roll d12 twice for one resistance + one vulnerability.',
      'Roll d12 once for an alien feature.',
      'Trouble finding implants that fit; shunned in blood high society.'
    ]
  },
  {
    id: 'tank_born',
    label: 'Tank Born',
    group: 'tank_born',
    blurb: 'Sterile bloods, bio-engineered Thaldean servants.',
    description:
      'Tank born are sterile bloods and originate in the Thaldo period some 700 years back, when the great Arcanists bio-engineered their servants. All have one of three enhancements — Archive, Bulk or Morph — set and capped at 8 with a corresponding appearance: oversized head, very tall and muscular, or huge eyes and long neck (the utmost trait of beauty by Thaldean standards). Tank born age but can rejuvenate if they find a tank in a working bio-growth facility. The process affects memory asymmetrically — areas beyond a century back are patchy at best. There is a strong sense of kinship amongst the tank born, perhaps because their life-form is the only biologic family they have and will ever get.',
    bonusSummary: '(One stack 8, five stacks +1, +2 to Close OR Ranged)',
    plus2Count: 0,
    plus1Count: 5,
    closeBonus: 0,
    rangedBonus: 0,
    combatBonusMode: 'either',
    pickCapStack: true,
    capStackOptions: ['archive', 'bulk', 'morph'],
    capValue: 8,
    fictionNotes: [
      'Cap stack: oversized head (Archive), very tall/muscular (Bulk), or huge eyes + long neck (Morph).',
      'Implants cannot raise the capped stack; some implants might lower it as side-effect.',
      'May rejuvenate at a working bio-growth facility.'
    ],
    notes: [
      'One of Archive/Bulk/Morph set and capped at 8.',
      '+1 to five stacks (player assigns).',
      'Pick +2 Close OR Ranged (not both).',
      'Strong sense of kinship; can rejuvenate at a tank facility.',
      'Memories beyond ~century back are patchy.'
    ]
  },
  {
    id: 'droid',
    label: 'Droid',
    group: 'construct',
    blurb: 'Free machine. Powered by 2 e per day + 2 hours maintenance.',
    description:
      'Droids are free machines that became sentient. They are functionally equivalent to bloods — they can move on land, talk, manipulate things with hands. They have one construct adaptation of a formula and up to three built-in tools (one may be a weapon, total worth ≤ 50 Parts). They date their birth to the moment they became sentient and free. Memories beyond hardware-storage limits get compressed in the most unsentimental way. Implants for droids are mechanical upgrades and comparatively easy to find.',
    bonusSummary: '(Four stacks +2, two special, +1 to Close and Ranged)',
    plus2Count: 4,
    plus1Count: 0,
    closeBonus: 1,
    rangedBonus: 1,
    combatBonusMode: 'both',
    stackSets: { tech: 8, ghost: 3 },
    mandatoryLanguages: ['al_gol'],
    fictionNotes: [
      'Need 2 e + 2 hours maintenance per day (works like food and sleep — can be postponed somewhat).',
      'Construct Inspiration: original purpose (Servant / Guide / Worker / Exploration / War / Pleasure / Companion / Scout / Science / Janitor); how optimized; what has happened since (re-fitted / re-purposed / broken / hacked / etc.).'
    ],
    notes: [
      'Tech set to 8, Ghost set to 3 (overrides roll + background).',
      '+1 to Close and Ranged.',
      'Need 2 e + 2 hours maintenance daily.',
      'Double rolls vs. harm.',
      'Immune to suffocation, poison, disease.',
      'Vulnerable to energy weapons.',
      'Must pass a Ghost roll before deliberately hurting bloods.',
      'One construct-adapted formula + up to 3 built-in tools (≤ 50 P total).',
      'Mandatory language: Al-Gol. Krypotkep can only be a third construct language.'
    ]
  },
  {
    id: 'holid',
    label: 'Holid',
    group: 'construct',
    blurb: 'Solid hologram, free since HoloH liberated her code.',
    description:
      "Holids are holograms turned solid through the influence of HoloH. They run off code stored in HoloH itself ('deep code'). They look stylized — almost always blood-like, but alien or tank born looks aren't out of the question. Functionally equivalent to bloods. Have one construct adaptation of a formula and up to three built-in tools (≤ 50 P total). Like droids, they date their birth to the moment they became sentient and free. Implants are 'hacks' — hard-to-find software upgrades.",
    bonusSummary: '(Four stacks +2, two special, +1 to Close and Ranged)',
    plus2Count: 4,
    plus1Count: 0,
    closeBonus: 1,
    rangedBonus: 1,
    combatBonusMode: 'both',
    stackSets: { archive: 7, ghost: 4 },
    mandatoryLanguages: ['al_gol'],
    fictionNotes: [
      'Need 2 hours daily re-compile (works like sleep) + a holofield.',
      'HoloH is moody (weather-like effects), can be shielded, can become non-solid; rare portable field generators exist.',
      'Construct Inspiration: original purpose (Preacher / Teacher / Doctor / Guard / Librarian / Host / Journalist / Monitor / Psychologist / Clerk / Dancer); how transformation has affected it.'
    ],
    notes: [
      'Archive set to 7, starting Ghost set to 4 (overrides roll + background).',
      '+1 to Close and Ranged.',
      'Need 2 hours daily re-compile + a holofield.',
      'Resistant to regular physical damage (only disturbs the forces making them solid).',
      'Immune to suffocation, poison, disease; vulnerable to energy.',
      'Implants are "hacks" — software upgrades, hard to find.',
      'One construct-adapted formula + up to 3 built-in tools (≤ 50 P total).',
      'Mandatory language: Al-Gol. Krypotkep can only be a third construct language.'
    ]
  }
];

export function getLifeForm(id: LifeForm): LifeFormDef {
  const found = LIFE_FORMS_DATA.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown life-form ${id}`);
  return found;
}

export const ALIEN_RES_VULN_TABLE: { roll: number; effect: string }[] = [
  { roll: 1, effect: 'Heat' },
  { roll: 2, effect: 'Cold' },
  { roll: 3, effect: 'Energy' },
  { roll: 4, effect: 'Mental' },
  { roll: 5, effect: 'Poison' },
  { roll: 6, effect: 'Disease' },
  { roll: 7, effect: 'Acid' },
  { roll: 8, effect: 'Fear' },
  { roll: 9, effect: 'Death' },
  { roll: 10, effect: 'Light' },
  { roll: 11, effect: 'Sound' },
  { roll: 12, effect: 'Radiation' }
];

export const ALIEN_FEATURE_TABLE: { roll: number; feature: string }[] = [
  { roll: 1, feature: 'Very powerful bones.' },
  { roll: 2, feature: 'Extra joints.' },
  { roll: 3, feature: 'Curved spine.' },
  { roll: 4, feature: 'Impossibly thin or fat.' },
  { roll: 5, feature: 'Very protruding jaw.' },
  { roll: 6, feature: 'Three-digit hands.' },
  { roll: 7, feature: 'No nostrils or no nose.' },
  { roll: 8, feature: 'Slit ears or huge ears.' },
  { roll: 9, feature: 'Huge eyes or glowing eyes.' },
  { roll: 10, feature: 'Slightly translucent skull.' },
  { roll: 11, feature: 'Deep wrinkles everywhere.' },
  { roll: 12, feature: 'Moving birthmarks.' }
];

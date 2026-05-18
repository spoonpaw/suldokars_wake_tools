/**
 * types.ts - Apt / Core / Prime narrative + mechanical reference data.
 *
 * Sourced from rules/18-sw-types.md body text. Used by the TypeInfoPanel
 * component to display the full type entry alongside the type-graph view.
 *
 * The data here is paraphrased into bulleted mechanical rules; the
 * narrative `description` and `tagline` are short summaries written to
 * read clean in a card. The type-graph node table itself lives in
 * `typeGraphs.ts`.
 */

import type { CharacterType } from '$lib/models/Enums';

export interface TypeOrigoSummary {
  spaces: number;
  implants: number;
  shadow: number;
  gunta: number;
  closeStart: number;
  rangedStart: number;
}

export interface TypeBondOption {
  id: 'holoh' | 'nanite_cloud' | 'subspace_nanites';
  label: string;
  /** Short narrative + mechanical summary. */
  description: string;
  /** Bullet list of mechanical rules unique to this bond (rules/18). */
  mechanics: string[];
  /** Optional sub-section — used for Beginner Cloud (under Nanite Cloud bond). */
  subSection?: {
    title: string;
    intro?: string;
    bullets: string[];
  };
}

export interface TypeDef {
  id: CharacterType;
  label: string;
  /** One-line tagline ("Expertise & equipment" / etc.). */
  tagline: string;
  /** Multi-paragraph narrative description from rules/18 intro. */
  description: string;
  /** Origo body-text values (rules/18). */
  origo: TypeOrigoSummary;
  /** Bullet list of mechanical rules / abilities for this type. */
  rules: string[];
  /** Examples of typical archetypes for this type. */
  examples: string[];
  /** Core-only — bond options. Empty for Apt / Prime. */
  bonds?: TypeBondOption[];
  /** Spaces-content kind (what fills a space slot for this type). */
  spaceContent: string;
  /** What the spaces let the character do. */
  spacesDoWhat: string;
}

export const APT_TYPE: TypeDef = {
  id: 'apt',
  label: 'Apt',
  tagline: 'Expertise & equipment',
  description:
    'Apt characters learn more from their training than the other character types do and can make better use of their equipment, familiar places, pets and helper droids. They are sought after for their expertise and prowess and are considered important assets in faction wars. A typical Apt character could be a techno-scavenger, a shadow cult assassin or a desert trader.',
  origo: {
    spaces: 1,
    implants: 1,
    shadow: 0,
    gunta: 0,
    closeStart: 0,
    rangedStart: 1
  },
  rules: [
    'Player picks which of Close or Ranged starts at 1 (the other starts at 0).',
    'Can only use Force Armor or lighter — heavier armor disables the abilities and bonuses below (penalties still apply).',
    'When using heavy weapons (3 slots or more) the highest Ranged score they benefit from is 3 — unless operating a stationary weapon or a weapon device based on a primary stack roll.',
    'Increased crit chance: rolls of 19 AND 20 both count as critical successes.',
    'When building things, Apt characters use half the parts.',
    'Can space 1 H scrolls and use them at the cost of 2 H.',
    'May pre-install one implant via Artistic Modification at character generation (with a drawback).'
  ],
  examples: ['Techno-scavenger', 'Shadow cult assassin', 'Desert trader'],
  spaceContent: 'Equipment, masters, places, or pets.',
  spacesDoWhat:
    'Once per 24 hours, treat a stack as if it were on an adjacent higher scale for a single action — when the space content relates to that action. Lowers the DN significantly.'
};

export const CORE_TYPE: TypeDef = {
  id: 'core',
  label: 'Core',
  tagline: 'Nanites & mysteries',
  description:
    "Whether going about it in a mystical, meta-scientific or technological way, Core characters are all about the mysteries of Zira-Ka, about the planet's inner workings and about directing nanites. Typical Core examples are the cloud charmer, the holid hacker or the mystic cultist.",
  origo: {
    spaces: 1,
    implants: 0,
    shadow: 0,
    gunta: 0,
    closeStart: 0,
    rangedStart: 0
  },
  rules: [
    'Can only use Force Armor or lighter — heavier armor interferes with nanite manipulation (formulae and cloud negotiations cost double).',
    'Half rolls with weapons that take up more than 1 slot.',
    'Each space stores a regular formula, usable any number of times at the indicated H-cost. Each space can also hold one inactive formula. Switching active takes a long turn of concentration.',
    'Subspace formulae require the Subspace Nanites bond.',
    'Switch bond at any black-fill node on the type graph.',
    'Recover nanite harm at twice the normal rate.',
    'Roll double vs. hostile formulae and mind effects.'
  ],
  examples: ['Cloud charmer', 'Holid hacker', 'Mystic cultist'],
  bonds: [
    {
      id: 'holoh',
      label: 'The HoloH',
      description:
        'Bond with the ancient holofield that pervades Zira-Ka. The character senses a guiding presence — a force, destiny, luck, an aiding god or ancestor — that helps her hand and mind. Why is up to her interpretation.',
      mechanics: [
        'Easier access to cybersystems, computer systems, and electronic facilities — access may be spontaneous, exclusive, or simply more likely than for others.',
        'Chance of awaking dead artifacts.',
        'Can go places, learn things, and use artifacts that others cannot.',
        'After failing yourself on one of the above kinds of actions, retrying becomes a clean roll (unless otherwise stated).'
      ]
    },
    {
      id: 'nanite_cloud',
      label: 'A Nanite Cloud',
      description:
        'Bond with a sentient cluster of nanites. The character starts bonded to a beginner cloud (AI-roleplayed). She can find and bond with a major cloud later in play — each is individual (a degraded non-solid hologram, an orug soul, a fragment of a destroyed SAI, an evolved beginner cloud, etc.).',
      mechanics: [
        'Starts with a Beginner Cloud (see below) — usually invisible, communicates via mood-driven sparks.',
        'May find and bond with a Major Cloud once play begins. The Beginner Cloud merges with the Major Cloud to seal the deal.',
        'Breaking with a Major Cloud reemerges the Beginner Cloud.',
        'Switching bond type (HoloH or Subspace) makes the Beginner Cloud disappear; it may return at a future black node if you re-bond Nanite Cloud.'
      ],
      subSection: {
        title: 'Beginner Cloud (rules/18)',
        intro:
          'The simplest usable cloud — emerged spontaneously from the nanite-saturated atmosphere. AI roleplays it. Usually invisible; can do three things:',
        bullets: [
          'Appear as a candle-bright spark (free). Moves with the character; takes on different colors, jumps agitatedly, dims/brightens — its mood-language.',
          'Sense nearby (100 dots) larger clouds AND identify scrolls or cans (1 H). Identifying a scroll/can needs a clean DN 10 roll — a fumble destroys the item.',
          'Taunt a larger cloud (free). Makes the larger cloud visible and bondable per its individual description.'
        ]
      }
    },
    {
      id: 'subspace_nanites',
      label: 'Subspace Nanites',
      description:
        'Bond with a special type of nanite. Grants access to quirkier, often more powerful formulae others cannot use.',
      mechanics: [
        'Unlocks subspace formulae (rules/22) — usable any number of times at the indicated H-cost.',
        'Subspace nanites may occasionally also boost ordinary formulae — when applicable, the boost is specified in the individual formula description.',
        'Without this bond, subspace formulae are inaccessible (or pay the rare unbonded cost when listed).'
      ]
    }
  ],
  spaceContent: 'Basic formulae (any regular formula).',
  spacesDoWhat:
    'Each space holds one active formula usable any number of times at its H-cost; can also hold one inactive formula (swap active = long turn of concentration). Subspace formulae require the Subspace Nanites bond.'
};

export const PRIME_TYPE: TypeDef = {
  id: 'prime',
  label: 'Prime',
  tagline: 'Combat & physique',
  description:
    "Prime characters aren't afraid of conflict and tend to solve problems by standing fast, taking what harm comes their way and removing any obstacle by force — at least if necessary. A typical Prime character could be a Tank Born Mob Enforcer, a Droid Ex-Factory Worker or an Archivist Death Collector.",
  origo: {
    spaces: 1,
    implants: 0,
    shadow: 0,
    gunta: 0,
    closeStart: 1,
    rangedStart: 1
  },
  rules: [
    'Can use any armor and any weapon.',
    'Once per combat: get two attacks in place of one.',
    'Can protect a nearby ally by taking all attacks against her for one round (enemies get Speed rolls to avoid it).',
    'Double Bulk vs. poison and disease, double Ghost vs. death, double rolls vs. any attack that allows a counter-action roll.',
    'Can act as normal while injured but get half rolls for everything; if harmed while already injured, gets a regular Ghost roll instead of dying immediately, and on failed death-Ghost dies in d20 minutes (not rounds).',
    'When the Prime takes down an enemy single-handedly, she can place the memory in one of her spaces.',
    "Some enemies have transferable nanite abilities — on the Prime's killing blow, those abilities may transfer to one of her spaces."
  ],
  examples: ['Tank Born Mob Enforcer', 'Droid Ex-Factory Worker', 'Archivist Death Collector'],
  spaceContent: 'Bested-enemy memories (filled during play).',
  spacesDoWhat:
    "Call upon a memory once per 24 hours, in a way relating to the specifics of the enemy or fight, to: treat a stack score as if it were 9, raise damage 1 step, or make a Bulk roll instead of a clean roll vs. harm. Some enemies' nanite abilities transfer on killing blow — once per 24 h, in a manner specified by the enemy entry."
};

export const TYPES_DATA: TypeDef[] = [APT_TYPE, CORE_TYPE, PRIME_TYPE];

export const TYPES_MAP: Record<CharacterType, TypeDef> = {
  apt: APT_TYPE,
  core: CORE_TYPE,
  prime: PRIME_TYPE
};

export function getType(id: CharacterType): TypeDef {
  return TYPES_MAP[id];
}

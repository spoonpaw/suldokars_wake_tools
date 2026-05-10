/**
 * subspaceFormulae.ts - Subspace formulae from rules/22.
 *
 * Subspace formulae are mostly Core-only with the subspace nanites bond.
 * Bracketed costs are the rare cost any other character pays without the bond.
 */

export interface SubspaceFormulaDef {
  id: string;
  name: string;
  /** Core / subspace-bonded cost. */
  bondedCost: string;
  /** Non-Core / non-bonded fallback cost (if usable at all). */
  unbondedCost?: string;
  description: string;
}

export const SUBSPACE_FORMULAE: SubspaceFormulaDef[] = [
  {
    id: 'commune_orug_spirit',
    name: 'Commune with Orug Spirit',
    bondedCost: '4',
    description:
      'Summons a long-dead orug spirit to talk to. Targeted spirit raises cost to ed6+2.'
  },
  {
    id: 'detect_shadow',
    name: 'Detect Shadow',
    bondedCost: '2',
    unbondedCost: '2ed6',
    description: 'Detect shadow creatures within a hundred-dot radius.'
  },
  {
    id: 'hack_insurance',
    name: 'Hack Insurance',
    bondedCost: '3',
    unbondedCost: '3ed6',
    description:
      'An existing insurance pattern or strand can be hacked to back up someone else; Maker roll shifted up once.'
  },
  {
    id: 'identify_aeonic',
    name: 'Identify Æonic',
    bondedCost: '2',
    description: 'Identifies any nanite functions in an æonic object (subspace-based).'
  },
  {
    id: 'imprint_soul',
    name: 'Imprint Soul',
    bondedCost: 'd6+3',
    description: 'Someone\'s existence imprinted on an empty Zyu Maker strand — serves as insurance.'
  },
  {
    id: 'mend_plant',
    name: 'Mend Plant',
    bondedCost: '2',
    description: 'Mend a plant just like you were mending a mechanical item.'
  },
  {
    id: 'mend_strand',
    name: 'Mend Strand',
    bondedCost: '3',
    description: 'Mend a broken Maker strand.'
  },
  {
    id: 'open_zyu_seal',
    name: 'Open Zyu Seal',
    bondedCost: '3',
    unbondedCost: '3ed6',
    description: 'Opens any seal from the Zyu era, regardless of difficulty.'
  },
  {
    id: 'predict_holoh',
    name: 'Predict HoloH',
    bondedCost: '2',
    description:
      "Tells the character about upcoming changes in HoloH's mood. AI rolls and tells the player."
  },
  {
    id: 'protect_colossus',
    name: 'Protection from Colossus',
    bondedCost: '1',
    description: 'Makes it impossible for a colossus to hurt the target — even by mistake — for 2 rounds.'
  },
  {
    id: 'protect_shadow',
    name: 'Protection from Shadow',
    bondedCost: '1',
    unbondedCost: '3ed6',
    description: 'User gets double rolls vs. shadow effects for 1 turn.'
  },
  {
    id: 'project_mainframe',
    name: 'Project Mainframe',
    bondedCost: '3',
    description:
      'Projects a mainframe OS as a non-solid hologram of the AI\'s choosing — interactable, in original language.'
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    bondedCost: 'ed6',
    description: 'Regenerate lost limbs and organs — except heart and brain.'
  },
  {
    id: 'sunder_metal',
    name: 'Sunder Metal',
    bondedCost: 'ed6',
    description: 'Break any metal object of blood-size or less, warped as if by colossus claws.'
  },
  {
    id: 'track_hologram',
    name: 'Track Hologram',
    bondedCost: '3',
    description: 'Track a non-solid hologram for a long turn (HoloH decides what tracks look like).'
  },
  {
    id: 'visualize',
    name: 'Visualize',
    bondedCost: 'd6',
    description:
      'Visualize a person or place that you have seen before, at the present time. Visualize past = 2ed6.'
  }
];

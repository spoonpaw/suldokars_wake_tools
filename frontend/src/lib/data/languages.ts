/**
 * languages.ts - Language list (rules/20).
 *
 * Pidgin is universal. Each character picks one second language by life-form
 * default, then rolls d3; on a 3 they get a third language of choice.
 */

import type { Language, LifeForm } from '$lib/models/Enums';

export interface LanguageDef {
  id: Language;
  name: string;
  /** "Trade", "Imperial", "Machine", etc. */
  family: string;
  /**
   * Brief one-line description (rules/20). Surfaced in view + edit mode
   * so the player can recognize a language by what it is, not just its id.
   */
  description: string;
  /** Sample names from the language (people, places). Optional. */
  sampleNames?: string[];
  /** Extra notes — restrictions, oddities, etc. Surfaced when present. */
  note?: string;
  /** Mechanical pick restrictions (rules/20). */
  restriction?: {
    /** Only available to life-forms in this group (e.g. 'construct'). */
    lifeFormGroup?: 'construct';
    /** Only pickable as the THIRD language slot (after the d3=3 unlock). */
    thirdSlotOnly?: boolean;
  };
}

export const LANGUAGES_DATA: LanguageDef[] = [
  {
    id: 'pidgin',
    name: 'Pidgin',
    family: 'Trade',
    description: 'Trade language spoken by almost all intelligent beings.',
    sampleNames: ['Sura', 'Onde', 'Gil', 'Kosmo', 'Sal', 'Stratah', 'Esh', 'Nira', 'Din']
  },
  {
    id: 'vatori',
    name: 'Vatori',
    family: 'Imperial (New)',
    description: 'Also New Imperial. Language of the Vatori Empire.',
    sampleNames: ['Hinlam', 'Ana', 'Rita', 'Erns', 'Ricte', 'Heda', 'Van', 'Godlid', 'Horus']
  },
  {
    id: 'old_imperial',
    name: 'Old Imperial',
    family: 'Imperial (dead/scholarly)',
    description: 'Dead, scholarly language — originally High Imperial.',
    note: 'Mostly read, not spoken. Used in archives and clergy.'
  },
  { id: 'hro_hro', name: 'Hro-hro', family: 'Horrom', description: 'Language of horroms.' },
  {
    id: 'shagadar',
    name: 'Shagadar',
    family: 'Northern rural / shadow cults',
    description: '"Darktounge." Northern rural language of ancient origin, also reported in shadow cults.',
    sampleNames: ['Ahk', 'Um-la Abut', 'Haxoh', 'Baltazar', 'Strax', 'Vezna']
  },
  {
    id: 'tgaka',
    name: 'Tgaka',
    family: 'TGA (rare)',
    description: 'Language of the TGA, now rarely spoken but frequently found in ruins.',
    sampleNames: ['Sha', 'Nin', 'Iko', 'Unna', 'Hun', 'Feng', 'Mian', 'Ka']
  },
  {
    id: 'katonga',
    name: 'Katonga',
    family: 'Southern blood',
    description: 'Also Hiligish, Rurr. Southern blood dialects descended from Tong.',
    sampleNames: ['Chiggarro', 'Pkena', 'Koto', 'Oskat', 'Hakla', 'Shekta', 'Tko']
  },
  {
    id: 'slither',
    name: 'Slither',
    family: 'Ptilian / scavenger guild',
    description: 'A Ptilian language, also a techno-scavenger guild language.',
    sampleNames: ['Ssracht', 'Iss', 'Nessa', 'Elele', 'Yinsi', 'Vissla', 'Eshtalan']
  },
  {
    id: 'al_gol',
    name: 'Al-Gol',
    family: 'Machine',
    description: 'Machine language known by droids, holids, and some mainframes.',
    sampleNames: ['Fortodo', 'Checkpoint', 'Awaito Pen', 'Io', 'Deall']
  },
  {
    id: 'klsixla',
    name: "K'lsixla",
    family: 'Amphibious alien',
    description: 'Amphibious alien language (also names XLA-symbiotic bloods).',
    sampleNames: ['Glgllunbug', 'Lispinkluck', 'Hurrnumblib', 'Blop', 'Puddlam']
  },
  {
    id: 'bugga',
    name: 'Bugga',
    family: 'Insectoid',
    description: 'Insectoid language.',
    sampleNames: ['Have My Leg', 'Straw to Stack', 'An-Tenna', 'Last One Out']
  },
  {
    id: 'orug',
    name: 'Orug',
    family: 'Orug',
    description: 'Orug language.',
    sampleNames: ['Holly', 'Acorn', 'Aster', 'Clover', 'Grape', 'Hebe', 'Mallow', 'Nerine']
  },
  {
    id: 'palp',
    name: 'Palp',
    family: 'Palp alien',
    description: 'Palp alien language.',
    note: 'Requires palps to speak — non-palp species cannot produce it.'
  },
  {
    id: 'aeonic',
    name: 'Æonic',
    family: 'Undeciphered',
    description: 'Undeciphered hieroglyphic language.',
    note: 'Written only — meaning lost, hieroglyphs survive in ruins.'
  },
  {
    id: 'fungal',
    name: 'Fungal',
    family: 'Great Mycelium',
    description: 'Language of The Great Mycelium.',
    note: 'Chemical / spore-based — non-vocal.'
  },
  {
    id: 'krypotkep',
    name: 'Krypotkep',
    family: 'Secret machine',
    description: 'Secret machine language.',
    note: 'Construct third-language pick only.',
    restriction: { lifeFormGroup: 'construct', thirdSlotOnly: true }
  },
  {
    id: 'thieves_cant',
    name: "Thieves' Cant",
    family: 'Secret guild',
    description: 'Secret guild language.',
    note: 'Picked up through underground contacts.'
  },
  {
    id: 'mime',
    name: 'Mime',
    family: 'Dimension travelers',
    description: 'Language of the Mimes — a rare species of dimension travelers.',
    note: 'Rare. Speakers are themselves rare.'
  },
  {
    id: 'harabarum',
    name: 'Harabarum',
    family: 'Colossi',
    description: 'Language of the colossi.',
    note: 'Spoken by giants — pitch + scale make it hard for smaller throats.'
  }
];

/**
 * Lookup helper — returns the language def by id, or null if id is not in
 * the table. Falls back to id as the display name in the (rare) case of a
 * legacy/unknown id flowing through from an old import.
 */
export function getLanguageDef(id: Language): LanguageDef | null {
  return LANGUAGES_DATA.find((l) => l.id === id) ?? null;
}

/**
 * Per rules/20: the Languages keyword grants written (Archive) or spoken
 * (Morph) expertise in *every* language the character knows. The keyword
 * itself does not grant additional languages — it grants expertise. We
 * compute expertise from the existing keywords array so there's no
 * duplication of state.
 *
 * Returns `{ written, spoken }` flags; `both` is just `written && spoken`.
 */
export interface LanguageExpertise {
  written: boolean;
  spoken: boolean;
}

export function computeLanguageExpertise(keywords: { name: string; stack: string }[]): LanguageExpertise {
  // Match case-insensitively + tolerate "Languages" / "Language" so an
  // imported character with slightly different keyword casing still resolves.
  const langKws = keywords.filter((k) => /^language[s]?$/i.test(k.name.trim()));
  const written = langKws.some((k) => k.stack === 'archive');
  const spoken = langKws.some((k) => k.stack === 'morph');
  return { written, spoken };
}

/** Language a life-form must pick as their non-Pidgin starter. */
export function mandatoryLanguageForLifeForm(lf: LifeForm): Language | null {
  switch (lf) {
    case 'palp_alien':
      return 'palp';
    case 'amphibious_alien':
      return 'klsixla';
    case 'droid':
    case 'holid':
      return 'al_gol';
    default:
      return null;
  }
}

/** True if a given life-form is in the "construct" group (droid + holid). */
export function isConstructLifeForm(lf: LifeForm): boolean {
  return lf === 'droid' || lf === 'holid';
}

/**
 * Mechanical eligibility check for a language pick. Returns either `null`
 * (eligible) or a short reason string explaining why it's blocked. Used by
 * the wizard + character editor to gate restricted languages — never trust
 * the player to honour-system this.
 *
 * @param lang        the LanguageDef being checked
 * @param lifeForm    character life-form
 * @param d3Unlocked  has the d3 roll come up 3 (third slot unlocked)
 * @param picked      current EXTRA picks count (excluding pidgin + mandatory)
 */
export function languagePickEligibility(lang: LanguageDef, lifeForm: LifeForm, d3Unlocked: boolean, picked: number): string | null {
  const r = lang.restriction;
  if (!r) return null;
  if (r.lifeFormGroup === 'construct' && !isConstructLifeForm(lifeForm)) {
    return 'Construct life-form only (Droid or Holid).';
  }
  if (r.thirdSlotOnly) {
    if (!d3Unlocked) return 'Third-slot only — requires d3 roll of 3.';
    // Third slot = picked == 1 (about to make second EXTRA pick after the
    // first non-mandatory one). Only allow when the player is in the act of
    // filling the second extra slot.
    if (picked < 1) return 'Pick another language first — this can only be the third.';
  }
  return null;
}

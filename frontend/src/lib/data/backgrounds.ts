/**
 * backgrounds.ts - SW backgrounds (rules/19).
 *
 * Each background grants stack bonuses (combat + primary) and offers six
 * keywords. Keyword stack-suggestions per source: A=Archive, B=Bulk, G=Ghost,
 * M=Morph, S=Speed, T=Tech.
 */

import type { Background, Stack, PrimaryStack } from '$lib/models/Enums';

export interface BackgroundKeyword {
  /** Display name. */
  name: string;
  /** Stack hints suggested by the source — non-binding. */
  stackHints: Stack[];
}

export interface BackgroundDef {
  id: Background;
  label: string;
  /** Short description for the UI. */
  blurb: string;
  /** Multi-paragraph narrative description from rules/19 body text. */
  description: string;
  /** Combat-stack bonuses (rules/17). */
  closeBonus: number;
  rangedBonus: number;
  /** Primary stack bonuses (rules/19 parenthetical). */
  primaryBonuses: Partial<Record<PrimaryStack, number>>;
  /** Bonus summary string for headers (e.g. "+2 Bulk, Ghost, Close and Ranged"). */
  bonusSummary: string;
  /** Six keywords offered by this background. */
  keywords: BackgroundKeyword[];
  /** d20 tangential roll table (rules/19). */
  tangentials: { roll: number; entry: string }[];
  /** Example archetypes / professions. */
  examples: string[];
}

export const BACKGROUNDS_DATA: BackgroundDef[] = [
  {
    id: 'enforcer',
    label: 'Enforcer',
    blurb: 'Hired fighting power — bodyguard, soldier, hitter.',
    description:
      'Enforcers are hired fighting power — for attacks, for protection, for show. They can be focused on close or ranged fighting (or both). What marks them is the ability to kill and stay alive across a wide range of environments.',
    bonusSummary: '+2 Bulk, Ghost, Close and Ranged',
    examples: ['Bodyguard', 'Torpedo', 'Hitman', 'Soldier', 'Boxer', 'Robber', 'Bar brawler'],
    closeBonus: 2,
    rangedBonus: 2,
    primaryBonuses: { bulk: 2, ghost: 2 },
    keywords: [
      { name: 'First Aid', stackHints: ['tech', 'archive'] },
      { name: 'Tactics', stackHints: ['archive'] },
      { name: 'Makeshift Gear', stackHints: ['tech', 'speed'] },
      { name: 'Threats', stackHints: ['morph', 'bulk'] },
      { name: 'Break', stackHints: ['bulk', 'tech'] },
      { name: 'Military', stackHints: ['archive', 'tech'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A kill' },
      { roll: 2, entry: 'A war' },
      { roll: 3, entry: 'A prison' },
      { roll: 4, entry: 'An ambush' },
      { roll: 5, entry: 'An injury' },
      { roll: 6, entry: 'An award' },
      { roll: 7, entry: 'An illness' },
      { roll: 8, entry: 'A crime' },
      { roll: 9, entry: 'A union' },
      { roll: 10, entry: 'A war-band' },
      { roll: 11, entry: 'A crimelord' },
      { roll: 12, entry: 'A revenge' },
      { roll: 13, entry: 'A cult' },
      { roll: 14, entry: 'A comrade' },
      { roll: 15, entry: 'A superior' },
      { roll: 16, entry: 'A boss' },
      { roll: 17, entry: 'A bar' },
      { roll: 18, entry: 'A city block' },
      { roll: 19, entry: 'A weapon' },
      { roll: 20, entry: 'A memorial item' }
    ]
  },
  {
    id: 'diplomat',
    label: 'Diplomat',
    blurb: 'Operates between factions: negotiator, messenger, spy.',
    description:
      'A character who operates between factions — negotiator, messenger, spy. The work is often dangerous and rewards steady nerves and a level temper. Faction wars are common on Zira-Ka, so the presence or absence of these qualities can make or break deals.',
    bonusSummary: '+2 Archive, Ghost and Morph; +1 Ranged',
    examples: ['Negotiator', 'Messenger', 'Spy', 'Faction broker'],
    closeBonus: 0,
    rangedBonus: 1,
    primaryBonuses: { archive: 2, ghost: 2, morph: 2 },
    keywords: [
      { name: 'Languages', stackHints: ['morph', 'archive'] },
      { name: 'Bluffing', stackHints: ['morph'] },
      { name: 'Forgery', stackHints: ['tech', 'archive'] },
      { name: 'Culture', stackHints: ['archive', 'morph'] },
      { name: 'Geography', stackHints: ['archive'] },
      { name: 'Encryption', stackHints: ['tech', 'archive'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A deal' },
      { roll: 2, entry: 'A colleague' },
      { roll: 3, entry: 'A city state' },
      { roll: 4, entry: 'An org' },
      { roll: 5, entry: 'A cult' },
      { roll: 6, entry: 'A conflict' },
      { roll: 7, entry: 'An umberzone' },
      { roll: 8, entry: 'A new frontanium find' },
      { roll: 9, entry: 'A loved opponent' },
      { roll: 10, entry: 'A war-crime' },
      { roll: 11, entry: 'A catastrophe' },
      { roll: 12, entry: 'A deep injustice' },
      { roll: 13, entry: 'A blame' },
      { roll: 14, entry: 'A lost party' },
      { roll: 15, entry: 'An evidence' },
      { roll: 16, entry: 'A secret revealed' },
      { roll: 17, entry: 'A document' },
      { roll: 18, entry: 'A debt' },
      { roll: 19, entry: 'An ally' },
      { roll: 20, entry: 'A faux pas' }
    ]
  },
  {
    id: 'entertainer',
    label: 'Entertainer',
    blurb: 'Story-teller, juggler, song-house star, traveling poet.',
    description:
      'Wandering story-teller, local song-house star, traveling writer, juggler, poet, or some other aesthetic craftsperson people are willing to pay for. The bard, however, is a special case dating back to the Zyu era — a separate, secretive community with very high admission requisites; bards cannot be chosen at character generation. Most people respect bards, and on all of Zira-Ka it is considered bad luck not to help or house a bard who asks.',
    bonusSummary: '+2 Morph and Speed; +1 Archive and Ranged',
    examples: ['Story-teller', 'Song-house star', 'Traveling writer', 'Juggler', 'Poet'],
    closeBonus: 0,
    rangedBonus: 1,
    primaryBonuses: { morph: 2, speed: 2, archive: 1 },
    keywords: [
      { name: 'Disguise', stackHints: ['bulk', 'morph', 'tech'] },
      { name: 'Acrobatics', stackHints: ['speed', 'bulk'] },
      { name: 'Folklore', stackHints: ['archive', 'morph'] },
      { name: 'Sleight-of-hand', stackHints: ['speed', 'tech'] },
      { name: 'Bartering', stackHints: ['morph', 'archive'] },
      { name: 'Rumors', stackHints: ['morph'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A gig or event' },
      { roll: 2, entry: 'A traveling ensemble' },
      { roll: 3, entry: 'A contract' },
      { roll: 4, entry: 'A fellow entertainer' },
      { roll: 5, entry: 'An abusive employer' },
      { roll: 6, entry: 'A fan' },
      { roll: 7, entry: 'A long lost work' },
      { roll: 8, entry: 'A ruling house' },
      { roll: 9, entry: 'A censored work' },
      { roll: 10, entry: 'A fair' },
      { roll: 11, entry: 'A music instrument' },
      { roll: 12, entry: 'A special implant' },
      { roll: 13, entry: 'A ban on artists' },
      { roll: 14, entry: 'A legend' },
      { roll: 15, entry: 'A publishing house' },
      { roll: 16, entry: 'A secret society' },
      { roll: 17, entry: 'A house of sin' },
      { roll: 18, entry: 'A playhouse' },
      { roll: 19, entry: 'An article' },
      { roll: 20, entry: 'A heist' }
    ]
  },
  {
    id: 'cultist',
    label: 'Cultist',
    blurb: 'In a cult — missionary, summoner-priest, templar knight.',
    description:
      'Religion is one thing; being in a cult is something more. Open and secret cults abound. Positions range from lowly missionary to summoner-priest or templar knight. The largest open cult is the Church of the Watchful Eye (dating to the Imperial Era). Others include the Cult of HoloH, shadow cults, orug worship, and remnants of Zyu existentialism — many alternatives, on a planet thick with mystery.',
    bonusSummary: '+1 Archive, Bulk and Morph; +2 Ghost; +1 Close',
    examples: ['Missionary', 'Summoner-priest', 'Templar knight', 'Cloistered scholar'],
    closeBonus: 1,
    rangedBonus: 0,
    primaryBonuses: { archive: 1, bulk: 1, morph: 1, ghost: 2 },
    keywords: [
      { name: 'Religion', stackHints: ['archive', 'ghost'] },
      { name: 'Leadership', stackHints: ['morph', 'archive'] },
      { name: 'Drugs', stackHints: ['tech', 'archive'] },
      { name: 'Knighthood', stackHints: ['archive', 'morph', 'ghost'] },
      { name: 'Symbols', stackHints: ['archive', 'morph'] },
      { name: 'Disguise', stackHints: ['bulk', 'morph', 'tech'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A seer' },
      { roll: 2, entry: 'An apocryphal text' },
      { roll: 3, entry: 'A holy item' },
      { roll: 4, entry: 'A heretic' },
      { roll: 5, entry: 'A cult hunter' },
      { roll: 6, entry: 'A vision' },
      { roll: 7, entry: 'A festivity' },
      { roll: 8, entry: 'An omen' },
      { roll: 9, entry: 'A sickness of faith' },
      { roll: 10, entry: 'A competing cult' },
      { roll: 11, entry: 'A special child' },
      { roll: 12, entry: 'A returning spirit' },
      { roll: 13, entry: 'A law' },
      { roll: 14, entry: 'A lost temple' },
      { roll: 15, entry: 'An expedition' },
      { roll: 16, entry: 'A creature' },
      { roll: 17, entry: 'A miracle' },
      { roll: 18, entry: 'A relic' },
      { roll: 19, entry: 'A ritual' },
      { roll: 20, entry: 'A nanite formula' }
    ]
  },
  {
    id: 'fixer',
    label: 'Fixer',
    blurb: 'Shady operator — acquires, hacks, drives, fences.',
    description:
      "Fixers are shady. They can acquire, negotiate, fix, hack, drive, and fence stuff that other people can't or won't. Their biggest asset is willingness to cross that extra line or two — which makes them either trouble-makers or problem-solvers depending on who you ask. Fixers tend to fend pretty well for themselves: usually have backup, or pack mean-punch weapons or explosives as a last resort.",
    bonusSummary: '+2 Morph, Speed and Tech; +1 Close and Ranged',
    examples: ['Smuggler', 'Hacker', 'Driver', 'Fence', 'Lockbreaker'],
    closeBonus: 1,
    rangedBonus: 1,
    primaryBonuses: { morph: 2, speed: 2, tech: 2 },
    keywords: [
      { name: 'Trading', stackHints: ['archive', 'morph'] },
      { name: 'Hacking', stackHints: ['archive'] },
      { name: 'Vehicles', stackHints: ['speed', 'tech'] },
      { name: 'B & E', stackHints: ['speed', 'tech', 'morph'] },
      { name: 'Fixing', stackHints: ['archive', 'morph', 'speed', 'tech'] },
      { name: 'Implants', stackHints: ['tech'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A thief of thieves' },
      { roll: 2, entry: 'A heist' },
      { roll: 3, entry: 'A price on a head' },
      { roll: 4, entry: 'A crime lord' },
      { roll: 5, entry: 'A piece of information' },
      { roll: 6, entry: 'A piece of equipment' },
      { roll: 7, entry: 'A deal' },
      { roll: 8, entry: 'A store' },
      { roll: 9, entry: 'A special lock' },
      { roll: 10, entry: 'A nanite formula' },
      { roll: 11, entry: 'A hidden cyber system' },
      { roll: 12, entry: 'An eldritch brain implant' },
      { roll: 13, entry: 'An insurance hack' },
      { roll: 14, entry: 'A trial' },
      { roll: 15, entry: 'A VAPOR division' },
      { roll: 16, entry: 'A rumor' },
      { roll: 17, entry: 'A hidden route' },
      { roll: 18, entry: 'A membership' },
      { roll: 19, entry: 'A club' },
      { roll: 20, entry: 'A contract' }
    ]
  },
  {
    id: 'outrider',
    label: 'Outrider',
    blurb: 'Wilderness runner — hunting, mail, exploration, guidework.',
    description:
      "The outrider braves the wilderness — bringing food back to the settlements, providing basic mail services, finding lost children or cattle, charting and guiding people through uncharted territory, and sometimes bringing back treasures from a ruin that hasn't already been looted. Gritty survivors who do what needs to be done. In hard times, often who others turn to for help.",
    bonusSummary: '+2 Ghost, Morph and Speed; +1 Close and Ranged',
    examples: ['Hunter', 'Mail rider', 'Wilderness guide', 'Tracker', 'Ruin scout'],
    closeBonus: 1,
    rangedBonus: 1,
    primaryBonuses: { ghost: 2, morph: 2, speed: 2 },
    keywords: [
      { name: 'Survival', stackHints: ['archive', 'tech', 'ghost', 'bulk'] },
      { name: 'Riding', stackHints: ['speed', 'morph', 'ghost'] },
      { name: 'Stealth', stackHints: ['speed'] },
      { name: 'Biology', stackHints: ['archive', 'tech'] },
      { name: 'Tracking', stackHints: ['morph', 'archive', 'tech'] },
      { name: 'Maps', stackHints: ['archive'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A trail' },
      { roll: 2, entry: 'A landslide' },
      { roll: 3, entry: 'A lost city' },
      { roll: 4, entry: 'A life debt' },
      { roll: 5, entry: 'A mail bag' },
      { roll: 6, entry: 'A plague' },
      { roll: 7, entry: 'A zotusk without rider' },
      { roll: 8, entry: 'An umberzone' },
      { roll: 9, entry: 'A tainted item' },
      { roll: 10, entry: 'A map' },
      { roll: 11, entry: 'A ruin' },
      { roll: 12, entry: 'An æonic implant' },
      { roll: 13, entry: 'A circle of monoliths' },
      { roll: 14, entry: 'A trading station' },
      { roll: 15, entry: 'A tribal war' },
      { roll: 16, entry: 'A TGM emissary' },
      { roll: 17, entry: 'An orug conflict' },
      { roll: 18, entry: 'A colossus' },
      { roll: 19, entry: 'A broken crawler' },
      { roll: 20, entry: 'A fugitive' }
    ]
  },
  {
    id: 'archivist',
    label: 'Archivist',
    blurb: 'Knowledge specialist — æonic science, biology, formulae, history.',
    description:
      'The archivist is about knowledge — and about going out in the field to get it. There is much to know on Zira-Ka: aeonic science, biology, medicine, holofields, the Gale, implants, cultural history, and of course nanite formulae. Not all archivists are bookworms; a tribal bot-charmer or weather-worker who never heard of libraries can be excellent, as can a trial-and-error expert on refurbished surgery clinics. Getting the right archivist for maps and information before a mission is often crucial — and sometimes both difficult and costly.',
    bonusSummary: '+2 Archive; +1 Morph; +2 Tech',
    examples: ['Field researcher', 'Bot-charmer', 'Weather-worker', 'Salvage scientist'],
    closeBonus: 0,
    rangedBonus: 0,
    primaryBonuses: { archive: 2, morph: 1, tech: 2 },
    keywords: [
      { name: 'Medicine', stackHints: ['archive', 'morph', 'tech'] },
      { name: 'Science', stackHints: ['archive', 'tech'] },
      { name: 'Folklore', stackHints: ['archive', 'morph'] },
      { name: 'Archæology', stackHints: ['archive', 'tech'] },
      { name: 'History', stackHints: ['archive'] },
      { name: 'Nanites', stackHints: ['archive', 'ghost'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A pattern' },
      { roll: 2, entry: 'A scientific break-through' },
      { roll: 3, entry: 'An experiment gone awry' },
      { roll: 4, entry: 'A financier' },
      { roll: 5, entry: 'A lost log' },
      { roll: 6, entry: 'A laboratory' },
      { roll: 7, entry: 'A hidden library' },
      { roll: 8, entry: 'A cyber database' },
      { roll: 9, entry: 'A Tgaka research station' },
      { roll: 10, entry: 'A new kind of formula' },
      { roll: 11, entry: 'A talking monkey' },
      { roll: 12, entry: 'An underwater ruin' },
      { roll: 13, entry: 'A restored implant' },
      { roll: 14, entry: 'A malfunctioning Maker' },
      { roll: 15, entry: 'A mad scientist' },
      { roll: 16, entry: 'A virus' },
      { roll: 17, entry: 'An interpretation' },
      { roll: 18, entry: 'A data theft' },
      { roll: 19, entry: 'A strand' },
      { roll: 20, entry: 'A blueprint' }
    ]
  },
  {
    id: 'worker',
    label: 'Worker',
    blurb: 'Hardship-tested labourer; improviser; sometimes an organiser.',
    description:
      'Used to dealing with plenty of hardships and good at improvising. Ready to make a pile of e-credits whenever possible. Sometimes an idealist or a faction (union) representative, but more often someone who does not care for politicians or diplomacy.',
    bonusSummary: '+2 Bulk, Tech and Close',
    examples: ['Miner', 'Builder', 'Mender', 'Demolitions worker', 'Union upstart'],
    closeBonus: 2,
    rangedBonus: 0,
    primaryBonuses: { bulk: 2, tech: 2 },
    keywords: [
      { name: 'Mining', stackHints: ['tech', 'archive'] },
      { name: 'Building', stackHints: ['tech', 'archive', 'bulk'] },
      { name: 'Mending', stackHints: ['tech', 'archive'] },
      { name: 'Improvised Weapons', stackHints: ['tech'] },
      { name: 'Explosives', stackHints: ['archive', 'tech'] },
      { name: 'Agitation', stackHints: ['morph'] }
    ],
    tangentials: [
      { roll: 1, entry: 'A strike' },
      { roll: 2, entry: 'A team' },
      { roll: 3, entry: 'A union upstart' },
      { roll: 4, entry: 'An accident' },
      { roll: 5, entry: 'A debt' },
      { roll: 6, entry: 'A bar' },
      { roll: 7, entry: 'A special tool' },
      { roll: 8, entry: 'A company' },
      { roll: 9, entry: 'An unexpected find' },
      { roll: 10, entry: 'A secret' },
      { roll: 11, entry: 'An uprising' },
      { roll: 12, entry: 'A leader' },
      { roll: 13, entry: 'A competing workforce' },
      { roll: 14, entry: 'An injury' },
      { roll: 15, entry: 'A slave' },
      { roll: 16, entry: 'A lost art' },
      { roll: 17, entry: 'A teacher' },
      { roll: 18, entry: 'A vehicle' },
      { roll: 19, entry: 'A trapped co-worker' },
      { roll: 20, entry: 'A faith' }
    ]
  }
];

export function getBackground(id: Background): BackgroundDef {
  const found = BACKGROUNDS_DATA.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown background ${id}`);
  return found;
}

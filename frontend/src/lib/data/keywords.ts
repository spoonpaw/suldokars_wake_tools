/**
 * keywords.ts — glossary of background keywords (rules/19) and per-stack
 * interpretations.
 *
 * In SW each keyword sits under ONE stack column on the sheet. The stack
 * placement determines what it boosts/unblocks. The same keyword under two
 * stacks does different things — e.g. Languages (M) reads as expert spoken
 * fluency, Languages (A) reads as scholarly literacy. Suggested placements
 * come from rules/19; players may pick any plausible stack.
 *
 * `descriptions` here are short, player-facing summaries of what each
 * keyword represents and what each stack-slot interpretation means in play.
 */

import type { PrimaryStack } from '$lib/models/Enums';

export interface KeywordEntry {
  /** What this knowledge area covers in general. */
  description: string;
  /** Per-stack interpretation — only the stacks called out as plausible. */
  perStack: Partial<Record<PrimaryStack, string>>;
}

/** One-liner per primary stack, used as a fallback header when a keyword
 *  doesn't have a custom per-stack note. */
export const STACK_BLURBS: Record<PrimaryStack, string> = {
  archive: 'Book learning, theory, lore.',
  bulk: 'Raw strength, mass, force of body.',
  ghost: 'Intuition, will, faith, spirit.',
  morph: 'Charisma, social, expressive presence.',
  speed: 'Agility, reflex, deft hands.',
  tech: 'Tools, electronics, mechanical hands-on.'
};

export const KEYWORD_GLOSSARY: Record<string, KeywordEntry> = {
  Acrobatics: {
    description: 'Tumbling, balance, jumps, climbing, body control under pressure.',
    perStack: {
      speed: 'Quick reflexes — vaults, dodges, falls from height.',
      bulk: 'Power tumbling, holds, lifts, sustained climbing.'
    }
  },
  Agitation: {
    description: 'Stirring crowds, propaganda, protest, ideological argument.',
    perStack: {
      morph: 'Live crowd-work — speeches, chants, riot leadership.',
      archive: 'Doctrine + ideology — written manifestos, theory of revolt.'
    }
  },
  Archæology: {
    description: 'Ruins, ancient cultures, dig sites, recovered artifacts.',
    perStack: {
      archive: 'Lore + provenance — dating, identification, history.',
      tech: 'Field work — excavation tools, conservation, recovery rigs.'
    }
  },
  'B & E': {
    description: 'Breaking + entering — locks, alarms, quiet bypass of security.',
    perStack: {
      tech: 'Picks, lock-rakes, alarm + system bypass.',
      speed: 'Silent movement, fast entries, quick exits.',
      morph: 'Social engineering — talking past guards, tailgating.'
    }
  },
  Bartering: {
    description: 'Haggling, trade calls, reading a buyer or seller.',
    perStack: {
      morph: 'Live haggling — reading the room, closing deals.',
      archive: 'Market lore — fair prices, scarcity, regional rates.'
    }
  },
  Biology: {
    description: 'Living organisms — anatomy, ecology, taxonomy, lab biology.',
    perStack: {
      archive: 'Theory — taxonomy, ecology, lab method.',
      tech: 'Hands-on lab work, dissection, sampling.'
    }
  },
  Bluffing: {
    description: 'Lying convincingly, cover stories, social deception.',
    perStack: {
      morph: 'Live face-to-face deception, holding character.'
    }
  },
  Break: {
    description: 'Smashing things — doors, walls, lockboxes, restraints.',
    perStack: {
      bulk: 'Brute force — kicks, shoves, breaching with body.',
      tech: 'Leverage tools, breaching charges, cutting torches.'
    }
  },
  Building: {
    description: 'Construction — shelters, walls, stairs, bridges, fortifications.',
    perStack: {
      tech: 'Hands-on building — framing, joinery, masonry.',
      archive: 'Architecture + engineering theory — load, span, design.',
      bulk: 'Heavy labour — moving stone, raising beams, pile-driving.'
    }
  },
  Culture: {
    description: 'How a society works — etiquette, customs, taboos, factions.',
    perStack: {
      archive: 'Deep historical / regional knowledge.',
      morph: 'Reading current customs, fitting in live.'
    }
  },
  Disguise: {
    description: 'Looking like someone else — appearance, manner, voice.',
    perStack: {
      bulk: 'Body padding + posture — passing as bigger or smaller.',
      morph: 'Mannerisms, accents, body language, character work.',
      tech: 'Makeup, prosthetics, wardrobe craft, holo-overlays.'
    }
  },
  Drugs: {
    description: 'Recreational + medicinal substances — effects, dosing, sourcing.',
    perStack: {
      tech: 'Synthesis, dosing, lab production.',
      archive: 'Pharmacology + interaction theory.'
    }
  },
  Encryption: {
    description: 'Codes, ciphers, secure comms — making + breaking them.',
    perStack: {
      tech: 'Working crypto — cracking + encrypting traffic.',
      archive: 'Cipher theory, classical + modern systems.'
    }
  },
  Explosives: {
    description: 'Bombs, charges, demolitions — handling and doctrine.',
    perStack: {
      tech: 'Hands-on — wiring, placement, detonation.',
      archive: 'Doctrine — yields, blast effects, demolition planning.'
    }
  },
  'First Aid': {
    description: 'Battlefield medicine — stabilising, stopping bleeding, splints.',
    perStack: {
      tech: 'Hands-on use of meds, kits, field gear.',
      archive: 'Diagnosis + medical knowledge.'
    }
  },
  'First aid': {
    description: 'Battlefield medicine — stabilising, stopping bleeding, splints.',
    perStack: {
      tech: 'Hands-on use of meds, kits, field gear.',
      archive: 'Diagnosis + medical knowledge.'
    }
  },
  Fixing: {
    description: 'Repairing broken things — gear, vehicles, structures, electronics.',
    perStack: {
      tech: 'Workshop repair — full disassembly + rebuild.',
      speed: 'Quick field patches under time pressure.',
      morph: 'Coordinating repair crews + finding the right hands.',
      archive: 'Knowing how a thing was meant to work — diagnostics.'
    }
  },
  Folklore: {
    description: 'Stories, myths, regional legends, oral tradition.',
    perStack: {
      archive: 'Scholarly knowledge of myths + variants.',
      morph: 'Telling stories well — persuasion through tale.'
    }
  },
  Forgery: {
    description: 'Fake papers, false IDs, fabricated artifacts, signatures.',
    perStack: {
      tech: 'Doctoring documents + media physically.',
      archive: 'Mimicking style, voice, period — passable fakes.'
    }
  },
  Geography: {
    description: 'Lay of the land — regions, routes, terrain, settlements.',
    perStack: {
      archive: 'Map + atlas knowledge — distances, borders, routes.'
    }
  },
  Hacking: {
    description: 'Computers, networks, mainframes — entry, manipulation, defence.',
    perStack: {
      tech: 'Live system intrusion — exploits + tools.',
      archive: 'Comp-sci theory — protocols, architectures, history.'
    }
  },
  History: {
    description: 'Past events, dynasties, wars, lost technologies.',
    perStack: {
      archive: 'Scholarly historical knowledge.'
    }
  },
  Implants: {
    description: 'Cybernetic + biological augmentations — install, maintain, troubleshoot.',
    perStack: {
      tech: 'Hands-on installation + maintenance.',
      archive: 'Surgical + biotech theory.'
    }
  },
  'Improvised Weapons': {
    description: 'Fashioning weapons from whatever is at hand.',
    perStack: {
      bulk: 'Heavy weapons of opportunity — clubs, beams, pipes.',
      speed: 'Quick fashioning + nimble use of found tools.'
    }
  },
  Knighthood: {
    description: 'Templar / chivalric tradition — code, combat, ritual, order lore.',
    perStack: {
      archive: 'Honour codes, order history, heraldry, doctrine.',
      morph: 'Bearing + ceremony — public face of the order.',
      ghost: 'Vows + ritual — sworn oaths and faith-bound resolve.'
    }
  },
  Languages: {
    description: 'Knowing languages well beyond the basics. Modifies how you use known languages, NOT how many you know.',
    perStack: {
      morph: 'Expert spoken fluency — accent, idiom, persuasion.',
      archive: 'Scholarly literacy — reading, translation, dead tongues.'
    }
  },
  Leadership: {
    description: 'Commanding, organising, inspiring people under stress.',
    perStack: {
      morph: 'Charisma — winning hearts, public speaking.',
      bulk: 'Command presence — forceful authority, troop handling.',
      archive: 'Doctrine, drill, organisational theory.'
    }
  },
  'Makeshift Gear': {
    description: 'Field-improvised gear from scavenged parts.',
    perStack: {
      tech: 'Jury-rigged tools, expedient repairs.',
      speed: 'Quick lash-ups under pressure.'
    }
  },
  Maps: {
    description: 'Cartography — making, reading, interpreting maps.',
    perStack: {
      archive: 'Cartographic theory + classical map lore.',
      morph: 'Landscape sense — reading terrain to landmarks.'
    }
  },
  Medicine: {
    description: 'Diagnosis + treatment of disease, injury, poison, infection.',
    perStack: {
      archive: 'Diagnosis, theory, pharmacology, etiology.',
      morph: 'Bedside manner — calming patients, getting consent.',
      tech: 'Hands-on treatment — surgery, drug use, equipment.'
    }
  },
  Mending: {
    description: 'Repairing soft goods + delicate items — clothes, leather, sails, pottery.',
    perStack: {
      tech: 'Hands-on repair, sewing, gluing, restoration.',
      archive: 'Period / craft knowledge — proper techniques.'
    }
  },
  Military: {
    description: 'Armies, doctrine, ranks, equipment, tactics at scale.',
    perStack: {
      archive: 'Military lore + doctrine — strategy, history.',
      tech: 'Hands-on with military gear, vehicles, comms.'
    }
  },
  Mining: {
    description: 'Extracting ore + frontanium — labour and equipment.',
    perStack: {
      tech: 'Mining gear — drills, charges, processing.',
      archive: 'Geology, ore identification, vein-reading, claim law.'
    }
  },
  Nanites: {
    description: 'Programmable nano-scale machines — handling, deployment, theory.',
    perStack: {
      archive: 'Nanite theory, risks, immune response, programming.',
      ghost: 'Sensing nanite presence + interaction with the holoh.'
    }
  },
  Religion: {
    description: 'Faiths of Zira-Ka — liturgy, doctrine, ritual, lore.',
    perStack: {
      archive: 'Scriptural + doctrinal scholarship, comparative religion.',
      ghost: 'Faith + ritual — invoking, praying, sacred practice.'
    }
  },
  Riding: {
    description: 'Mounted travel — pets, mounts, beasts of burden.',
    perStack: {
      speed: 'Reflexive riding — gallops, jumps, mounted combat.',
      morph: 'Bond + handling — calming, training, command voice.',
      ghost: 'Wordless rapport — anticipating the mount, reading mood.'
    }
  },
  Rumors: {
    description: 'Hearing + tracing the talk — informants, gossip, leaks.',
    perStack: {
      morph: 'Network — knowing whom to ask, working contacts.',
      ghost: 'Listening — patience, instinct for what matters.'
    }
  },
  Science: {
    description: 'Empirical method — chemistry, physics, math, engineering basics.',
    perStack: {
      archive: 'Theory — formulae, principles, calculation.',
      tech: 'Applied — lab work, instrumentation, engineering.'
    }
  },
  'Sleight-of-hand': {
    description: 'Pickpocketing, palming, stage magic, sleight tricks.',
    perStack: {
      speed: 'Quick hands — pickpocketing, deck work.',
      morph: 'Misdirection + showmanship.'
    }
  },
  Stealth: {
    description: 'Sneaking, hiding, silent approach + cover.',
    perStack: {
      speed: 'Silent movement, quick concealment.'
    }
  },
  Survival: {
    description: 'Living in wilderness — water, food, shelter, weather, threat ID.',
    perStack: {
      archive: 'Wilderness lore — flora, fauna, weather patterns, terrain.',
      tech: 'Field gear use — traps, snares, fire-craft, shelters.',
      ghost: 'Instinct + endurance — sensing threat, pushing through.',
      bulk: 'Sheer endurance — carrying loads, surviving exposure.'
    }
  },
  Symbols: {
    description: 'Glyphs, sigils, brands, faction marks — meaning + reading.',
    perStack: {
      archive: 'Literacy with old + obscure scripts.',
      morph: 'Reading social signal — gang colours, faction marks.'
    }
  },
  Tactics: {
    description: 'Small-unit fighting — positioning, cover, fire-and-move, formations.',
    perStack: {
      archive: 'Battlefield analysis, doctrine, formations.'
    }
  },
  Threats: {
    description: 'Intimidation — verbal + physical menace.',
    perStack: {
      morph: 'Social intimidation — voice, posture, glare.',
      bulk: 'Physical menace — looming, displays of force.'
    }
  },
  Tracking: {
    description: 'Following signs, trails, anomalies in landscape or city.',
    perStack: {
      morph: 'Reading prey behaviour, choices, intent.',
      archive: 'Sign-language of trail + terrain — what marks mean.',
      tech: 'Drones, scopes, infra — instrumented trailing.'
    }
  },
  Trading: {
    description: 'Operating as a merchant — sourcing, routes, contracts, contacts.',
    perStack: {
      morph: 'Live deals + relationships.',
      archive: 'Market knowledge, contract law, ledgers.'
    }
  },
  Vehicles: {
    description: 'Land/air/water vehicles — driving, piloting, maintenance.',
    perStack: {
      tech: 'Mechanic — repair, modification, diagnostics.',
      speed: 'Driver / pilot — reflex handling, manoeuvre.'
    }
  }
};

/** Look up a keyword entry; returns a generic fallback if not in glossary. */
export function getKeywordEntry(name: string): KeywordEntry {
  return (
    KEYWORD_GLOSSARY[name] ?? {
      description: 'Specialised knowledge area — see rules/19.',
      perStack: {}
    }
  );
}

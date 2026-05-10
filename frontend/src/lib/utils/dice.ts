/**
 * dice.ts - Suldokar's Wake dice roller.
 *
 * SW uses the inverted-action roll: roll 1d20.
 *  - Success if `roll <= stack` (regular DN ≤ stack) OR `roll > DN` (special).
 *  - Crit on natural 20 when DN ≤ 19. Apt also crits on 19.
 *  - Fumble = exact roll of 13 when DN ≥ 13.
 *
 * Plus the supporting roll modes (clean, double, half, exploding, Odyn).
 */

// ============================================
// LOW LEVEL RNG
// ============================================

const RNG = {
  d(sides: number): number {
    return 1 + Math.floor(Math.random() * sides);
  }
};

export function rollNd(n: number, sides: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(RNG.d(sides));
  return out;
}

// ============================================
// INVERTED ACTION ROLL (rules/32, /45)
// ============================================

export type RollOutcome = 'crit' | 'special' | 'success' | 'failure' | 'fumble';

export interface InvertedRollResult {
  /** The d20 face value. */
  d20: number;
  /** Outcome category. */
  outcome: RollOutcome;
  /** Stack used. */
  stack: number;
  /** Difficulty Number set. */
  dn: number;
  /** Whether Apt crit-on-19 applied. */
  isApt: boolean;
  /** Human-readable summary. */
  description: string;
}

/**
 * Resolve an inverted action roll.
 *  - Crit: natural 20 (and 19 for Apt) when DN ≤ 19.
 *  - Fumble: exact 13 when DN ≥ 13.
 *  - Special success: roll > DN (in the difficult zone).
 *  - Regular success: roll ≤ stack.
 *  - Otherwise failure.
 *
 * Note: a fumble (exact 13 when DN ≥ 13) takes priority over success/special checks.
 */
export function invertedRoll(stack: number, dn: number, isApt = false): InvertedRollResult {
  const face = RNG.d(20);

  // Fumble check first
  if (face === 13 && dn >= 13) {
    return {
      d20: face,
      outcome: 'fumble',
      stack,
      dn,
      isApt,
      description: `Fumble — exact 13 vs DN ${dn}`
    };
  }

  // Crit check (natural 20, and 19 for Apt) — only when DN ≤ 19
  if (dn <= 19 && (face === 20 || (isApt && face === 19))) {
    return {
      d20: face,
      outcome: 'crit',
      stack,
      dn,
      isApt,
      description: `Critical success — natural ${face} vs DN ${dn}`
    };
  }

  // Special success: roll > DN
  if (face > dn) {
    return {
      d20: face,
      outcome: 'special',
      stack,
      dn,
      isApt,
      description: `Special success — ${face} > DN ${dn}`
    };
  }

  // Regular success: roll ≤ stack
  if (face <= stack) {
    return {
      d20: face,
      outcome: 'success',
      stack,
      dn,
      isApt,
      description: `Success — ${face} ≤ stack ${stack}`
    };
  }

  return {
    d20: face,
    outcome: 'failure',
    stack,
    dn,
    isApt,
    description: `Failure — ${face} > stack ${stack} and ≤ DN ${dn}`
  };
}

/**
 * Clean roll — DN-only check, no stack involvement.
 *
 * SW clean roll: roll d20 vs DN. Success when face ≤ DN; failure when face > DN.
 * Crit on natural 20 (DN ≤ 19). Fumble on exact 13 when DN ≥ 13.
 *
 * Note: there is no "special" success on a clean roll — without a stack, the
 * face-vs-DN comparison IS the success check. (A regular inverted roll's
 * "special" zone is the gap between stack and DN; with no stack, that gap
 * collapses.)
 */
export function cleanRoll(dn: number): InvertedRollResult {
  const face = RNG.d(20);

  if (face === 13 && dn >= 13) {
    return {
      d20: face,
      outcome: 'fumble',
      stack: 0,
      dn,
      isApt: false,
      description: `Fumble — exact 13 vs DN ${dn}`
    };
  }
  if (dn <= 19 && face === 20) {
    return {
      d20: face,
      outcome: 'crit',
      stack: 0,
      dn,
      isApt: false,
      description: `Critical — natural 20 vs DN ${dn}`
    };
  }
  const ok = face <= dn;
  return {
    d20: face,
    outcome: ok ? 'success' : 'failure',
    stack: 0,
    dn,
    isApt: false,
    description: `${ok ? 'Success' : 'Failure'} — ${face} vs DN ${dn}`
  };
}

/**
 * Double roll — best of two inverted rolls. The "best" outcome is the
 * one with the highest priority: crit > special > success > failure > fumble.
 */
export function doubleRoll(
  stack: number,
  dn: number,
  isApt = false
): { rolls: [InvertedRollResult, InvertedRollResult]; best: InvertedRollResult } {
  const a = invertedRoll(stack, dn, isApt);
  const b = invertedRoll(stack, dn, isApt);
  const best = compareOutcomes(a, b) >= 0 ? a : b;
  return { rolls: [a, b], best };
}

/** Half roll — worst of two inverted rolls. */
export function halfRoll(
  stack: number,
  dn: number,
  isApt = false
): { rolls: [InvertedRollResult, InvertedRollResult]; worst: InvertedRollResult } {
  const a = invertedRoll(stack, dn, isApt);
  const b = invertedRoll(stack, dn, isApt);
  const worst = compareOutcomes(a, b) <= 0 ? a : b;
  return { rolls: [a, b], worst };
}

const OUTCOME_RANK: Record<RollOutcome, number> = {
  crit: 4,
  special: 3,
  success: 2,
  failure: 1,
  fumble: 0
};

function compareOutcomes(a: InvertedRollResult, b: InvertedRollResult): number {
  return OUTCOME_RANK[a.outcome] - OUTCOME_RANK[b.outcome];
}

// ============================================
// EXPLODING D20
// ============================================

export interface ExplodingRollResult {
  total: number;
  rolls: number[];
}

/**
 * Roll a d20 — on a 20, roll again and add. Continue until non-20.
 * Used for stacked exploding rolls in some SW mechanics.
 */
export function explodingD20(): ExplodingRollResult {
  const rolls: number[] = [];
  let total = 0;
  for (;;) {
    const r = RNG.d(20);
    rolls.push(r);
    total += r;
    if (r !== 20) break;
  }
  return { total, rolls };
}

// ============================================
// ODYN ROLL
// ============================================

export interface OdynResult {
  d20: number;
  d12: number;
  d10: number;
  d8: number;
  d6: number;
  d4: number;
}

/** Roll the Odyn — one die of each (rules/12). */
export function odyn(): OdynResult {
  return {
    d20: RNG.d(20),
    d12: RNG.d(12),
    d10: RNG.d(10),
    d8: RNG.d(8),
    d6: RNG.d(6),
    d4: RNG.d(4)
  };
}

// ============================================
// DAMAGE STEPPING
// ============================================

export type DamageStep = 'd3' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12';

const DAMAGE_LADDER: DamageStep[] = ['d3', 'd4', 'd6', 'd8', 'd10', 'd12'];

/** Step damage up by N (clamped to ladder). */
export function stepDamageUp(die: DamageStep, by = 1): DamageStep {
  const idx = DAMAGE_LADDER.indexOf(die);
  if (idx < 0) return die;
  return DAMAGE_LADDER[Math.min(DAMAGE_LADDER.length - 1, idx + by)];
}

/** Step damage down by N (clamped). */
export function stepDamageDown(die: DamageStep, by = 1): DamageStep {
  const idx = DAMAGE_LADDER.indexOf(die);
  if (idx < 0) return die;
  return DAMAGE_LADDER[Math.max(0, idx - by)];
}

/** Roll an XdY damage dice, returning total + each face. */
export function rollDamage(die: DamageStep): { total: number; rolls: number[] } {
  const sides = parseInt(die.slice(1), 10);
  const r = RNG.d(sides);
  return { total: r, rolls: [r] };
}

// ============================================
// GENERIC HELPERS
// ============================================

/** Roll d20 + modifier (used for Bulk/Speed wrestling-type checks if ever needed). */
export function rollD20(modifier = 0): { total: number; face: number; modifier: number } {
  const face = RNG.d(20);
  return { total: face + modifier, face, modifier };
}

/** d6 roll. Used for starter Parts table, generic checks. */
export function rollD6(): number {
  return RNG.d(6);
}

/** d3 roll (third-language check). */
export function rollD3(): number {
  return RNG.d(3);
}

/** d12 roll (alien resistance/vulnerability/feature). */
export function rollD12(): number {
  return RNG.d(12);
}

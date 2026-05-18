/**
 * rollAnimation.ts — slot-machine style cycling for rolled values.
 *
 * Rapidly cycles a bound value through random picks for a brief window,
 * then settles on the final value. Gives visual feedback that a roll
 * happened even when the result equals the previous value.
 */

export interface RollAnimOptions {
  /** Total animation duration in ms. Default 500. */
  durationMs?: number;
  /** Per-frame step in ms. Default 55. */
  stepMs?: number;
}

/**
 * Cycle `setter` through random picks from `table` for `durationMs`,
 * then settle on `finalValue`. Returns a promise that resolves once
 * the final value is set.
 */
export async function animateRoll<T>(
  table: readonly T[],
  finalValue: T,
  setter: (v: T) => void,
  opts: RollAnimOptions = {}
): Promise<void> {
  const durationMs = opts.durationMs ?? 500;
  const stepMs = opts.stepMs ?? 55;
  const steps = Math.max(1, Math.floor(durationMs / stepMs));
  for (let i = 0; i < steps; i++) {
    const pick = table[Math.floor(Math.random() * table.length)];
    setter(pick);
    await sleep(stepMs);
  }
  setter(finalValue);
}

/** Convenience: animate a number roll from 1..N (e.g. d6 = animateDie(6, final, set)). */
export async function animateDie(
  sides: number,
  finalValue: number,
  setter: (v: number) => void,
  opts: RollAnimOptions = {}
): Promise<void> {
  const faces = Array.from({ length: sides }, (_, i) => i + 1);
  return animateRoll(faces, finalValue, setter, opts);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

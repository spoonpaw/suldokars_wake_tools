import { afterEach, describe, expect, it, vi } from 'vitest';
import { animateDie, animateRoll } from './rollAnimation';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('animateRoll', () => {
  it('calls the setter multiple times and commits the final value last', async () => {
    vi.useFakeTimers();
    const observed: string[] = [];
    const promise = animateRoll(['A', 'B', 'C'], 'C', (v) => observed.push(v), {
      durationMs: 200,
      stepMs: 50
    });
    await vi.runAllTimersAsync();
    await promise;
    // Exact tick count is an implementation detail — assert the contract:
    // animation cycles at least once and lands on the final value.
    expect(observed.length).toBeGreaterThan(1);
    expect(observed[observed.length - 1]).toBe('C');
  });

  it('runs with defaults when opts omitted (cycles + commits)', async () => {
    vi.useFakeTimers();
    const observed: number[] = [];
    const promise = animateRoll([1, 2, 3], 3, (v) => observed.push(v));
    await vi.runAllTimersAsync();
    await promise;
    expect(observed.length).toBeGreaterThan(1);
    expect(observed[observed.length - 1]).toBe(3);
  });

  it('always produces values drawn from the table during cycling', async () => {
    vi.useFakeTimers();
    const table = ['x', 'y', 'z'] as const;
    const observed: string[] = [];
    const promise = animateRoll(table, 'y', (v) => observed.push(v), {
      durationMs: 300,
      stepMs: 30
    });
    await vi.runAllTimersAsync();
    await promise;
    for (const v of observed) {
      expect(table).toContain(v);
    }
  });

  it('still cycles + commits even when durationMs < stepMs (steps clamped to >= 1)', async () => {
    vi.useFakeTimers();
    const observed: number[] = [];
    const promise = animateRoll([1, 2], 2, (v) => observed.push(v), {
      durationMs: 1,
      stepMs: 100
    });
    await vi.runAllTimersAsync();
    await promise;
    expect(observed.length).toBeGreaterThanOrEqual(2);
    expect(observed[observed.length - 1]).toBe(2);
  });
});

describe('animateDie', () => {
  it('cycles values in 1..N during animation and commits the final value at end', async () => {
    vi.useFakeTimers();
    const observed: number[] = [];
    const promise = animateDie(6, 4, (v) => observed.push(v), { durationMs: 100, stepMs: 25 });
    await vi.runAllTimersAsync();
    await promise;
    expect(observed[observed.length - 1]).toBe(4);
    for (const v of observed) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('handles d3 correctly', async () => {
    vi.useFakeTimers();
    const observed: number[] = [];
    const promise = animateDie(3, 2, (v) => observed.push(v), { durationMs: 50, stepMs: 20 });
    await vi.runAllTimersAsync();
    await promise;
    expect(observed[observed.length - 1]).toBe(2);
    for (const v of observed) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});

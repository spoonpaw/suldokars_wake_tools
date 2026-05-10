/**
 * zoom.ts — UI zoom controlled via :root font-size.
 *
 * Tailwind sizes are rem-based, so scaling the root <html> font-size
 * scales the entire UI proportionally — text, padding, borders, gaps.
 *
 * Range: BASE_PX × MIN_FACTOR .. BASE_PX × MAX_FACTOR.
 * Default: 16px (1.0×). Persists to localStorage so reload keeps zoom.
 *
 * Used by the global keyboard handler in +layout.svelte
 * (Cmd/Ctrl + plus / minus / 0).
 */

export const BASE_PX = 16;
export const MIN_FACTOR = 0.6;
export const MAX_FACTOR = 2.0;
export const STEP_FACTOR = 0.1;
const STORAGE_KEY = 'sw-tools.zoom';

let currentFactor = 1.0;

/** Round to one decimal so 1.0 + 0.1 + 0.1 doesn't drift. */
function clean(f: number): number {
  return Math.round(f * 10) / 10;
}

function clamp(f: number): number {
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, f));
}

/** Apply current zoom factor to <html> root font-size. SSR-safe. */
function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${BASE_PX * currentFactor}px`;
}

/** Read persisted factor (or 1.0 default), clamp, apply. Call on mount.
 *  localStorage access is wrapped — Safari private mode and some embedded
 *  webviews throw on .getItem(), which would otherwise abort init before
 *  the app has a chance to render. */
export function initZoom(): number {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = Number.parseFloat(stored);
        if (Number.isFinite(parsed)) {
          currentFactor = clamp(parsed);
        }
      }
    } catch {
      /* private-mode / quota — fall through to default 1.0 */
    }
  }
  apply();
  return currentFactor;
}

export function getZoomFactor(): number {
  return currentFactor;
}

/** Persist current factor (best-effort — silent on quota errors). */
function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(currentFactor));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function zoomIn(): number {
  currentFactor = clamp(clean(currentFactor + STEP_FACTOR));
  apply();
  persist();
  return currentFactor;
}

export function zoomOut(): number {
  currentFactor = clamp(clean(currentFactor - STEP_FACTOR));
  apply();
  persist();
  return currentFactor;
}

export function resetZoom(): number {
  currentFactor = 1.0;
  apply();
  persist();
  return currentFactor;
}

/**
 * importExport.ts - SW character JSON import/export.
 *
 * Format: JSON file containing a single character or array of characters.
 * Each character carries its `schemaVersion` for future-proofing.
 */

import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import type { SWCharacter } from '$lib/models/SWCharacter';
import {
  cloneCharacterWithNewIds,
  CURRENT_SCHEMA_VERSION,
  normalizeCharacter
} from '$lib/models/SWCharacter';
import { CHARACTER_TYPES, LIFE_FORMS, BACKGROUNDS } from '$lib/models/Enums';

// ============================================
// IMPORT VALIDATION
// ============================================
// `normalizeCharacter` happily merges anything onto a default character —
// including unknown enum strings — because it spreads `...c` over `...d`.
// The downstream home page calls `getBackground(c.background)` and
// `getLifeForm(c.lifeForm)` which THROW on unknown ids, crashing the list.
// Reject any imported record whose enum-typed fields aren't valid before
// it ever hits the store.
const VALID_TYPES = new Set(CHARACTER_TYPES.map((t) => t.id as string));
const VALID_LIFE_FORMS = new Set(LIFE_FORMS.map((l) => l.id as string));
const VALID_BACKGROUNDS = new Set(BACKGROUNDS.map((b) => b.id as string));

/**
 * Returns true if `raw` looks like an SWCharacter we can safely import:
 * an object whose `type`, `lifeForm`, and `background` fields (if present)
 * are members of the canonical enum sets. Missing fields are tolerated —
 * `normalizeCharacter` will fill defaults.
 */
function isValidCharacterShape(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as Record<string, unknown>;
  if (c.type !== undefined && !VALID_TYPES.has(c.type as string)) return false;
  if (c.lifeForm !== undefined && !VALID_LIFE_FORMS.has(c.lifeForm as string)) return false;
  if (c.background !== undefined && !VALID_BACKGROUNDS.has(c.background as string)) return false;
  return true;
}

export interface ExportFile {
  app: 'sw-tools';
  version: number;
  exportedAt: string;
  characters: SWCharacter[];
}

// ============================================
// EXPORT
// ============================================

export function serializeCharacters(characters: SWCharacter[]): string {
  const file: ExportFile = {
    app: 'sw-tools',
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    characters
  };
  return JSON.stringify(file, null, 2);
}

/** Save export to a user-chosen file via Tauri dialog. */
export async function exportToFile(characters: SWCharacter[]): Promise<boolean> {
  try {
    const filePath = await save({
      title: "Export Suldokar's Wake characters",
      defaultPath:
        characters.length === 1
          ? `${(characters[0].name || 'character').replace(/[^a-z0-9]/gi, '_')}.json`
          : `sw-characters-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Suldokar's Wake character file", extensions: ['json'] }]
    });
    if (!filePath) return false;
    await writeTextFile(filePath, serializeCharacters(characters));
    return true;
  } catch (err) {
    console.error('[importExport] Tauri export failed:', err);
    return false;
  }
}

/** Browser-fallback download. */
export function downloadCharactersAsFile(characters: SWCharacter[]) {
  const blob = new Blob([serializeCharacters(characters)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    characters.length === 1
      ? `${(characters[0].name || 'character').replace(/[^a-z0-9]/gi, '_')}.json`
      : `sw-characters-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// IMPORT
// ============================================

/**
 * Parse JSON text into a list of characters. Accepts:
 *   - {app:'sw-tools', characters:[...]}
 *   - SWCharacter[]
 *   - SWCharacter (single)
 *
 * Throws if NO record in the input looks like an SW character (so the
 * UI can show a "doesn't match the SW character schema" error instead
 * of silently importing a default placeholder from `{}`).
 *
 * Each character has its IDs regenerated to avoid collisions.
 */
export function parseImportText(text: string): SWCharacter[] {
  const parsed: unknown = JSON.parse(text);

  let raw: unknown[];
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (parsed && typeof parsed === 'object' && 'characters' in parsed) {
    raw = (parsed as ExportFile).characters as unknown[];
  } else {
    raw = [parsed];
  }

  // Reject records with unknown type / lifeForm / background — those would
  // crash the home page's getBackground/getLifeForm lookups. Empty objects
  // and partial shapes still pass (normalize fills defaults), but unknown
  // enum strings are rejected outright.
  const valid = raw.filter(isValidCharacterShape) as SWCharacter[];
  if (raw.length > 0 && valid.length === 0) {
    throw new Error(
      "JSON parsed, but no record matches the SW character schema (check 'type', 'lifeForm', and 'background' fields)."
    );
  }
  return valid.map((c) => cloneCharacterWithNewIds(normalizeCharacter(c)));
}

/**
 * Result of attempting a Tauri-native file import. Distinguishes user
 * cancel (don't fall back) from "Tauri unavailable" (fall back to the
 * browser file picker).
 */
export type TauriImportResult =
  | { kind: 'characters'; characters: SWCharacter[] }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

/**
 * Open a JSON file via Tauri dialog and parse. Returns a tagged result so
 * callers can distinguish:
 *   - 'characters' — user picked a file, we parsed it
 *   - 'cancelled'  — user dismissed the picker (do nothing)
 *   - 'unavailable' — not running under Tauri, caller may fall back
 *   - 'error'      — picker opened but read/parse failed
 */
export async function importFromFile(): Promise<TauriImportResult> {
  let filePath: string | string[] | null;
  try {
    filePath = await open({
      title: "Import Suldokar's Wake characters",
      multiple: false,
      filters: [{ name: "Suldokar's Wake character file", extensions: ['json'] }]
    });
  } catch (err) {
    // The Tauri plugin throws when the runtime isn't present (browser
    // dev mode). Anything else is a real failure.
    console.warn('[importExport] Tauri dialog unavailable:', err);
    return { kind: 'unavailable' };
  }
  if (filePath === null) return { kind: 'cancelled' };
  // multiple:false should give a string, but if for some reason an array
  // arrives, take the first entry. Empty array == cancelled.
  let pickedPath: string;
  if (Array.isArray(filePath)) {
    if (filePath.length === 0) return { kind: 'cancelled' };
    pickedPath = filePath[0];
  } else {
    pickedPath = filePath;
  }
  try {
    const text = await readTextFile(pickedPath);
    return { kind: 'characters', characters: parseImportText(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read or parse file.';
    console.error('[importExport] Tauri import parse failed:', err);
    return { kind: 'error', message };
  }
}

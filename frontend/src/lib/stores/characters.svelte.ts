/**
 * characters.svelte.ts - SW character store backed by SQLite.
 */

import type { SWCharacter } from '$lib/models';
import { createDefaultCharacter, normalizeCharacter } from '$lib/models';
import {
  getAllCharacters,
  getCharacterById,
  insertCharacter,
  updateCharacter as dbUpdateCharacter,
  deleteCharacterById
} from './database';

// Schema migration / shape normalization lives in the model layer
// (normalizeCharacter in $lib/models/SWCharacter.ts). It seeds defaults,
// deep-merges nested objects, and normalizes array-element optional string
// fields so Svelte 5 bind:value never receives `undefined`.

// ============================================
// STATE
// ============================================

let characters = $state<SWCharacter[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);

// ============================================
// GETTERS
// ============================================

export function getCharacters(): SWCharacter[] {
  return characters;
}

export function getIsLoading(): boolean {
  return isLoading;
}

export function getError(): string | null {
  return error;
}

export function getCharacterByIdFromStore(id: string): SWCharacter | undefined {
  return characters.find((c) => c.id === id);
}

// ============================================
// ACTIONS
// ============================================

export async function loadCharacters(): Promise<void> {
  isLoading = true;
  error = null;

  try {
    const rows = await getAllCharacters();
    characters = rows
      .map((row) => {
        try {
          return normalizeCharacter(JSON.parse(row.data));
        } catch (e) {
          console.error(`[CharacterStore] Failed to parse character ${row.id}:`, e);
          return null;
        }
      })
      .filter((c): c is SWCharacter => c !== null);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load characters';
    console.error('[CharacterStore] Load error:', e);
    characters = [];
  } finally {
    isLoading = false;
  }
}

export async function createCharacter(data?: Partial<SWCharacter>): Promise<SWCharacter> {
  const baseId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sw-${Date.now()}`;
  const newCharacter: SWCharacter = {
    ...createDefaultCharacter(),
    ...data,
    id: baseId,
    updatedAt: new Date().toISOString()
  };

  try {
    await insertCharacter(
      newCharacter.id,
      JSON.stringify(newCharacter),
      newCharacter.name || 'Unnamed Character',
      newCharacter.type,
      newCharacter.lifeForm,
      newCharacter.background
    );

    characters = [newCharacter, ...characters];
    return newCharacter;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to create character';
    console.error('[CharacterStore] Create error:', e);
    throw e;
  }
}

export async function updateCharacter(character: SWCharacter): Promise<void> {
  try {
    const updated = { ...character, updatedAt: new Date().toISOString() };
    await dbUpdateCharacter(
      updated.id,
      JSON.stringify(updated),
      updated.name || 'Unnamed Character',
      updated.type,
      updated.lifeForm,
      updated.background
    );
    characters = characters.map((c) => (c.id === updated.id ? updated : c));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to update character';
    console.error('[CharacterStore] Update error:', e);
    throw e;
  }
}

export async function saveCharacter(character: SWCharacter): Promise<void> {
  const existing = await getCharacterById(character.id);
  if (existing) {
    await updateCharacter(character);
  } else {
    await insertCharacter(
      character.id,
      JSON.stringify(character),
      character.name || 'Unnamed Character',
      character.type,
      character.lifeForm,
      character.background
    );
    characters = [character, ...characters.filter((c) => c.id !== character.id)];
  }
}

export async function deleteCharacter(id: string): Promise<void> {
  try {
    await deleteCharacterById(id);
    characters = characters.filter((c) => c.id !== id);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to delete character';
    console.error('[CharacterStore] Delete error:', e);
    throw e;
  }
}

export async function importCharacters(importedCharacters: SWCharacter[]): Promise<number> {
  let imported = 0;

  for (const character of importedCharacters) {
    try {
      const newId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newCharacter = { ...character, id: newId };

      await insertCharacter(
        newCharacter.id,
        JSON.stringify(newCharacter),
        newCharacter.name || 'Unnamed Character',
        newCharacter.type,
        newCharacter.lifeForm,
        newCharacter.background
      );
      characters = [newCharacter, ...characters];
      imported++;
    } catch (e) {
      console.error(`[CharacterStore] Failed to import character:`, e);
    }
  }

  return imported;
}

export function exportCharacters(ids?: string[]): string {
  const toExport = ids ? characters.filter((c) => ids.includes(c.id)) : characters;
  return JSON.stringify(toExport, null, 2);
}

export function clearError(): void {
  error = null;
}

// ============================================
// CHARACTER STORE OBJECT
// ============================================

export const characterStore = {
  get characters() {
    return characters;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },

  getCharacter(id: string) {
    return characters.find((c) => c.id === id);
  },
  loadCharacters,
  createCharacter,
  addCharacter: async (character: SWCharacter) => {
    try {
      await insertCharacter(
        character.id,
        JSON.stringify(character),
        character.name || 'Unnamed Character',
        character.type,
        character.lifeForm,
        character.background
      );
      characters = [character, ...characters];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add character';
      throw e;
    }
  },
  updateCharacter,
  deleteCharacter,
  importCharacters,
  exportCharacters,
  clearError
};

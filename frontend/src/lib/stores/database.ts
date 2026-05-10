/**
 * database.ts - SQLite database setup and CRUD for SW characters.
 */

import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let isInitialized = false;

/** Get the database instance, initializing if needed. */
export async function getDatabase(): Promise<Database> {
  if (db && isInitialized) return db;

  try {
    db = await Database.load('sqlite:sw-tools.db');

    if (!isInitialized) {
      await initDatabaseSchema(db);
      isInitialized = true;
    }
    return db;
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

async function initDatabaseSchema(database: Database): Promise<void> {
  // Characters table — stores JSON blob for flexibility
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sw_characters (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      life_form TEXT NOT NULL,
      background TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await database.execute(`CREATE INDEX IF NOT EXISTS idx_sw_characters_name ON sw_characters(name)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_sw_characters_type ON sw_characters(type)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_sw_characters_updated ON sw_characters(updated_at)`);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  console.log('[DB] Database schema initialized');
}

export async function initDatabase(): Promise<void> {
  await getDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// ============================================
// CHARACTER CRUD
// ============================================

export interface CharacterRow {
  id: string;
  data: string;
  name: string;
  type: string;
  life_form: string;
  background: string;
  created_at: string;
  updated_at: string;
}

export async function getAllCharacters(): Promise<CharacterRow[]> {
  const database = await getDatabase();
  return await database.select<CharacterRow[]>(
    'SELECT * FROM sw_characters ORDER BY updated_at DESC'
  );
}

export async function getCharacterById(id: string): Promise<CharacterRow | null> {
  const database = await getDatabase();
  const result = await database.select<CharacterRow[]>(
    'SELECT * FROM sw_characters WHERE id = ?',
    [id]
  );
  return result[0] ?? null;
}

export async function insertCharacter(
  id: string,
  data: string,
  name: string,
  type: string,
  lifeForm: string,
  background: string
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `INSERT INTO sw_characters (id, data, name, type, life_form, background, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data, name, type, lifeForm, background, now, now]
  );
}

export async function updateCharacter(
  id: string,
  data: string,
  name: string,
  type: string,
  lifeForm: string,
  background: string
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE sw_characters
     SET data = ?, name = ?, type = ?, life_form = ?, background = ?, updated_at = ?
     WHERE id = ?`,
    [data, name, type, lifeForm, background, now, id]
  );
}

export async function deleteCharacterById(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM sw_characters WHERE id = ?', [id]);
}

export async function deleteAllCharacters(): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM sw_characters');
}

// ============================================
// SETTINGS
// ============================================

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDatabase();
  const result = await database.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return result[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM settings WHERE key = ?', [key]);
}

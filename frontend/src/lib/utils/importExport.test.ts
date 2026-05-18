import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from '$lib/models';
import { parseImportText, serializeCharacters } from './importExport';

describe('serializeCharacters', () => {
  it('produces a tagged export envelope ({ app, version, exportedAt, characters })', () => {
    const c = createDefaultCharacter();
    const text = serializeCharacters([c]);
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe('sw-tools');
    expect(parsed.version).toBeGreaterThan(0);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(Array.isArray(parsed.characters)).toBe(true);
    expect(parsed.characters).toHaveLength(1);
  });

  it('round-trips a default character through parseImportText (with new id)', () => {
    const c = createDefaultCharacter();
    c.name = 'Round Trip';
    const text = serializeCharacters([c]);
    const [back] = parseImportText(text);
    expect(back.name).toBe('Round Trip');
    expect(back.id).not.toBe(c.id); // import always regenerates ids
  });
});

describe('parseImportText input shapes', () => {
  it('accepts the canonical envelope { characters: [...] }', () => {
    const c = createDefaultCharacter();
    c.name = 'EnvelopeForm';
    const out = parseImportText(JSON.stringify({ app: 'sw-tools', characters: [c] }));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('EnvelopeForm');
  });

  it('accepts a bare SWCharacter[] array', () => {
    const c = createDefaultCharacter();
    c.name = 'ArrayForm';
    const out = parseImportText(JSON.stringify([c]));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('ArrayForm');
  });

  it('accepts a single SWCharacter (auto-wraps into [])', () => {
    const c = createDefaultCharacter();
    c.name = 'SingleForm';
    const out = parseImportText(JSON.stringify(c));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('SingleForm');
  });

  it('passes through legacy partial shapes (normalizeCharacter fills defaults)', () => {
    const out = parseImportText(JSON.stringify({ name: 'Sparse', type: 'apt' }));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Sparse');
    expect(out[0].lifeForm).toBe('blood');
  });
});

describe('parseImportText rejection of garbage', () => {
  it('throws when no record matches the SW schema (e.g. unknown enum values)', () => {
    const garbage = JSON.stringify([{ name: 'Bad', type: 'not-a-type', lifeForm: 'martian' }]);
    expect(() => parseImportText(garbage)).toThrow(/SW character schema/);
  });

  it('rejects records whose background isn\'t in the canonical list', () => {
    const garbage = JSON.stringify([{ name: 'Bad', background: 'space-pirate' }]);
    expect(() => parseImportText(garbage)).toThrow(/SW character schema/);
  });

  it('keeps only valid records when a mixed batch is imported (drops bad ones silently)', () => {
    const c = createDefaultCharacter();
    c.name = 'GoodOne';
    const out = parseImportText(
      JSON.stringify([{ name: 'BadOne', type: 'wrong' }, c])
    );
    // Only the valid record makes it through.
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('GoodOne');
  });

  it('throws on syntactically invalid JSON (delegates to JSON.parse)', () => {
    expect(() => parseImportText('{ not json')).toThrow();
  });
});

describe('parseImportText id regeneration', () => {
  it('generates unique ids for each imported character, even across duplicates', () => {
    const c = createDefaultCharacter();
    c.id = 'collide-id';
    const out = parseImportText(JSON.stringify([c, c, c]));
    expect(out).toHaveLength(3);
    const ids = out.map((x) => x.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).not.toBe('collide-id');
  });
});

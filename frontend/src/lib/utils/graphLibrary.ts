/**
 * graphLibrary.ts — helpers for the per-character advancement graph library.
 *
 * Per the rulebook: "It is rare but possible to loot new and different graphs
 * in an adventure, making your character cover uncharted development
 * territory." Each character starts with one default graph (clone of the
 * static APT/CORE/PRIME graph for their type) and may pick up additional
 * 'looted' graphs from play, or 'custom' graphs the player builds for a
 * specific concept. Only one graph drives advancement at a time — the
 * `activeGraphId` on the character.
 *
 * Default-source graphs are immutable: editing or deletion is refused.
 * Looted and custom graphs are fully editable. The active graph cannot be
 * deleted, and the character must always have at least one graph in the
 * library (we never let it drop to zero).
 *
 * Swap rule:
 *   1. Look up the node at the character's CURRENT typeGraphPosition on
 *      the NEW graph.
 *   2. If a node exists at that coord, apply its node effects immediately
 *      (raise stack floors, add spaces, prompt keyword/rearrange/bond-swap
 *      via AdvancementModal). The character treats it as if they had just
 *      traversed to that node — no shadow encounter is spent.
 *   3. If no node exists, just swap; position + stats unchanged.
 *   4. Log a `kind: 'graph_swap'` AdvancementLogEntry with full
 *      beforeState so rollback works.
 *
 * Helpers in this module are PURE — they take a SWCharacter, return a new
 * one. Callers (Svelte components) are responsible for plumbing the
 * returned character back into state.
 */

import type { SWCharacter, OwnedGraph, AdvancementLogEntry } from '$lib/models/SWCharacter';
import type { TypeGraphDef, TypeGraphNode } from '$lib/data/typeGraphs';
import { getTypeGraph, findNodeAt } from '$lib/data/typeGraphs';
import type { CharacterType } from '$lib/models/Enums';
import { typeLabel } from '$lib/models/SWCharacter';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `og-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns the active OwnedGraph, or null if the library is empty/missing. */
export function getActiveOwnedGraph(c: SWCharacter): OwnedGraph | null {
  const list = c.ownedGraphs ?? [];
  if (list.length === 0) return null;
  const id = c.activeGraphId;
  if (id) {
    const found = list.find((og) => og.id === id);
    if (found) return found;
  }
  // Fallback: first entry. Avoids strict-null crashes for partially-migrated
  // characters where activeGraphId got lost between a save and a hot-reload.
  return list[0] ?? null;
}

/**
 * Returns the active TypeGraphDef. If the character has an active OwnedGraph,
 * its `.graph` is returned (so any custom edits the player made are honored).
 * Falls back to the static default graph for the character's type — only
 * happens for paranoid migration safety: normalizeCharacter seeds an entry
 * if missing, so this branch should never trigger in practice.
 */
export function getActiveGraph(c: SWCharacter): TypeGraphDef {
  const active = getActiveOwnedGraph(c);
  if (active && active.graph && Array.isArray(active.graph.nodes)) return active.graph;
  return getTypeGraph(c.type);
}

/**
 * Build a fresh empty TypeGraphDef for a new custom graph. Origo is taken
 * from the character's current type so the satellite layout / origo
 * defaults still read sensibly.
 */
export function makeEmptyCustomGraph(type: CharacterType): TypeGraphDef {
  // Clone origo from the static default so the satellite scaffolding has
  // a coherent starting state, but with NO plotted nodes yet.
  const base = getTypeGraph(type);
  return {
    type,
    origo: { ...base.origo },
    nodes: []
  };
}

/** Add a brand-new empty 'custom' graph and return the updated character. */
export function addCustomGraph(c: SWCharacter, name: string): SWCharacter {
  const og: OwnedGraph = {
    id: newId(),
    name: name.trim() || `Custom: ${typeLabel(c.type)} build`,
    source: 'custom',
    graph: makeEmptyCustomGraph(c.type),
    acquiredAt: new Date().toISOString()
  };
  return {
    ...c,
    ownedGraphs: [...(c.ownedGraphs ?? []), og],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Add a 'looted' graph — the player picked up an alternative path from an
 * adventure. The caller supplies a TypeGraphDef (typically a clone of one
 * of the static defaults the GM tweaked).
 */
export function addLootedGraph(c: SWCharacter, name: string, graph: TypeGraphDef): SWCharacter {
  const og: OwnedGraph = {
    id: newId(),
    name: name.trim() || `Looted: ${typeLabel(graph.type)}`,
    source: 'looted',
    graph: structuredClone(graph),
    acquiredAt: new Date().toISOString()
  };
  return {
    ...c,
    ownedGraphs: [...(c.ownedGraphs ?? []), og],
    updatedAt: new Date().toISOString()
  };
}

/** Rename a graph. Allowed for any source (default included). */
export function renameGraph(c: SWCharacter, graphId: string, newName: string): SWCharacter {
  const trimmed = newName.trim();
  if (!trimmed) return c;
  const list = c.ownedGraphs ?? [];
  if (!list.some((og) => og.id === graphId)) return c;
  return {
    ...c,
    ownedGraphs: list.map((og) => (og.id === graphId ? { ...og, name: trimmed } : og)),
    updatedAt: new Date().toISOString()
  };
}

/** Returns true iff this graph can be deleted (not active, not the only one, not 'default'). */
export function canDeleteGraph(c: SWCharacter, graphId: string): boolean {
  const list = c.ownedGraphs ?? [];
  if (list.length <= 1) return false;
  if (c.activeGraphId === graphId) return false;
  const og = list.find((g) => g.id === graphId);
  if (!og) return false;
  if (og.source === 'default') return false;
  return true;
}

/** Returns true iff this graph's nodes can be edited (custom or looted). */
export function canEditGraphNodes(c: SWCharacter, graphId: string): boolean {
  const og = (c.ownedGraphs ?? []).find((g) => g.id === graphId);
  if (!og) return false;
  return og.source !== 'default';
}

/**
 * Delete a graph. Refuses (returns the original character) if the graph is
 * the active one, the only one in the library, or a 'default' source.
 */
export function deleteGraph(c: SWCharacter, graphId: string): SWCharacter {
  if (!canDeleteGraph(c, graphId)) return c;
  return {
    ...c,
    ownedGraphs: (c.ownedGraphs ?? []).filter((og) => og.id !== graphId),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Swap the active graph WITHOUT applying any per-node effects.
 *
 * This helper is intentionally simple: it flips `activeGraphId` and
 * appends a `kind: 'graph_swap'` log entry with empty `beforeState`. It
 * does NOT raise stack floors, add space slots, prompt keyword picks,
 * rearrange, or bond-swap — even when the new graph has a node at the
 * character's current coord. Callers needing the full node-effect
 * application path should mount `GraphSwapModal` (which owns the wizard
 * + beforeState construction so rollback works correctly).
 *
 * Returns null if the swap is a no-op (target missing or already active).
 * Otherwise returns the updated character + the log entry it appended.
 */
export function swapToGraph(c: SWCharacter, toGraphId: string): { updated: SWCharacter; logEntry: AdvancementLogEntry } | null {
  const list = c.ownedGraphs ?? [];
  const fromGraphId = c.activeGraphId ?? list[0]?.id ?? '';
  const toEntry = list.find((og) => og.id === toGraphId);
  const fromEntry = list.find((og) => og.id === fromGraphId);
  if (!toEntry || fromGraphId === toGraphId) return null;
  const pos = { x: c.typeGraphPosition?.x ?? 0, y: c.typeGraphPosition?.y ?? 0 };
  const appliedNode = findNodeAt(toEntry.graph, pos);
  const updated: SWCharacter = {
    ...c,
    activeGraphId: toGraphId,
    updatedAt: new Date().toISOString()
  };
  const changes: string[] = [`Swapped active graph: ${fromEntry?.name ?? '<unknown>'} → ${toEntry.name}`];
  if (appliedNode) {
    changes.push(`Note: node at (${pos.x}, ${pos.y}) on new graph was NOT applied (use GraphSwapModal for effects).`);
  } else {
    changes.push('No node at current coord on new graph — no effects applied.');
  }
  const logEntry: AdvancementLogEntry = {
    id: newId(),
    kind: 'graph_swap',
    fromNode: pos,
    toNode: pos,
    appliedAt: new Date().toISOString(),
    changes,
    reversible: true,
    beforeState: {},
    graphSwap: { fromGraphId, toGraphId, ...(appliedNode ? { appliedNode } : {}) }
  };
  // Mark prior history non-reversible — only the latest entry is reversible.
  const priorHistory = (updated.advancementHistory ?? []).map((h) => ({
    ...h,
    reversible: false
  }));
  updated.advancementHistory = [...priorHistory, logEntry];
  return { updated, logEntry };
}

/**
 * Add or update a node on a custom or looted graph. The node's (x, y)
 * uniquely identifies it within the graph — passing a node with the same
 * coords as an existing one replaces it. Default graphs are immutable.
 */
export function setGraphNode(c: SWCharacter, graphId: string, node: TypeGraphNode): SWCharacter {
  if (!canEditGraphNodes(c, graphId)) return c;
  return {
    ...c,
    ownedGraphs: (c.ownedGraphs ?? []).map((og) => {
      if (og.id !== graphId) return og;
      const filtered = og.graph.nodes.filter((n) => !(n.x === node.x && n.y === node.y));
      const next: TypeGraphDef = {
        ...og.graph,
        nodes: [...filtered, { ...node }]
      };
      return { ...og, graph: next };
    }),
    updatedAt: new Date().toISOString()
  };
}

/** Remove a node from a custom or looted graph. */
export function removeGraphNode(c: SWCharacter, graphId: string, x: number, y: number): SWCharacter {
  if (!canEditGraphNodes(c, graphId)) return c;
  return {
    ...c,
    ownedGraphs: (c.ownedGraphs ?? []).map((og) => {
      if (og.id !== graphId) return og;
      const next: TypeGraphDef = {
        ...og.graph,
        nodes: og.graph.nodes.filter((n) => !(n.x === x && n.y === y))
      };
      return { ...og, graph: next };
    }),
    updatedAt: new Date().toISOString()
  };
}

/** Update graph notes / metadata fields (name + notes). Allowed on any source. */
export function setGraphMeta(c: SWCharacter, graphId: string, patch: { name?: string; notes?: string }): SWCharacter {
  return {
    ...c,
    ownedGraphs: (c.ownedGraphs ?? []).map((og) => {
      if (og.id !== graphId) return og;
      const next: OwnedGraph = { ...og };
      if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim();
      if (patch.notes !== undefined) next.notes = patch.notes;
      return next;
    }),
    updatedAt: new Date().toISOString()
  };
}

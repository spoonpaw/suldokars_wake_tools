import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from '$lib/models';
import { APT_GRAPH } from '$lib/data/typeGraphs';
import type { TypeGraphNode } from '$lib/data/typeGraphs';
import {
  addCustomGraph,
  addLootedGraph,
  canDeleteGraph,
  canEditGraphNodes,
  deleteGraph,
  getActiveGraph,
  getActiveOwnedGraph,
  makeEmptyCustomGraph,
  removeGraphNode,
  renameGraph,
  setGraphMeta,
  setGraphNode,
  swapToGraph
} from './graphLibrary';

describe('getActiveOwnedGraph + getActiveGraph', () => {
  it('returns the active owned graph by id', () => {
    const c = createDefaultCharacter();
    const og = getActiveOwnedGraph(c);
    expect(og?.id).toBe(c.activeGraphId);
    expect(og?.source).toBe('default');
  });

  it('falls back to the first entry when activeGraphId is missing/invalid', () => {
    const c = createDefaultCharacter();
    c.activeGraphId = 'not-a-real-id';
    expect(getActiveOwnedGraph(c)?.id).toBe(c.ownedGraphs![0].id);
  });

  it('returns null when ownedGraphs is empty', () => {
    const c = createDefaultCharacter();
    c.ownedGraphs = [];
    expect(getActiveOwnedGraph(c)).toBeNull();
  });

  it('getActiveGraph returns the OwnedGraph.graph when present', () => {
    const c = createDefaultCharacter();
    const g = getActiveGraph(c);
    expect(g.type).toBe('apt');
    expect(g.nodes.length).toBeGreaterThan(0);
  });

  it('getActiveGraph falls back to the static graph for the character type if empty library', () => {
    const c = createDefaultCharacter();
    c.ownedGraphs = [];
    const g = getActiveGraph(c);
    expect(g).toBe(APT_GRAPH);
  });
});

describe('makeEmptyCustomGraph', () => {
  it('clones origo from the static type-graph but starts with NO nodes', () => {
    const empty = makeEmptyCustomGraph('apt');
    expect(empty.type).toBe('apt');
    expect(empty.origo).toEqual(APT_GRAPH.origo);
    expect(empty.nodes).toEqual([]);
  });
});

describe('addCustomGraph / addLootedGraph', () => {
  it('appends a fresh custom OwnedGraph with source="custom"', () => {
    const c = createDefaultCharacter();
    const before = c.ownedGraphs?.length ?? 0;
    const out = addCustomGraph(c, 'Homebrew');
    expect(out.ownedGraphs?.length).toBe(before + 1);
    const tail = out.ownedGraphs![out.ownedGraphs!.length - 1];
    expect(tail.source).toBe('custom');
    expect(tail.name).toBe('Homebrew');
    expect(tail.graph.nodes).toEqual([]);
  });

  it('falls back to a generated name when given a blank string', () => {
    const out = addCustomGraph(createDefaultCharacter(), '   ');
    const tail = out.ownedGraphs![out.ownedGraphs!.length - 1];
    expect(tail.name).toMatch(/Custom:/);
  });

  it('appends a looted graph with source="looted" and clones the source graph', () => {
    const c = createDefaultCharacter();
    const out = addLootedGraph(c, 'Looted alt path', APT_GRAPH);
    const tail = out.ownedGraphs![out.ownedGraphs!.length - 1];
    expect(tail.source).toBe('looted');
    expect(tail.name).toBe('Looted alt path');
    // Looted graph is a clone — mutating its nodes must not bleed into the static def.
    tail.graph.nodes.push({ x: 99, y: 99, spaces: 0, kind: 'open' });
    expect(APT_GRAPH.nodes.some((n) => n.x === 99 && n.y === 99)).toBe(false);
  });
});

describe('renameGraph', () => {
  it('renames an existing graph, ignores blank names, and ignores unknown ids', () => {
    const c = createDefaultCharacter();
    const id = c.activeGraphId!;
    expect(renameGraph(c, id, 'New Name').ownedGraphs![0].name).toBe('New Name');
    expect(renameGraph(c, id, '   ')).toBe(c); // no-op
    expect(renameGraph(c, 'not-real', 'X')).toBe(c); // no-op
  });
});

describe('canDeleteGraph / canEditGraphNodes / deleteGraph', () => {
  it('refuses to delete the only graph in the library', () => {
    const c = createDefaultCharacter();
    expect(canDeleteGraph(c, c.activeGraphId!)).toBe(false);
  });

  it('refuses to delete the active graph (even with another in the library)', () => {
    const c = addCustomGraph(createDefaultCharacter(), 'Second');
    expect(canDeleteGraph(c, c.activeGraphId!)).toBe(false);
  });

  it('refuses to delete a default-source graph even when inactive', () => {
    let c = addCustomGraph(createDefaultCharacter(), 'Custom');
    const customId = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    const defaultId = c.activeGraphId!;
    c = { ...c, activeGraphId: customId };
    expect(canDeleteGraph(c, defaultId)).toBe(false);
  });

  it('allows deletion of an inactive custom/looted graph and drops it from the library', () => {
    let c = addCustomGraph(createDefaultCharacter(), 'Custom A');
    const customId = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    c = addCustomGraph(c, 'Custom B'); // keep customId inactive
    expect(canDeleteGraph(c, customId)).toBe(true);
    const out = deleteGraph(c, customId);
    expect(out.ownedGraphs?.some((og) => og.id === customId)).toBe(false);
  });

  it('canEditGraphNodes: true for custom/looted, false for default', () => {
    let c = addCustomGraph(createDefaultCharacter(), 'Custom');
    const customId = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    c = addLootedGraph(c, 'Looted', APT_GRAPH);
    const lootedId = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    const defaultId = c.activeGraphId!;
    expect(canEditGraphNodes(c, customId)).toBe(true);
    expect(canEditGraphNodes(c, lootedId)).toBe(true);
    expect(canEditGraphNodes(c, defaultId)).toBe(false);
    expect(canEditGraphNodes(c, 'unknown')).toBe(false);
  });
});

describe('setGraphNode / removeGraphNode', () => {
  function customCharWithGraph() {
    const c = addCustomGraph(createDefaultCharacter(), 'Custom');
    const id = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    return { c, id };
  }
  const node = (x: number, y: number, spaces: number | null = 1): TypeGraphNode => ({
    x,
    y,
    spaces,
    kind: 'open'
  });

  it('adds a node to a custom graph', () => {
    const { c, id } = customCharWithGraph();
    const out = setGraphNode(c, id, node(1, 1));
    const graph = out.ownedGraphs!.find((og) => og.id === id)!.graph;
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('replaces a node when one already exists at the same (x, y)', () => {
    const { c, id } = customCharWithGraph();
    const c2 = setGraphNode(c, id, node(1, 1, 1));
    const c3 = setGraphNode(c2, id, node(1, 1, 5));
    const graph = c3.ownedGraphs!.find((og) => og.id === id)!.graph;
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].spaces).toBe(5);
  });

  it('refuses to edit a default graph', () => {
    const c = createDefaultCharacter();
    const out = setGraphNode(c, c.activeGraphId!, node(1, 1));
    expect(out).toBe(c);
  });

  it('removeGraphNode drops the matching node from a custom graph', () => {
    const { c, id } = customCharWithGraph();
    const c2 = setGraphNode(setGraphNode(c, id, node(1, 1)), id, node(2, 2));
    const c3 = removeGraphNode(c2, id, 1, 1);
    const graph = c3.ownedGraphs!.find((og) => og.id === id)!.graph;
    expect(graph.nodes.map((n) => `${n.x},${n.y}`)).toEqual(['2,2']);
  });
});

describe('setGraphMeta', () => {
  it('updates name when given a non-blank value', () => {
    const c = createDefaultCharacter();
    const id = c.activeGraphId!;
    const out = setGraphMeta(c, id, { name: 'Renamed' });
    expect(out.ownedGraphs![0].name).toBe('Renamed');
  });

  it('updates notes (allows empty string clear)', () => {
    const c = createDefaultCharacter();
    const id = c.activeGraphId!;
    const out = setGraphMeta(c, id, { notes: 'hi' });
    expect(out.ownedGraphs![0].notes).toBe('hi');
    const out2 = setGraphMeta(out, id, { notes: '' });
    expect(out2.ownedGraphs![0].notes).toBe('');
  });
});

describe('swapToGraph', () => {
  it('returns null when target is missing or already active', () => {
    const c = createDefaultCharacter();
    expect(swapToGraph(c, 'missing-id')).toBeNull();
    expect(swapToGraph(c, c.activeGraphId!)).toBeNull();
  });

  it('flips activeGraphId and emits a graph_swap log entry', () => {
    const c = addCustomGraph(createDefaultCharacter(), 'Second');
    const customId = c.ownedGraphs![c.ownedGraphs!.length - 1].id;
    const result = swapToGraph(c, customId);
    expect(result).not.toBeNull();
    expect(result!.updated.activeGraphId).toBe(customId);
    expect(result!.logEntry.kind).toBe('graph_swap');
    expect(result!.logEntry.graphSwap?.toGraphId).toBe(customId);
  });
});

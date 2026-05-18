import { describe, expect, it } from 'vitest';
import {
  APT_GRAPH,
  CORE_GRAPH,
  PRIME_GRAPH,
  TYPE_GRAPHS,
  TYPE_GRAPH_X_MAX,
  TYPE_GRAPH_Y_MAX,
  applyDir,
  findNodeAt,
  getTypeGraph,
  isLegalNextNode,
  legalNextNodes
} from './typeGraphs';

describe('type-graph origo values (rules/18 body text)', () => {
  it('Apt: 1 space, 1 implant, shadow 0, gunta 0, Close 0, Ranged 1', () => {
    expect(APT_GRAPH.origo).toEqual({
      spaces: 1,
      implants: 1,
      shadow: 0,
      gunta: 0,
      closeStart: 0,
      rangedStart: 1
    });
  });

  it('Core: 1 space, 0 implants, 0/0 combat', () => {
    expect(CORE_GRAPH.origo).toEqual({
      spaces: 1,
      implants: 0,
      shadow: 0,
      gunta: 0,
      closeStart: 0,
      rangedStart: 0
    });
  });

  it('Prime: 1 space, 0 implants, Close 1, Ranged 1', () => {
    expect(PRIME_GRAPH.origo).toEqual({
      spaces: 1,
      implants: 0,
      shadow: 0,
      gunta: 0,
      closeStart: 1,
      rangedStart: 1
    });
  });

  it('TYPE_GRAPHS maps each character type to the matching graph def', () => {
    expect(TYPE_GRAPHS.apt).toBe(APT_GRAPH);
    expect(TYPE_GRAPHS.core).toBe(CORE_GRAPH);
    expect(TYPE_GRAPHS.prime).toBe(PRIME_GRAPH);
    expect(getTypeGraph('apt')).toBe(APT_GRAPH);
    expect(getTypeGraph('core')).toBe(CORE_GRAPH);
    expect(getTypeGraph('prime')).toBe(PRIME_GRAPH);
  });

  it('every graph reports its own type in the def', () => {
    expect(APT_GRAPH.type).toBe('apt');
    expect(CORE_GRAPH.type).toBe('core');
    expect(PRIME_GRAPH.type).toBe('prime');
  });

  it('no plotted node overlaps with origo (0, 0) on any graph', () => {
    for (const g of [APT_GRAPH, CORE_GRAPH, PRIME_GRAPH]) {
      expect(g.nodes.some((n) => n.x === 0 && n.y === 0)).toBe(false);
    }
  });

  it('every plotted node sits inside the grid bounds', () => {
    for (const g of [APT_GRAPH, CORE_GRAPH, PRIME_GRAPH]) {
      for (const n of g.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(TYPE_GRAPH_X_MAX);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeLessThanOrEqual(TYPE_GRAPH_Y_MAX);
      }
    }
  });

  it('every graph has a node at (1, 1) — the first reachable position from origo', () => {
    for (const g of [APT_GRAPH, CORE_GRAPH, PRIME_GRAPH]) {
      const oneOne = g.nodes.find((n) => n.x === 1 && n.y === 1);
      expect(oneOne).toBeDefined();
    }
  });
});

describe('legalNextNodes / isLegalNextNode (Manhattan ≤ 2)', () => {
  it('lists all plotted nodes within Manhattan distance 2 of the given position', () => {
    const fromOrigo = legalNextNodes(APT_GRAPH, { x: 0, y: 0 });
    // Only (1,1) is within 2 of origo (rules text + isolation comment).
    expect(fromOrigo).toHaveLength(1);
    expect(fromOrigo[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('excludes the current position even if it sits on a node', () => {
    const oneOne = APT_GRAPH.nodes.find((n) => n.x === 1 && n.y === 1)!;
    const reachable = legalNextNodes(APT_GRAPH, { x: 1, y: 1 });
    expect(reachable).not.toContain(oneOne);
  });

  it('isLegalNextNode true only when target is a plotted node within Manhattan 2', () => {
    // (1, 1) is plotted on Apt + within 2 of (0, 0).
    expect(isLegalNextNode(APT_GRAPH, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
    // (0, 0) → same cell is not legal.
    expect(isLegalNextNode(APT_GRAPH, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    // Intermediate (1, 0) is not a plotted node on Apt — not legal as a take-step target.
    expect(isLegalNextNode(APT_GRAPH, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });
});

describe('applyDir / findNodeAt (single-step moves, rules/52)', () => {
  it('applies the right offset for each orthogonal direction', () => {
    expect(applyDir({ x: 2, y: 2 }, 'up')).toEqual({ x: 2, y: 3 });
    expect(applyDir({ x: 2, y: 2 }, 'down')).toEqual({ x: 2, y: 1 });
    expect(applyDir({ x: 2, y: 2 }, 'left')).toEqual({ x: 1, y: 2 });
    expect(applyDir({ x: 2, y: 2 }, 'right')).toEqual({ x: 3, y: 2 });
  });

  it('returns null when the move would leave the grid', () => {
    expect(applyDir({ x: 0, y: 0 }, 'left')).toBeNull();
    expect(applyDir({ x: 0, y: 0 }, 'down')).toBeNull();
    expect(applyDir({ x: TYPE_GRAPH_X_MAX, y: TYPE_GRAPH_Y_MAX }, 'right')).toBeNull();
    expect(applyDir({ x: TYPE_GRAPH_X_MAX, y: TYPE_GRAPH_Y_MAX }, 'up')).toBeNull();
  });

  it('findNodeAt returns the plotted node or null for an intermediate cell', () => {
    expect(findNodeAt(APT_GRAPH, { x: 1, y: 1 })?.x).toBe(1);
    // (0, 0) is origo — not a plotted node.
    expect(findNodeAt(APT_GRAPH, { x: 0, y: 0 })).toBeNull();
  });
});

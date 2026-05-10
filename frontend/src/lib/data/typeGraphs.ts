/**
 * typeGraphs.ts - Apt / Core / Prime advancement graphs (rules/17).
 *
 * Origo at (0, 0) — NOT plotted. Body-text values from rules/18 used at origo.
 * The plotted nodes start at (1, 1) and onward; advancement is strictly
 * one orthogonal step per qualifying session (rules/52). A qualifying
 * session is one in which the character survived a Shadow Encounter of
 * degree > current Shadow. Strict no-banking: use it or lose it within
 * the session — there is no carry-over inventory of banked sessions.
 * Reaching a plotted node 2 steps away requires advancing across two
 * separate sessions.
 */

import type { CharacterType } from '$lib/models/Enums';

export type NodeKind = 'open' | 'double' | 'filled' | 'double_filled';

export type Corner = 'TL' | 'TR' | 'BL' | 'BR';

export interface SatellitePlacement {
  satellite: 'close' | 'ranged' | 'implants';
  corner: Corner;
}

export interface TypeGraphNode {
  /** Shadow value at this node. */
  x: number;
  /** Gunta value at this node. */
  y: number;
  /** Spaces available (number; null = unchanged from prior). */
  spaces: number | null;
  kind: NodeKind;
  /** Floor for Close (e.g. C^2 — only raise to 2 if currently below). */
  closeFloor?: number;
  /** Floor for Ranged. */
  rangedFloor?: number;
  /** Floor for Implants. */
  implantsFloor?: number;
  /** Notes text from source ("new keyword + rearrange", etc.) */
  notes?: string;
  /** Per-satellite corner placement, matching the printed rulebook layout. */
  satellitePlacements?: SatellitePlacement[];
}

export interface TypeGraphDef {
  type: CharacterType;
  /** Origo body-text values per rules/18. */
  origo: {
    spaces: number;
    implants: number;
    shadow: number;
    gunta: number;
    closeStart: number;  // Default starting Close at origo
    rangedStart: number; // Default starting Ranged at origo
  };
  nodes: TypeGraphNode[];
}

export const APT_GRAPH: TypeGraphDef = {
  type: 'apt',
  origo: {
    spaces: 1,
    implants: 1,
    shadow: 0,
    gunta: 0,
    closeStart: 0,
    rangedStart: 1
  },
  nodes: [
    {
      x: 1, y: 1, spaces: 1, kind: 'open',
      implantsFloor: 2, rangedFloor: 1, closeFloor: 1,
      notes: 'First advancement node — implants 2, both C/R 1.',
      satellitePlacements: [
        { satellite: 'implants', corner: 'TL' },
        { satellite: 'ranged', corner: 'BL' },
        { satellite: 'close', corner: 'BR' }
      ]
    },
    {
      x: 3, y: 1, spaces: 2, kind: 'open',
      closeFloor: 2, implantsFloor: 3,
      satellitePlacements: [
        { satellite: 'close', corner: 'TR' },
        { satellite: 'implants', corner: 'BR' }
      ]
    },
    {
      x: 5, y: 1, spaces: 3, kind: 'open',
      rangedFloor: 2, closeFloor: 3, implantsFloor: 4,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'BL' },
        { satellite: 'implants', corner: 'BR' }
      ]
    },
    {
      x: 7, y: 1, spaces: 4, kind: 'double',
      closeFloor: 4, implantsFloor: 5, rangedFloor: 3,
      notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'TR' },
        { satellite: 'implants', corner: 'BR' }
      ]
    },
    {
      x: 2, y: 2, spaces: 2, kind: 'double',
      rangedFloor: 2,
      notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' }
      ]
    },
    {
      x: 4, y: 2, spaces: 3, kind: 'double_filled',
      notes: 'New keyword + rearrange.',
      satellitePlacements: []
    },
    {
      x: 6, y: 2, spaces: 4, kind: 'open',
      rangedFloor: 4, implantsFloor: 3,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TR' },
        { satellite: 'implants', corner: 'BL' }
      ]
    },
    {
      x: 1, y: 3, spaces: 2, kind: 'open',
      closeFloor: 2, rangedFloor: 2,
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'BL' }
      ]
    },
    {
      x: 3, y: 3, spaces: 3, kind: 'open',
      rangedFloor: 3, closeFloor: 2,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'TR' }
      ]
    },
    {
      x: 5, y: 3, spaces: 4, kind: 'double',
      closeFloor: 2,
      notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'close', corner: 'BL' }
      ]
    },
    {
      x: 7, y: 3, spaces: 4, kind: 'open',
      closeFloor: 3, rangedFloor: 5,
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'TR' }
      ]
    },
    {
      x: 2, y: 4, spaces: null, kind: 'filled',
      notes: 'Rearrange (no spaces).',
      satellitePlacements: []
    },
    {
      x: 6, y: 4, spaces: 4, kind: 'double_filled',
      notes: 'New keyword + rearrange (4 spaces).',
      satellitePlacements: []
    }
  ]
};

export const CORE_GRAPH: TypeGraphDef = {
  type: 'core',
  origo: {
    spaces: 1,
    implants: 0,
    shadow: 0,
    gunta: 0,
    closeStart: 0,
    rangedStart: 0
  },
  nodes: [
    { x: 1, y: 1, spaces: 2, kind: 'open', implantsFloor: 1, notes: 'First advancement — spaces 2, implants 1.',
      satellitePlacements: [
        { satellite: 'implants', corner: 'BL' }
      ] },
    { x: 3, y: 1, spaces: 3, kind: 'double', closeFloor: 1, implantsFloor: 1, notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'close', corner: 'BL' },
        { satellite: 'implants', corner: 'BR' }
      ] },
    { x: 5, y: 1, spaces: null, kind: 'filled', rangedFloor: 1, closeFloor: 2, implantsFloor: 2, notes: 'Rearrange + bond swap.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'BL' },
        { satellite: 'implants', corner: 'BR' }
      ] },
    { x: 7, y: 1, spaces: 4, kind: 'open', closeFloor: 3, rangedFloor: 2, implantsFloor: 3,
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'TR' },
        { satellite: 'implants', corner: 'BR' }
      ] },
    { x: 2, y: 2, spaces: 3, kind: 'open', implantsFloor: 2,
      satellitePlacements: [
        { satellite: 'implants', corner: 'BL' }
      ] },
    { x: 4, y: 2, spaces: 4, kind: 'double', implantsFloor: 3, notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'implants', corner: 'BL' }
      ] },
    { x: 6, y: 2, spaces: 5, kind: 'double', notes: 'New keyword.',
      satellitePlacements: [] },
    { x: 1, y: 3, spaces: 3, kind: 'double', rangedFloor: 1, notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'BL' }
      ] },
    { x: 3, y: 3, spaces: null, kind: 'filled', rangedFloor: 2, closeFloor: 1, notes: 'Rearrange + bond swap.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'TR' }
      ] },
    { x: 5, y: 3, spaces: 4, kind: 'open', rangedFloor: 3, closeFloor: 2, implantsFloor: 2,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'BL' },
        { satellite: 'implants', corner: 'BR' }
      ] },
    { x: 7, y: 3, spaces: 5, kind: 'open', implantsFloor: 3, rangedFloor: 3,
      satellitePlacements: [
        { satellite: 'implants', corner: 'TL' },
        { satellite: 'ranged', corner: 'TR' }
      ] },
    { x: 2, y: 4, spaces: null, kind: 'double_filled', notes: 'New keyword + rearrange + bond swap.',
      satellitePlacements: [] },
    { x: 6, y: 4, spaces: null, kind: 'double_filled', notes: 'New keyword + rearrange + bond swap.',
      satellitePlacements: [] }
  ]
};

export const PRIME_GRAPH: TypeGraphDef = {
  type: 'prime',
  origo: {
    spaces: 1,
    implants: 0,
    shadow: 0,
    gunta: 0,
    closeStart: 1,
    rangedStart: 1
  },
  nodes: [
    { x: 1, y: 1, spaces: null, kind: 'open', rangedFloor: 2, closeFloor: 2, notes: 'First advancement — both C/R 2. No new space.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'BL' },
        { satellite: 'close', corner: 'BR' }
      ] },
    { x: 3, y: 1, spaces: 2, kind: 'open', rangedFloor: 3, closeFloor: 3,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'BL' },
        { satellite: 'close', corner: 'TR' }
      ] },
    { x: 5, y: 1, spaces: 3, kind: 'open', rangedFloor: 4, closeFloor: 4,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'BL' }
      ] },
    { x: 7, y: 1, spaces: 4, kind: 'double', rangedFloor: 5, notes: 'New keyword.',
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TR' }
      ] },
    { x: 2, y: 2, spaces: 2, kind: 'open', implantsFloor: 1,
      satellitePlacements: [
        { satellite: 'implants', corner: 'TL' }
      ] },
    { x: 4, y: 2, spaces: 3, kind: 'double_filled', implantsFloor: 2, notes: 'New keyword + rearrange.',
      satellitePlacements: [
        { satellite: 'implants', corner: 'TL' }
      ] },
    { x: 6, y: 2, spaces: 4, kind: 'open', implantsFloor: 3,
      satellitePlacements: [
        { satellite: 'implants', corner: 'BL' }
      ] },
    { x: 1, y: 3, spaces: 2, kind: 'open', closeFloor: 3, rangedFloor: 2,
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'BL' }
      ] },
    { x: 3, y: 3, spaces: 3, kind: 'open', rangedFloor: 3, closeFloor: 4,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'TR' }
      ] },
    { x: 5, y: 3, spaces: 4, kind: 'open', rangedFloor: 4, closeFloor: 5,
      satellitePlacements: [
        { satellite: 'ranged', corner: 'TL' },
        { satellite: 'close', corner: 'TR' }
      ] },
    { x: 7, y: 3, spaces: null, kind: 'open', closeFloor: 6, rangedFloor: 5, notes: 'No new space.',
      satellitePlacements: [
        { satellite: 'close', corner: 'TL' },
        { satellite: 'ranged', corner: 'TR' }
      ] },
    { x: 2, y: 4, spaces: 3, kind: 'double', notes: 'New keyword.',
      satellitePlacements: [] },
    { x: 6, y: 4, spaces: 4, kind: 'double', notes: 'New keyword.',
      satellitePlacements: [] }
  ]
};

export const TYPE_GRAPHS: Record<CharacterType, TypeGraphDef> = {
  apt: APT_GRAPH,
  core: CORE_GRAPH,
  prime: PRIME_GRAPH
};

export function getTypeGraph(type: CharacterType): TypeGraphDef {
  return TYPE_GRAPHS[type];
}

// ============================================
// LEGAL NEXT-STEP NODES (rules/17 + rules/52)
// ============================================
//
// Per rules/17 + rules/52 the player advances "one step horizontally OR
// vertically per qualifying session (no diagonals)". Strict no-banking:
// each qualifying session = exactly one step in that session. Reaching
// a plotted node 2 steps away therefore requires advancing across TWO
// separate sessions. (A qualifying session is one in which the character
// survived at least one Shadow Encounter of degree > current Shadow.)
//
// This helper still reports nodes within Manhattan ≤ 2 — useful as a
// reference set for the advancement panel and AdvancementModal's legal-
// neighbor re-validation. The actual movement workflow (one-step-only
// per session) is enforced by the panel's "Take advancement step" UI,
// not by this helper.
//
// Equivalent expressed on the lattice:
//   plotted node B is "in reach within 2 sessions" from position A
//   iff Manhattan(A,B) = |A.x - B.x| + |A.y - B.y| ≤ 2  AND  A ≠ B
//
// Origo (0,0) is unplotted; the same rule applies (only (1,1) is within
// Manhattan 2 of origo for all three type-graphs).
export function legalNextNodes(
  graph: TypeGraphDef,
  pos: { x: number; y: number }
): TypeGraphNode[] {
  return graph.nodes.filter((n) => {
    if (n.x === pos.x && n.y === pos.y) return false;
    const dist = Math.abs(n.x - pos.x) + Math.abs(n.y - pos.y);
    return dist > 0 && dist <= 2;
  });
}

export function isLegalNextNode(
  graph: TypeGraphDef,
  pos: { x: number; y: number },
  target: { x: number; y: number }
): boolean {
  if (target.x === pos.x && target.y === pos.y) return false;
  const dist = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y);
  if (dist === 0 || dist > 2) return false;
  return graph.nodes.some((n) => n.x === target.x && n.y === target.y);
}

// ============================================
// SINGLE-STEP MOVES (rules/52, strict no-banking)
// ============================================
//
// Per rules/52 the player advances exactly one step orthogonally per
// qualifying session — no diagonals, no carry-over, no banked sessions.
// Plotted nodes are special positions; intermediate grid cells are valid
// stops but grant no node effects. The grid extends from (0,0) origo to
// (X_MAX, Y_MAX) per the type-graph viewBox.

export const TYPE_GRAPH_X_MAX = 7;
export const TYPE_GRAPH_Y_MAX = 4;

/** Orthogonal directions for single-step moves. */
export type OrthogonalDir = 'up' | 'down' | 'left' | 'right';
export const ORTHOGONAL_DIRS: { dir: OrthogonalDir; dx: number; dy: number; symbol: string }[] = [
  { dir: 'up', dx: 0, dy: 1, symbol: '↑' },
  { dir: 'down', dx: 0, dy: -1, symbol: '↓' },
  { dir: 'left', dx: -1, dy: 0, symbol: '←' },
  { dir: 'right', dx: 1, dy: 0, symbol: '→' }
];

/** Apply a one-step direction to a position; clamps to grid bounds. */
export function applyDir(
  pos: { x: number; y: number },
  dir: OrthogonalDir
): { x: number; y: number } | null {
  const offset = ORTHOGONAL_DIRS.find((d) => d.dir === dir);
  if (!offset) return null;
  const nx = pos.x + offset.dx;
  const ny = pos.y + offset.dy;
  if (nx < 0 || nx > TYPE_GRAPH_X_MAX || ny < 0 || ny > TYPE_GRAPH_Y_MAX) return null;
  return { x: nx, y: ny };
}

/** Look up a plotted node at an exact (x, y); null if the cell is intermediate. */
export function findNodeAt(
  graph: TypeGraphDef,
  pos: { x: number; y: number }
): TypeGraphNode | null {
  return graph.nodes.find((n) => n.x === pos.x && n.y === pos.y) ?? null;
}

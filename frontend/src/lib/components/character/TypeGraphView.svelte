<!--
  TypeGraphView.svelte — pixel-faithful SVG replica of the Apt / Core / Prime
  type-graph figures from rules/17.

  GEOMETRY
  ========
  The figures are a 2-D lattice drawn on a Shadow (x) × Gunta (y) plane.

      x  Shadow:  origo 0  ─►  7   (Apt / Core / Prime all reach 7)
      y  Gunta :  origo 0  ─►  4
      origo (0, 0) is the bottom-left "L"-corner — labelled "Origo".

  In the source PDF, the plotted nodes start at (1, 1) and are drawn at
  integer grid intersections. The grid is dashed and visible in the
  background. Nodes have four visual variants (rules/17):
    - open          (single thin black ring)
    - double        (two concentric thin rings — outer + inner)
    - filled        (single ring filled solid black)
    - double_filled (outer ring + solid black inner disc)
  Inside each ring is the spaces number (or blank if no space change).

  Around each node, "satellites" annotate the C^z, R^z, I^z modifier
  floors. Per rules/17 their relative position carries no information —
  we lay them out around the node corners for legibility.

  COORDINATE → PIXEL
  ==================
    pixelX = MARGIN_L + x * UNIT_X
    pixelY = MARGIN_T + (Y_RANGE - y) * UNIT_Y    (y inverted — math up, SVG down)
  Constants below are tuned so a 700-unit-wide plot reads well on phone +
  desktop. The viewBox keeps it crisp at every zoom level.

  PROPS
  =====
    graph           TypeGraphDef (preferred — pass the resolved graph)
    type            'apt' | 'core' | 'prime' (legacy fallback — looked up via getTypeGraph)
    currentPosition { x, y }    defaults to {0,0} = origo
    interactive     boolean     when true, clicks emit `advance` for legal neighbors
    mode            'view' | 'wizard'
    onadvance       (target) => void   parent listens to step-change requests

  Pass `graph` when the parent has the resolved active graph in hand
  (e.g. AdvancementPanel reading character.ownedGraphs[active]). Pass
  `type` for the legacy reference page that lists the static defaults.
  `graph` wins if both are supplied.
-->
<script lang="ts">
  import type { CharacterType } from '$lib/models/Enums';
  import { getTypeGraph, legalNextNodes, applyDir, ORTHOGONAL_DIRS, type TypeGraphDef, type TypeGraphNode } from '$lib/data/typeGraphs';

  interface Props {
    /**
     * Pre-resolved graph definition. When provided, this drives the view
     * and `type` is ignored. Use this when rendering a character's
     * active OwnedGraph (which may have custom edits the static default
     * doesn't know about).
     */
    graph?: TypeGraphDef;
    /** Legacy fallback — looked up via getTypeGraph(type) when `graph` is absent. */
    type?: CharacterType;
    /** Current type-graph position. Defaults to origo (0, 0). */
    currentPosition?: { x: number; y: number };
    /** When true, neighbor nodes are highlighted and clickable. */
    interactive?: boolean;
    /** 'wizard' enables click-to-advance UI; 'view' is read-only. */
    mode?: 'view' | 'wizard';
    /** Optional event handler — fires when player clicks a legal neighbor. */
    onadvance?: (target: { x: number; y: number; node?: TypeGraphNode }) => void;
    /**
     * Highlight a specific cell on the graph (e.g. the destination of a
     * pending advancement step). Used by the AdvancementPanel take-step
     * modal to preview where the chosen direction lands. Null/undefined
     * = no highlight.
     */
    highlightCell?: { x: number; y: number } | null;
    /**
     * Highlight all 4 orthogonal neighbors of the current position. Used
     * by the AdvancementPanel take-step modal while the player is still
     * picking a direction, so they see the four candidate cells at once.
     */
    highlightOrthogonals?: boolean;
  }

  let {
    graph: graphProp,
    type,
    currentPosition = { x: 0, y: 0 },
    interactive = false,
    mode = 'view',
    onadvance,
    highlightCell = null,
    highlightOrthogonals = false
  }: Props = $props();

  // ============================================
  // GEOMETRY CONSTANTS — tweak with care.
  // ============================================
  // Plot margins (axis labels + satellite labels live in these gutters).
  // Satellites + node halos can extend ~30 px past the node ring on every
  // side; pulsing halos go to NODE_R + 14 ≈ 36; "HERE" marker sits at
  // cy - NODE_R - 16. Generous gutters on every edge so the rightmost column
  // (x=7 for Apt; x=6 for Core/Prime), the leftmost column (x=0 with origo
  // label + Tank-Born marker), top row (y=4 satellites + HERE), and bottom
  // axis labels all stay inside the viewBox at every zoom level.
  const MARGIN_L = 80;
  const MARGIN_R = 80;
  const MARGIN_T = 56;
  const MARGIN_B = 56;

  // viewBox dimensions (kept consistent across types so layout swaps cleanly).
  // Width / height are derived from margins + plot so they always frame the
  // satellites cleanly. Increase here, not at the call site.
  const VB_WIDTH = 860;
  const VB_HEIGHT = 520;

  // Logical coordinate range (max Shadow on x; max Gunta on y).
  const X_RANGE = 7;
  const Y_RANGE = 4;

  // Pixel dimensions of the inner plot area.
  const PLOT_W = VB_WIDTH - MARGIN_L - MARGIN_R;
  const PLOT_H = VB_HEIGHT - MARGIN_T - MARGIN_B;

  // Pixels per logical unit.
  const UNIT_X = PLOT_W / X_RANGE; // ≈ 100 px per Shadow
  const UNIT_Y = PLOT_H / Y_RANGE; // ≈ 99 px per Gunta

  // Node visual sizes (px in the viewBox).
  const NODE_R = 22; // outer ring radius (open / double)
  const NODE_R_INNER = 12; // inner ring radius (double variants)

  // ============================================
  // CONVERTERS
  // ============================================
  function px(x: number): number {
    return MARGIN_L + x * UNIT_X;
  }
  function py(y: number): number {
    // Invert: SVG y grows downward, math y grows upward.
    return MARGIN_T + (Y_RANGE - y) * UNIT_Y;
  }

  // ============================================
  // GRAPH DATA — `graph` prop wins; otherwise fall back to type lookup.
  // ============================================
  const graph = $derived<TypeGraphDef>(
    graphProp ?? getTypeGraph((type ?? 'apt') as CharacterType)
  );
  const nodes = $derived(graph.nodes);

  // ============================================
  // PLOTTED NODES IN REACH — Manhattan ≤ 2 (rules/17 + rules/52)
  // ============================================
  // Per rules/52 strict no-banking, each qualifying session = exactly ONE
  // orthogonal step. Plotted nodes are typically 2 grid units apart, so
  // reaching one usually requires TWO separate sessions. `legalNextNodes`
  // returns plotted nodes within Manhattan ≤ 2 — the set "reachable
  // within at most 2 sessions". Used here only when this view is rendered
  // in `interactive + wizard` mode (the legacy multi-step picker) — the
  // current AdvancementPanel.svelte does not call into wizard mode any
  // more, so this set is dormant in the active advancement flow. Kept
  // for the reference page and for future re-use.
  const neighbors = $derived(legalNextNodes(graph, currentPosition));
  const isClickable = $derived(interactive && mode === 'wizard');

  function nodeIsCurrent(n: TypeGraphNode): boolean {
    return n.x === currentPosition.x && n.y === currentPosition.y;
  }
  function nodeIsNeighbor(n: TypeGraphNode): boolean {
    return neighbors.some((nb) => nb.x === n.x && nb.y === n.y);
  }
  function originIsCurrent(): boolean {
    return currentPosition.x === 0 && currentPosition.y === 0;
  }
  /** Player is on an unplotted intermediate cell (not origo, not a plotted node). */
  const onIntermediate = $derived(
    !(currentPosition.x === 0 && currentPosition.y === 0) &&
      !nodes.some((n) => n.x === currentPosition.x && n.y === currentPosition.y)
  );

  /**
   * The 4 orthogonal cells reachable in one step from current position.
   * Only those inside the grid (applyDir returns null otherwise).
   * Used to render the four-cell halo when `highlightOrthogonals` is true.
   */
  const orthogonalCells = $derived(
    ORTHOGONAL_DIRS.map((d) => applyDir(currentPosition, d.dir)).filter(
      (p): p is { x: number; y: number } => p !== null
    )
  );

  /** Quick check — is this cell the explicit highlightCell? */
  function cellIsHighlighted(x: number, y: number): boolean {
    return !!highlightCell && highlightCell.x === x && highlightCell.y === y;
  }
  /** Quick check — is this cell one of the orthogonal-1 neighbors AND we're showing them? */
  function cellIsOrthogonalCandidate(x: number, y: number): boolean {
    if (!highlightOrthogonals) return false;
    return orthogonalCells.some((c) => c.x === x && c.y === y);
  }

  // ============================================
  // CLICK HANDLER
  // ============================================
  function handleNodeClick(n: TypeGraphNode) {
    if (!isClickable) return;
    if (!nodeIsNeighbor(n)) return;
    onadvance?.({ x: n.x, y: n.y, node: n });
  }

  // ============================================
  // SATELLITE LABEL POSITIONING — RULEBOOK CONVENTION
  // ============================================
  // Per the printed rulebook (rules/17), each C^z / R^z / I^z satellite
  // sits in one of four corner slots around the node. Per-corner the
  // *letter* (C/R/I) is the inner anchor — close to the node ring — and
  // the *number* is rendered as a sub/super-script floating slightly
  // further out, away from the node center. While rules/17's *body text*
  // says relative position carries no informational meaning, the *figures*
  // print each satellite in a specific corner per node — and we mirror
  // those exactly so the rendered graph reads as a faithful reproduction
  // of the rulebook diagram. Apt nodes are mapped via the per-node
  // `satellitePlacements` field on TypeGraphNode (rulebook-faithful).
  // Core / Prime nodes have no override yet and fall back to a
  // deterministic mapping — see SAT_CORNER below.
  //
  // Per quadrant:
  //   TR : letter then ²-superscript above-and-to-the-right of the letter
  //   TL : ²-superscript above-and-to-the-left  of the letter, then letter
  //   BL : ₂-subscript  below-and-to-the-left  of the letter, then letter
  //   BR : letter then ₂-subscript below-and-to-the-right of the letter
  //
  // All four slots use the same RADIAL distance from the node center,
  // so the four corners look balanced no matter which subset is filled.
  type Corner = 'TL' | 'TR' | 'BL' | 'BR';

  interface Satellite {
    letter: 'C' | 'R' | 'I';
    /** Floor digit (the superscript/subscript) — we render as text. */
    digit: number;
    corner: Corner;
  }

  // Letter sits ~28 px out diagonally; number sits ~12 px further out
  // along the same diagonal. Equal radial distance per slot keeps
  // opposite corners visually balanced.
  const LETTER_OFFSET = 28;
  const NUMBER_OFFSET = 12;
  const LETTER_FONT = 12;
  const NUMBER_FONT = Math.round(LETTER_FONT * 0.9);

  /** Deterministic corner mapping — used as the FALLBACK when a node has no
   *  per-node `satellitePlacements` override (e.g. Core / Prime, until those
   *  graphs are mapped from the rulebook). Picked so a fully-loaded node
   *  (C, R, I) reads naturally: Close TL, Ranged TR, Implants BR. */
  const SAT_CORNER: Record<'C' | 'R' | 'I', Corner> = {
    C: 'TL',
    R: 'TR',
    I: 'BR'
  };

  /** Map from internal satellite name → letter glyph + floor field. */
  const SAT_LETTER: Record<'close' | 'ranged' | 'implants', 'C' | 'R' | 'I'> = {
    close: 'C',
    ranged: 'R',
    implants: 'I'
  };
  function floorFor(n: TypeGraphNode, sat: 'close' | 'ranged' | 'implants'): number | undefined {
    if (sat === 'close') return n.closeFloor;
    if (sat === 'ranged') return n.rangedFloor;
    return n.implantsFloor;
  }

  function satellitesFor(n: TypeGraphNode): Satellite[] {
    // PER-NODE OVERRIDE — when `satellitePlacements` is defined, render
    // exactly the satellites listed in that array, in the corners specified.
    // A satellite is still only rendered if its corresponding floor field
    // exists on the node (placement table tells WHERE; floor fields tell
    // WHAT number). Empty array → render no satellites (e.g. filled /
    // double_filled rearrange-only nodes).
    if (n.satellitePlacements !== undefined) {
      const out: Satellite[] = [];
      for (const p of n.satellitePlacements) {
        const digit = floorFor(n, p.satellite);
        if (digit === undefined) continue;
        out.push({ letter: SAT_LETTER[p.satellite], digit, corner: p.corner });
      }
      return out;
    }
    // FALLBACK — deterministic mapping for graphs not yet mapped to
    // rulebook (currently Core + Prime).
    const out: Satellite[] = [];
    if (n.closeFloor !== undefined) {
      out.push({ letter: 'C', digit: n.closeFloor, corner: SAT_CORNER.C });
    }
    if (n.rangedFloor !== undefined) {
      out.push({ letter: 'R', digit: n.rangedFloor, corner: SAT_CORNER.R });
    }
    if (n.implantsFloor !== undefined) {
      out.push({ letter: 'I', digit: n.implantsFloor, corner: SAT_CORNER.I });
    }
    return out;
  }

  /** Pixel offsets for the LETTER glyph in a given corner. */
  function letterOffset(corner: Corner): { dx: number; dy: number } {
    switch (corner) {
      case 'TL':
        return { dx: -LETTER_OFFSET, dy: -LETTER_OFFSET };
      case 'TR':
        return { dx: LETTER_OFFSET, dy: -LETTER_OFFSET };
      case 'BL':
        return { dx: -LETTER_OFFSET, dy: LETTER_OFFSET };
      case 'BR':
        return { dx: LETTER_OFFSET, dy: LETTER_OFFSET };
    }
  }

  /** Pixel offsets for the NUMBER glyph relative to node center.
   *  The number floats further out along the same diagonal as the letter
   *  AND is vertically nudged half a text-height up (TR/TL = superscript)
   *  or down (BR/BL = subscript), so the eye reads `²C` / `C²` etc. */
  function numberOffset(corner: Corner): { dx: number; dy: number } {
    switch (corner) {
      case 'TL':
        // Number sits to the LEFT of the letter, slightly higher.
        return { dx: -LETTER_OFFSET - NUMBER_OFFSET, dy: -LETTER_OFFSET - 5 };
      case 'TR':
        // Number sits to the RIGHT of the letter, slightly higher.
        return { dx: LETTER_OFFSET + NUMBER_OFFSET, dy: -LETTER_OFFSET - 5 };
      case 'BL':
        // Number sits to the LEFT of the letter, slightly lower.
        return { dx: -LETTER_OFFSET - NUMBER_OFFSET, dy: LETTER_OFFSET + 5 };
      case 'BR':
        // Number sits to the RIGHT of the letter, slightly lower.
        return { dx: LETTER_OFFSET + NUMBER_OFFSET, dy: LETTER_OFFSET + 5 };
    }
  }

  function satAnchor(corner: Corner): 'start' | 'middle' | 'end' {
    return corner === 'TR' || corner === 'BR' ? 'start' : 'end';
  }

  // ============================================
  // TOOLTIPS
  // ============================================
  function tooltipFor(n: TypeGraphNode): string {
    const bits: string[] = [];
    bits.push(`(${n.x}, ${n.y}) — ${n.kind.replace('_', ' + ')}`);
    if (n.spaces !== null) bits.push(`spaces ${n.spaces}`);
    if (n.closeFloor !== undefined) bits.push(`C floor ${n.closeFloor}`);
    if (n.rangedFloor !== undefined) bits.push(`R floor ${n.rangedFloor}`);
    if (n.implantsFloor !== undefined) bits.push(`I floor ${n.implantsFloor}`);
    if (n.notes) bits.push(n.notes);
    return bits.join(' · ');
  }
</script>

<div class="w-full">
  <svg
    viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    class="block w-full select-none"
    role="img"
    aria-label={`${graph.type} type graph — current position (${currentPosition.x}, ${currentPosition.y})`}
  >
    <!-- =====================================================
         BACKGROUND GRID (dashed, theme-aware)
         ===================================================== -->
    <g stroke="var(--graph-grid)" stroke-width="0.6" stroke-dasharray="2 3" fill="none">
      <!-- Vertical lines — for x = 0..X_RANGE -->
      {#each Array.from({ length: X_RANGE + 1 }, (_, i) => i) as gx (gx)}
        <line x1={px(gx)} y1={py(0)} x2={px(gx)} y2={py(Y_RANGE)} />
      {/each}
      <!-- Horizontal lines — for y = 0..Y_RANGE -->
      {#each Array.from({ length: Y_RANGE + 1 }, (_, i) => i) as gy (gy)}
        <line x1={px(0)} y1={py(gy)} x2={px(X_RANGE)} y2={py(gy)} />
      {/each}
    </g>

    <!-- =====================================================
         GRID INTERSECTION DOTS — every (x, y) gets a faint dot so
         intermediate cells are visible when the player is parked there.
         Plotted-node positions overdraw their own bigger ring later.
         ===================================================== -->
    <g fill="var(--graph-grid)">
      {#each Array.from({ length: X_RANGE + 1 }, (_, i) => i) as gx (gx)}
        {#each Array.from({ length: Y_RANGE + 1 }, (_, i) => i) as gy (gy)}
          <circle cx={px(gx)} cy={py(gy)} r="1.4" />
        {/each}
      {/each}
    </g>

    <!-- =====================================================
         CANDIDATE ORTHOGONAL HIGHLIGHTS — when the take-step modal is
         open and the player is still picking a direction, glow each of
         the four orthogonal neighbors so the eye finds them quickly.
         Drawn before the chosen-cell highlight so the latter overdraws
         it for the picked direction.
         ===================================================== -->
    {#if highlightOrthogonals}
      <g>
        {#each orthogonalCells as c (`ortho-${c.x}-${c.y}`)}
          <circle
            cx={px(c.x)}
            cy={py(c.y)}
            r="14"
            fill="var(--graph-step-fill)"
            stroke="var(--graph-step-stroke)"
            stroke-width="1.2"
            stroke-dasharray="3 2"
            opacity="0.55"
          />
        {/each}
      </g>
    {/if}

    <!-- =====================================================
         CHOSEN-CELL HIGHLIGHT — preview the take-step destination once
         the player has picked a direction. Solid dashed ring distinguishes
         it from the four candidate orthogonals above.
         ===================================================== -->
    {#if highlightCell}
      <circle
        cx={px(highlightCell.x)}
        cy={py(highlightCell.y)}
        r="18"
        fill="var(--graph-step-fill-hover, var(--graph-step-fill))"
        stroke="var(--graph-step-stroke)"
        stroke-width="1.8"
        stroke-dasharray="4 2"
      />
    {/if}

    <!-- =====================================================
         AXES (solid corner: bottom-left "L")
         ===================================================== -->
    <g stroke="var(--graph-axis)" stroke-width="1.5" fill="none">
      <!-- y-axis line -->
      <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(Y_RANGE)} />
      <!-- x-axis line -->
      <line x1={px(0)} y1={py(0)} x2={px(X_RANGE)} y2={py(0)} />
    </g>

    <!-- =====================================================
         AXIS LABELS — italic "Gunta" (y) and "Shadow" (x)
         ===================================================== -->
    <!-- y-axis title — vertical, rotated -90° -->
    <text
      x={MARGIN_L - 38}
      y={MARGIN_T + PLOT_H / 2}
      transform={`rotate(-90, ${MARGIN_L - 38}, ${MARGIN_T + PLOT_H / 2})`}
      text-anchor="middle"
      fill="var(--graph-axis-title)"
      font-style="italic"
      font-size="14"
    >Gunta</text>

    <!-- x-axis title — horizontal, below the axis -->
    <text
      x={MARGIN_L + PLOT_W / 2}
      y={py(0) + 38}
      text-anchor="middle"
      fill="var(--graph-axis-title)"
      font-style="italic"
      font-size="14"
    >Shadow</text>

    <!-- "Origo" label — italic, bottom-left of the plane -->
    <text
      x={px(0) - 6}
      y={py(0) + 18}
      text-anchor="end"
      fill="var(--graph-origo-label)"
      font-style="italic"
      font-size="11"
    >Origo</text>

    <!-- =====================================================
         AXIS TICK LABELS (1..X_RANGE on x; 1..Y_RANGE on y)
         ===================================================== -->
    {#each Array.from({ length: X_RANGE }, (_, i) => i + 1) as tx (tx)}
      <text
        x={px(tx)}
        y={py(0) + 16}
        text-anchor="middle"
        fill="var(--graph-tick-label)"
        font-size="10"
      >{tx}</text>
    {/each}
    {#each Array.from({ length: Y_RANGE }, (_, i) => i + 1) as ty (ty)}
      <text
        x={px(0) - 8}
        y={py(ty) + 3}
        text-anchor="end"
        fill="var(--graph-tick-label)"
        font-size="10"
      >{ty}</text>
    {/each}

    <!-- =====================================================
         ORIGO marker — drawn as a small "0,0" circle if the
         character is at origo. Otherwise just the label.
         ===================================================== -->
    {#if originIsCurrent() || onIntermediate}
      {@const cx = px(currentPosition.x)}
      {@const cy = py(currentPosition.y)}
      <g>
        <!-- Pulsing halo around the player marker (origo or intermediate cell) -->
        <circle
          cx={cx}
          cy={cy}
          r={NODE_R + 6}
          fill="var(--graph-you-halo-fill)"
          stroke="var(--graph-you-halo-stroke)"
          stroke-width="1.5"
        >
          <animate attributeName="r" values={`${NODE_R + 6};${NODE_R + 12};${NODE_R + 6}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill="var(--graph-you-fill)"
          stroke="var(--graph-you-stroke)"
          stroke-width="1"
        />
        <!-- Caption sits BELOW the marker, horizontally centered.
             Was previously to the right at same y, which crowded the
             node and overlapped neighbouring satellites at small zooms. -->
        <text
          x={cx}
          y={cy + 48}
          text-anchor="middle"
          fill="var(--graph-you-text)"
          font-size="10"
          font-weight="700"
        >YOU{onIntermediate ? ` (${currentPosition.x},${currentPosition.y})` : ''}</text>
      </g>
    {/if}

    <!-- =====================================================
         NODES — render every plotted node with the right kind.
         Order matters: draw rings first, then numbers, then
         satellites (so labels never get covered by halo). The
         current-node halo and the neighbor-highlight ring are
         drawn here too, before the node body.
         ===================================================== -->
    {#each nodes as n (`${n.x}-${n.y}`)}
      {@const cx = px(n.x)}
      {@const cy = py(n.y)}
      {@const current = nodeIsCurrent(n)}
      {@const neighbor = nodeIsNeighbor(n) && !current}

      <g class={isClickable && neighbor ? 'cursor-pointer' : ''}>
        <title>{tooltipFor(n)}</title>

        <!-- Pulsing halo if this is the current node -->
        {#if current}
          <circle
            cx={cx}
            cy={cy}
            r={NODE_R + 8}
            fill="var(--graph-you-halo-fill)"
            stroke="var(--graph-you-halo-stroke)"
            stroke-width="1.5"
          >
            <animate attributeName="r" values={`${NODE_R + 8};${NODE_R + 14};${NODE_R + 8}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        {/if}

        <!-- Highlight ring for legal next-step nodes — only when wizard mode
             is actively engaged (picker open). Without this gate the dashed
             ring would show permanently, suggesting nodes are reachable in a
             single step (they aren't — strict no-banking, see rules/52). -->
        {#if neighbor && isClickable}
          <circle
            cx={cx}
            cy={cy}
            r={NODE_R + 5}
            class="graph-step transition-colors"
            stroke-width="1.2"
            stroke-dasharray="3 2"
          />
        {/if}

        <!-- ===================================================
             NODE BODY (varies by `kind`)
             - open          : single ring, open interior
             - double        : outer ring + inner ring, both open
             - filled        : single ring with SOLID interior
             - double_filled : outer ring + smaller SOLID inner disc
             Color convention — colors come from `--graph-*` CSS vars
             defined in app.css (per-mode), so the same markup reads in
             both dark and light themes:
               - LIGHT mode (rulebook fidelity): rings are slate-900
                 (black-equivalent), filled disc is solid black with
                 WHITE number. Open interior is white.
               - DARK mode: rings are light-grey/white, filled disc is
                 solid white with DARK number. Open interior is
                 transparent so the page bg shows through.
             =================================================== -->
        {#if n.kind === 'open'}
          <!-- Single ring with theme-appropriate interior. -->
          <circle cx={cx} cy={cy} r={NODE_R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        {:else if n.kind === 'double'}
          <!-- Outer ring + concentric inner ring, both open inside. -->
          <circle cx={cx} cy={cy} r={NODE_R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
          <circle cx={cx} cy={cy} r={NODE_R_INNER + 4} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.2" />
        {:else if n.kind === 'filled'}
          <!-- Single ring + SOLID interior. -->
          <circle cx={cx} cy={cy} r={NODE_R} fill="var(--graph-node-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        {:else if n.kind === 'double_filled'}
          <!-- Outer ring (open) + inner SOLID disc. -->
          <circle cx={cx} cy={cy} r={NODE_R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
          <circle cx={cx} cy={cy} r={NODE_R_INNER + 4} fill="var(--graph-node-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.2" />
        {/if}

        <!-- Inner spaces number — sits dark-on-amber on filled discs
             (both themes), and color-flips for open rings (light-on-dark
             vs dark-on-light) so it always reads against the bg. -->
        {#if n.spaces !== null}
          {@const onSolid = n.kind === 'filled' || n.kind === 'double_filled'}
          <text
            x={cx}
            y={cy + 5}
            text-anchor="middle"
            font-weight="700"
            font-size="14"
            fill={onSolid ? 'var(--graph-node-fill-text)' : 'var(--graph-node-text)'}
          >{n.spaces}</text>
        {/if}

        <!-- Click target — covers the whole node area when interactive -->
        {#if isClickable && neighbor}
          <circle
            class="graph-step-target"
            cx={cx}
            cy={cy}
            r={NODE_R + 8}
            fill="transparent"
            stroke="none"
            tabindex="0"
            role="button"
            aria-label={`Advance to (${n.x}, ${n.y}) — ${tooltipFor(n)}`}
            onclick={() => handleNodeClick(n)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNodeClick(n);
              }
            }}
          />
        {/if}

        <!-- Satellites: C^z / R^z / I^z floor labels.
             Each satellite renders as TWO text elements — the letter
             close to the node ring, the digit further out (sub/super
             script). Matches the printed rulebook quadrant convention. -->
        {#each satellitesFor(n) as sat (sat.letter)}
          {@const lo = letterOffset(sat.corner)}
          {@const no = numberOffset(sat.corner)}
          {@const anchor = satAnchor(sat.corner)}
          <!-- Letter (anchored close to the node) -->
          <text
            x={cx + lo.dx}
            y={cy + lo.dy + 4}
            text-anchor={anchor}
            fill="var(--graph-satellite)"
            font-size={LETTER_FONT}
            font-weight="700"
            font-family="ui-serif, Georgia, serif"
          >{sat.letter}</text>
          <!-- Number (sub/super-script, anchored further out) -->
          <text
            x={cx + no.dx}
            y={cy + no.dy + 4}
            text-anchor={anchor}
            fill="var(--graph-satellite)"
            font-size={NUMBER_FONT}
            font-weight="600"
            font-family="ui-serif, Georgia, serif"
          >{sat.digit}</text>
        {/each}

        <!-- "HERE" caption sits BELOW the node, horizontally centered.
             Matches the YOU caption rule — offset down so it doesn't
             collide with top-row satellites or the node's pulsing halo. -->
        {#if current}
          <text
            x={cx}
            y={cy + NODE_R + 46}
            text-anchor="middle"
            fill="var(--graph-you-text)"
            font-size="9"
            font-weight="700"
          >HERE</text>
        {/if}
      </g>
    {/each}
  </svg>

  {#if interactive && mode === 'wizard' && neighbors.length > 0}
    <p class="mt-2 text-center text-xs text-neutral-400">
      Click a dashed ring to advance to that node. {neighbors.length} legal neighbor{neighbors.length === 1 ? '' : 's'}.
    </p>
  {:else if interactive && mode === 'wizard' && neighbors.length === 0}
    <p class="mt-2 text-center text-xs text-amber-300">No legal next-step nodes from current position.</p>
  {/if}
</div>

<style>
  /* Theme-aware "legal next step" ring. CSS-class form so the hover-fill
     swap can target a separate var. Vars come from app.css :root /
     html.light, so this rule reads correctly in both themes. */
  :global(.graph-step) {
    fill: var(--graph-step-fill);
    stroke: var(--graph-step-stroke);
  }
  :global(.graph-step:hover) {
    fill: var(--graph-step-fill-hover);
  }
  /* Keyboard focus on invisible click-target circle. Browser default
     outline draws a rectangular box around the SVG element — replace
     it with a high-contrast circular stroke that follows the node. */
  :global(.graph-step-target) {
    outline: none;
  }
  :global(.graph-step-target:focus-visible) {
    stroke: var(--graph-focus-ring);
    stroke-width: 2.5;
    stroke-dasharray: 4 2;
  }
</style>

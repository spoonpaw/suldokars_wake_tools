<!--
  TypeGraphLegend.svelte — explanatory key for the SVG type-graph figures.

  Shows miniature versions of each node variant (open / double / filled /
  double_filled) plus the satellite-label conventions and the
  axis-coordinate meaning. Designed to live below or beside a TypeGraphView.
-->
<script lang="ts">
  // No props — purely presentational.
  // Mini-node radii so the legend swatches are smaller than the main graph.
  const R = 14;
  const R_INNER = 6;
</script>

<div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
  <h3 class="mb-2 text-sm font-semibold text-neutral-200">Reading the graph</h3>

  <ul class="grid grid-cols-2 gap-3 text-xs text-neutral-300 sm:grid-cols-4">
    <!-- open: single ring, theme-appropriate interior -->
    <li class="flex items-center gap-2">
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="var(--graph-node-text)">2</text>
      </svg>
      <span>
        <span class="block font-semibold text-neutral-100">Open</span>
        <span class="text-neutral-400">advancement only</span>
      </span>
    </li>

    <!-- double: two concentric rings, both open -->
    <li class="flex items-center gap-2">
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        <circle cx="18" cy="18" r={R_INNER + 4} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.2" />
        <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="var(--graph-node-text)">3</text>
      </svg>
      <span>
        <span class="block font-semibold text-neutral-100">Double</span>
        <span class="text-neutral-400">+ new keyword</span>
      </span>
    </li>

    <!-- filled: single ring + SOLID interior (with contrasting number) -->
    <li class="flex items-center gap-2">
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="var(--graph-node-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="var(--graph-node-fill-text)">1</text>
      </svg>
      <span>
        <span class="block font-semibold text-neutral-100">Filled</span>
        <span class="text-neutral-400">rearrange (+ bond swap, Core)</span>
      </span>
    </li>

    <!-- double + filled: outer ring (open) + inner solid disc -->
    <li class="flex items-center gap-2">
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="var(--graph-open-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.6" />
        <circle cx="18" cy="18" r={R_INNER + 4} fill="var(--graph-node-fill)" stroke="var(--graph-node-stroke)" stroke-width="1.2" />
      </svg>
      <span>
        <span class="block font-semibold text-neutral-100">Double + Filled</span>
        <span class="text-neutral-400">keyword + rearrange (+ bond)</span>
      </span>
    </li>
  </ul>
  <p class="mt-2 text-xs text-neutral-500">
    Light mode matches the printed rulebook: black ring + solid-black filled disc with white number.
    Dark mode flips to a light ring + solid-white disc with a dark number for readability on the
    dark page.
  </p>

  <hr class="my-3 border-neutral-800" />

  <dl class="grid gap-2 text-xs text-neutral-300 sm:grid-cols-2">
    <div>
      <dt class="font-semibold text-neutral-100">Inside number</dt>
      <dd class="text-neutral-400">Spaces available at this node (blank = no change).</dd>
    </div>
    <div>
      <dt class="font-semibold text-neutral-100">C<sup>z</sup> / R<sup>z</sup> / I<sup>z</sup></dt>
      <dd class="text-neutral-400">
        Satellite floors. If your Close / Ranged / max-Implants is below z, raise it to z;
        otherwise no effect. Their position around the node is for legibility only — no
        meaning attached.
      </dd>
    </div>
    <div>
      <dt class="font-semibold text-neutral-100">x = Shadow, y = Gunta</dt>
      <dd class="text-neutral-400">
        x is your Shadow value at this node; y is the Gunta Coins you start each adventure with.
      </dd>
    </div>
    <div>
      <dt class="font-semibold text-neutral-100">Movement</dt>
      <dd class="text-neutral-400">
        One step orthogonal (no diagonals) per session in which you survived a shadow encounter
        of higher degree than your current Shadow.
      </dd>
    </div>
  </dl>
</div>

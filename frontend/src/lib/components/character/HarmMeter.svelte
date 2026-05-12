<!--
  HarmMeter.svelte — pure visualization of the 20-box harm track (rules/46).

  Two stacks share the 20 boxes:
    - PHYSICAL fills LEFT → RIGHT  (box 1..harmTaken)
    - NANITE   fills RIGHT → LEFT  (box 20..21-naniteTaken)
    - OVERFLOW (both filling the same box) renders striped purple

  A yellow tick under box `bulkScore` marks the end-roll threshold —
  any physical harm beyond that point triggers a forced end roll
  (rules/46:24-26).

  Pure component — no state, no side effects.
-->
<script lang="ts">
  import type { HarmTrackers } from '$lib/models/SWCharacter';

  interface Props {
    harm: HarmTrackers;
    /** Bulk score — drives the yellow threshold marker. */
    bulkScore: number;
    /** Optional compact mode for inline display in the sheet header. */
    compact?: boolean;
  }

  let { harm, bulkScore, compact = false }: Props = $props();

  /** Derive box-level state for each of the 20 cells. */
  const boxes = $derived.by(() => {
    const cap = harm.harmCap;
    const phys = Math.min(harm.harmTaken, cap);
    const nano = Math.min(harm.naniteTaken, cap);
    return Array.from({ length: cap }, (_, i) => {
      const oneBased = i + 1;
      const physical = oneBased <= phys;
      const nanite = oneBased > cap - nano; // fills from the right
      return {
        index: oneBased,
        physical,
        nanite,
        overflow: physical && nanite,
        atDeath: oneBased === cap,
        atBulkLine: oneBased === bulkScore
      };
    });
  });
</script>

<div class={`harm-meter ${compact ? 'compact' : ''}`}>
  <div class="boxes">
    {#each boxes as b (b.index)}
      <div
        class={`box ${b.overflow ? 'overflow' : b.physical ? 'physical' : b.nanite ? 'nanite' : 'empty'}`}
        title={`Box ${b.index}${b.physical ? ' · physical' : ''}${b.nanite ? ' · nanite' : ''}`}
      >
        {#if !compact}
          <span class="num">{b.index}</span>
        {/if}
      </div>
    {/each}
  </div>
  {#if !compact}
    <div class="ticks">
      {#each boxes as b (b.index)}
        <div class={`tick ${b.atBulkLine ? 'bulk-line' : ''}`}></div>
      {/each}
    </div>
    <p class="hint">
      <span class="phys-dot"></span> Physical harm {harm.harmTaken}
      &nbsp;·&nbsp;
      <span class="nano-dot"></span> Nanite harm {harm.naniteTaken}
      &nbsp;·&nbsp;
      <span class="bulk-marker"></span> Bulk threshold ({bulkScore})
    </p>
  {/if}
</div>

<style>
  .harm-meter {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }
  .boxes {
    display: grid;
    grid-template-columns: repeat(20, minmax(0, 1fr));
    gap: 2px;
  }
  .compact .boxes {
    gap: 1px;
  }
  .box {
    aspect-ratio: 1 / 1.4;
    border: 1px solid rgba(64, 64, 64, 0.6);
    background: rgba(23, 23, 23, 0.5);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: rgba(115, 115, 115, 0.8);
    transition: background-color 120ms;
  }
  .compact .box {
    aspect-ratio: 1 / 1.6;
  }
  .box.empty { background: rgba(38, 38, 38, 0.5); }

  /* Light-mode adjustments — box bg + number text need to flip so the
     numbers stay readable against a white page bg. Filled (physical /
     nanite / overflow) boxes already have white text on saturated bg
     and don't need the override. */
  :global(html.light) .box {
    border-color: rgba(100, 116, 139, 0.5);
    background: rgba(241, 245, 249, 0.95); /* slate-100 */
    color: #475569; /* slate-600 — readable on slate-100 */
  }
  :global(html.light) .box.empty {
    background: rgba(241, 245, 249, 0.95);
  }
  .box.physical {
    background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
    border-color: #7f1d1d;
    color: #fff;
  }
  .box.nanite {
    background: linear-gradient(180deg, #06b6d4 0%, #0e7490 100%);
    border-color: #155e75;
    color: #fff;
  }
  .box.overflow {
    background: repeating-linear-gradient(
      45deg,
      #c084fc,
      #c084fc 4px,
      #7e22ce 4px,
      #7e22ce 8px
    );
    border-color: #6b21a8;
    color: #fff;
  }
  /* No special border on box 20 — both tracks fill toward 20 from opposite
     ends, so it's just the rightmost cell, not "death." Cap-reached state is
     surfaced by the status badge (Dying / Comatose) instead. */
  .ticks {
    display: grid;
    grid-template-columns: repeat(20, minmax(0, 1fr));
    gap: 2px;
    margin-top: -2px;
  }
  .tick {
    height: 4px;
  }
  .tick.bulk-line {
    background: #facc15;
    border-radius: 1px;
    box-shadow: 0 0 3px rgba(250, 204, 21, 0.6);
  }
  .hint {
    margin-top: 2px;
    font-size: 10px;
    color: rgba(163, 163, 163, 0.9);
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: center;
  }
  :global(html.light) .hint {
    color: #475569; /* slate-600 */
  }
  .phys-dot, .nano-dot, .bulk-marker {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    vertical-align: middle;
  }
  .phys-dot { background: #ef4444; }
  .nano-dot { background: #06b6d4; }
  .bulk-marker { background: #facc15; height: 3px; width: 14px; border-radius: 1px; }
</style>

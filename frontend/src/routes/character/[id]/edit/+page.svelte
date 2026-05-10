<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import type { SWCharacter, AdvancementLogEntry } from '$lib/models';
  import { normalizeCharacter } from '$lib/models';
  import { characterStore } from '$lib/stores';
  import { Button } from '$lib/components/ui';
  import CharacterEditForm from '$lib/components/character/CharacterEditForm.svelte';
  import AdvancementPanel from '$lib/components/character/AdvancementPanel.svelte';
  import { EDIT_TABS, type EditTab } from '$lib/components/character/editTabs';
  import { getDetailTab, setDetailTab } from '$lib/stores/ui.svelte';
  import type { DetailTab } from '$lib/stores/ui.svelte';

  const id = $derived(page.params.id ?? '');
  // Reactive lookup mirrors the (working) view route so the form picks up the
  // character as soon as the store finishes hydrating, regardless of mount order.
  const source = $derived<SWCharacter | undefined>(characterStore.getCharacter(id));
  let working = $state<SWCharacter | null>(null);
  let loadedFor = $state<string | null>(null);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  // Per-character tab state, persisted in the UI store so view ⇄ edit
  // toggling stays on the same tab. The DetailTab and EditTab unions are
  // kept in lock-step (see editTabs.ts) — same string ids — but we still
  // validate against the EDIT_TABS list so a future view-only tab id
  // can't silently drop the edit page into a blank state (showSection()
  // would return false for everything). Unknown ids fall back to overview.
  const EDIT_TAB_IDS = new Set<string>(EDIT_TABS.map((t) => t.id));
  const tab = $derived<EditTab>(
    EDIT_TAB_IDS.has(getDetailTab(id)) ? (getDetailTab(id) as EditTab) : 'overview'
  );
  function selectTab(next: EditTab) {
    setDetailTab(id, next as DetailTab);
  }

  // Clone the source into the editable working copy once per id — re-clones
  // automatically if the user navigates between two edit pages without unmount.
  // If source becomes undefined (deleted in another tab, store cleared, route
  // changed to an unknown id), drop the working copy so we render the not-found
  // branch instead of a stale form for the wrong character.
  $effect(() => {
    if (source && loadedFor !== source.id) {
      // Belt + braces: re-run normalization on the cloned source even though
      // the store load already normalized. Cheap, and protects against any
      // future code path that pushes a partial record into the store without
      // going through normalizeCharacter().
      const cloned = JSON.parse(JSON.stringify(source)) as SWCharacter;
      working = normalizeCharacter(cloned);
      loadedFor = source.id;
    } else if (!source && loadedFor !== null) {
      working = null;
      loadedFor = null;
    }
  });

  async function save() {
    if (!working) return;
    saving = true;
    saveError = null;
    try {
      await characterStore.updateCharacter(working);
      goto(`/character/${working.id}`);
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to save.';
    } finally {
      saving = false;
    }
  }

  function cancel() {
    goto(`/character/${id}`);
  }

  // Advancement panel emits updated character + log; mutate the working
  // clone in place so Save still commits everything together.
  function handleAdvance(updated: SWCharacter, _log: AdvancementLogEntry) {
    working = updated;
  }
  function handlePanelUpdate(updated: SWCharacter) {
    working = updated;
  }
</script>

<svelte:head>
  <title>Edit — Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-6">
  {#if !working}
    {#if !source}
      <p class="text-neutral-300">Character not found.</p>
      <a href="/" class="mt-3 inline-block text-cyan-400 hover:underline">← All characters</a>
    {:else}
      <p class="text-neutral-400">Loading character…</p>
    {/if}
  {:else}
    <!--
      Sticky stack: header card + tab rail card stay pinned to the top of the
      viewport when scrolling tab content. Same pattern as the view-mode page;
      `top` aligns to the bottom of the global app navbar (which exposes its
      measured height as `--navbar-h`). `z-30` keeps it below the navbar
      (`z-40`) but above tab content. Background uses `--sticky-bg` (set
      per-theme in app.css) so the band matches the body's solid base in
      light + dark; the radial-gradient body overlay has
      `background-attachment: fixed` so a faint discontinuity at the sticky
      edge is unavoidable, but `shadow-sm` separates the band visually.
    -->
    <div
      class="sticky z-30 -mx-4 -mt-6 mb-5 px-4 pt-3 pb-1 shadow-sm"
      style="top: var(--navbar-h, 0px); background: var(--sticky-bg, #0b0c0e);"
    >
      <!--
        Edit-mode header in canonical card chrome — same outer class string as
        the view-mode header card. Inner element is a <div>, not <header>, to
        avoid colliding with the global `html.light & header` rule in app.css.
      -->
      <div class="mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-md shadow-black/20">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <a href={`/character/${id}`} class="text-sm text-cyan-400 hover:underline">← Back to sheet</a>
            <h1 class="mt-1 text-2xl font-bold text-neutral-100">Edit {working.name || 'character'}</h1>
            <p class="text-sm text-neutral-400">All tabs commit together when you click Save.</p>
          </div>
          <div class="flex gap-2">
            <Button variant="ghost" onclick={cancel}>Cancel</Button>
            <Button onclick={save} loading={saving}>Save</Button>
          </div>
        </div>
        {#if saveError}
          <p class="mt-3 text-sm text-red-400">{saveError}</p>
        {/if}
      </div>

      <!--
        Tab rail in matching card chrome — same logic as view-mode page.
        Plain <div> instead of <nav> to avoid the global `html.light & nav`
        override painting a competing rectangle inside this rounded card.
      -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-md shadow-black/20">
        <div class="flex flex-wrap gap-1">
          {#each EDIT_TABS as t (t.id)}
            <button
              type="button"
              onclick={() => selectTab(t.id)}
              class={`rounded-full border px-4 py-1.5 text-sm transition ${tab === t.id ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200 shadow-sm shadow-cyan-500/20' : 'border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-500 hover:text-neutral-100'}`}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!--
      Per-tab content. The Advancement tab reuses the same panel as view
      mode (no need to duplicate); other tabs slice CharacterEditForm via
      its `tab` prop. The single `working` clone is the source of truth.
    -->
    {#if tab === 'advancement'}
      <AdvancementPanel character={working} onadvance={handleAdvance} onupdate={handlePanelUpdate} />
    {:else}
      <CharacterEditForm bind:character={working} {tab} />
    {/if}
  {/if}
</main>

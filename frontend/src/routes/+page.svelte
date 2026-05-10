<script lang="ts">
  import { goto } from '$app/navigation';
  import type { SWCharacter } from '$lib/models';
  import { characterStore } from '$lib/stores';
  import { Button, ConfirmDialog, EmptyState, Modal, TextArea } from '$lib/components/ui';
  import {
    exportToFile,
    downloadCharactersAsFile,
    parseImportText,
    importFromFile
  } from '$lib/utils';
  import { getBackground } from '$lib/data/backgrounds';
  import { getLifeForm } from '$lib/data/lifeforms';

  let characters = $derived(characterStore.characters);

  let toDelete = $state<SWCharacter | null>(null);
  let showImport = $state(false);
  let importText = $state('');
  let importError = $state<string | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  // ============================================
  // MULTI-SELECT STATE
  // ============================================
  // selectMode flips the list into checkbox mode. selected tracks the
  // ids of characters tipped for bulk-delete. Bulk confirm modal opens
  // independently of the per-row delete dialog (toDelete) so they
  // don't collide. Mode auto-exits after a successful bulk delete.
  let selectMode = $state(false);
  let selected = $state<Set<string>>(new Set());
  let showBulkConfirm = $state(false);
  let bulkDeleting = $state(false);
  let bulkError = $state<string | null>(null);

  function handleNew() {
    goto('/character/new');
  }

  function handleSelect(c: SWCharacter) {
    if (selectMode) {
      toggleSelected(c.id);
      return;
    }
    goto(`/character/${c.id}`);
  }

  function toggleSelectMode() {
    selectMode = !selectMode;
    if (!selectMode) {
      selected = new Set();
      bulkError = null;
    }
  }

  function toggleSelected(id: string) {
    // Reassign the Set so $state picks up the change.
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function selectAll() {
    selected = new Set(characters.map((c) => c.id));
  }

  function deselectAll() {
    selected = new Set();
  }

  async function confirmBulkDelete() {
    if (bulkDeleting) return; // ignore duplicate clicks while in flight
    bulkDeleting = true;
    bulkError = null;
    try {
      // Snapshot the ids so iteration order is stable as the store mutates.
      const ids = Array.from(selected);
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await characterStore.deleteCharacter(id);
        } catch (e) {
          console.error('[+page] bulk delete failed for', id, e);
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        // Keep failed rows selected so the user can see what didn't delete
        // and retry. Don't exit select mode in that case.
        selected = new Set(failed);
        bulkError = `Failed to delete ${failed.length} of ${ids.length} character${
          ids.length === 1 ? '' : 's'
        }. Retry or cancel.`;
      } else {
        selected = new Set();
        selectMode = false;
      }
      showBulkConfirm = false;
    } finally {
      bulkDeleting = false;
    }
  }

  function requestDelete(c: SWCharacter, event?: Event) {
    event?.stopPropagation();
    toDelete = c;
  }

  async function confirmDelete() {
    if (toDelete) {
      await characterStore.deleteCharacter(toDelete.id);
      toDelete = null;
    }
  }

  async function handleExport() {
    if (!characters.length) return;
    const ok = await exportToFile(characters);
    if (!ok) downloadCharactersAsFile(characters);
  }

  async function handleImport() {
    importError = null;
    try {
      const parsed = parseImportText(importText);
      if (!parsed.length) {
        importError = 'No characters found in JSON.';
        return;
      }
      const count = await characterStore.importCharacters(parsed);
      if (count > 0) {
        showImport = false;
        importText = '';
      } else {
        importError = 'Import failed — see console.';
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : 'Failed to parse JSON.';
    }
  }

  // ============================================
  // FILE UPLOAD IMPORT
  // ============================================
  // Two paths: Tauri-native (importFromFile) returns a tagged result so
  // we can distinguish user-cancel from Tauri-unavailable. Browser
  // fallback uses a hidden <input type="file"> that pipes through
  // parseImportText for parity with the paste-text branch. Errors
  // surface via importError; never double-dialog on user cancel.
  async function handleUploadClick() {
    importError = null;
    const result = await importFromFile();
    switch (result.kind) {
      case 'characters': {
        if (!result.characters.length) {
          importError = 'No characters found in file.';
          return;
        }
        const count = await characterStore.importCharacters(result.characters);
        if (count > 0) {
          showImport = false;
          importText = '';
        } else {
          importError = 'Import failed — see console.';
        }
        return;
      }
      case 'cancelled':
        // User dismissed the picker. Do nothing — don't reopen.
        return;
      case 'unavailable':
        // Browser dev mode — fall back to hidden <input type=file>.
        fileInputEl?.click();
        return;
      case 'error':
        importError = result.message;
        return;
    }
  }

  async function handleFileChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importError = null;
    try {
      const text = await file.text();
      const parsed = parseImportText(text);
      if (!parsed.length) {
        importError = 'No characters found in file.';
        return;
      }
      const count = await characterStore.importCharacters(parsed);
      if (count > 0) {
        showImport = false;
        importText = '';
      } else {
        importError = 'Import failed — see console.';
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : 'Failed to parse JSON file.';
    } finally {
      // Reset the input so picking the same file again re-triggers change.
      input.value = '';
    }
  }

  function lineFor(c: SWCharacter): string {
    const lf = getLifeForm(c.lifeForm);
    const bg = getBackground(c.background);
    const t = c.type.charAt(0).toUpperCase() + c.type.slice(1);
    return `${t} ${lf.label} ${bg.label}`;
  }
</script>

<svelte:head>
  <title>Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-6 pb-24">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-bold text-neutral-100">Characters</h1>
    <div class="flex flex-wrap gap-2">
      {#if characters.length > 0}
        <Button variant="ghost" onclick={toggleSelectMode}>
          {selectMode ? 'Done' : 'Select'}
        </Button>
      {/if}
      <Button variant="ghost" onclick={() => (showImport = true)}>Import</Button>
      <Button variant="ghost" onclick={handleExport} disabled={!characters.length}>Export</Button>
      <Button onclick={handleNew}>New Character</Button>
    </div>
  </div>

  {#if characters.length === 0}
    <EmptyState
      title="No characters yet"
      message="Roll a Zira-Kaan into being via the Creation Wizard."
    >
      {#snippet action()}
        <Button onclick={handleNew}>Start Creation Wizard</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-2">
      {#each characters as c (c.id)}
        {@const isSelected = selected.has(c.id)}
        <li>
          <div
            class="relative rounded-xl border bg-neutral-900/60 p-4 transition hover:bg-neutral-900/80 {isSelected
              ? 'border-cyan-500/70 ring-1 ring-cyan-500/40'
              : 'border-neutral-800 hover:border-cyan-700/50'}"
          >
            {#if selectMode}
              <!-- Big touch-friendly checkbox in the top-left corner. -->
              <label
                class="absolute left-3 top-3 flex cursor-pointer items-center justify-center"
              >
                <input
                  type="checkbox"
                  class="h-6 w-6 cursor-pointer rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
                  checked={isSelected}
                  onchange={() => toggleSelected(c.id)}
                  aria-label={`Select ${c.name || 'character'}`}
                />
              </label>
            {/if}

            <button
              type="button"
              class="block w-full text-left {selectMode ? 'pl-10' : ''}"
              onclick={() => handleSelect(c)}
              aria-label={selectMode
                ? `${isSelected ? 'Deselect' : 'Select'} ${c.name || 'character'}`
                : `Open ${c.name || 'character'}`}
            >
              <div class="min-w-0 pr-8">
                {#if c.title}
                  <p class="text-xs uppercase tracking-wider text-cyan-400/80">{c.title}</p>
                {/if}
                <h2 class="truncate text-lg font-semibold text-neutral-100">
                  {c.name || 'Unnamed Character'}
                </h2>
                <p class="text-sm text-neutral-400">{lineFor(c)}</p>
              </div>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-400">
                <div>
                  <dt class="text-neutral-500">Stacks</dt>
                  <dd class="text-neutral-200">
                    A{c.stacks.archive} B{c.stacks.bulk} G{c.stacks.ghost} M{c.stacks.morph} S{c.stacks
                      .speed} T{c.stacks.tech}
                  </dd>
                </div>
                <div>
                  <dt class="text-neutral-500">Combat</dt>
                  <dd class="text-neutral-200">C{c.stacks.close} R{c.stacks.ranged}</dd>
                </div>
                <div>
                  <dt class="text-neutral-500">Trackers</dt>
                  <dd class="text-neutral-200">
                    Sh {c.shadow} · Gu {c.guntaValue} · Begin {c.beginnerGuntaCoins}
                  </dd>
                </div>
              </dl>
            </button>
            {#if !selectMode}
              <button
                type="button"
                onclick={(e) => requestDelete(c, e)}
                class="absolute right-3 top-3 rounded-lg p-1 text-neutral-500 transition hover:bg-red-900/40 hover:text-red-300"
                aria-label="Delete character"
                title="Delete character"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                  />
                </svg>
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<!-- Sticky bulk action bar — appears at the bottom of the viewport
     while in select mode with at least one row selected. Always
     reachable on long lists; sits above main content via z-50. -->
{#if selectMode}
  <div
    class="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur"
  >
    <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div class="text-sm text-neutral-300">
        <span class="font-semibold text-neutral-100">{selected.size}</span> selected
        <span class="text-neutral-500">/ {characters.length}</span>
        {#if bulkError}
          <span class="ml-2 text-red-400">{bulkError}</span>
        {/if}
      </div>
      <div class="flex flex-wrap gap-2">
        {#if selected.size === characters.length}
          <Button variant="ghost" size="sm" onclick={deselectAll}>Deselect all</Button>
        {:else}
          <Button variant="ghost" size="sm" onclick={selectAll}>Select all</Button>
        {/if}
        <Button variant="ghost" size="sm" onclick={toggleSelectMode}>Cancel</Button>
        <Button
          variant="danger"
          size="sm"
          disabled={selected.size === 0}
          onclick={() => (showBulkConfirm = true)}
        >
          Delete selected ({selected.size})
        </Button>
      </div>
    </div>
  </div>
{/if}

<ConfirmDialog
  open={toDelete !== null}
  title="Delete character?"
  message={toDelete ? `Delete "${toDelete.name || 'Unnamed'}"? This cannot be undone.` : ''}
  confirmText="Delete"
  cancelText="Cancel"
  variant="danger"
  onconfirm={confirmDelete}
  oncancel={() => (toDelete = null)}
/>

<ConfirmDialog
  open={showBulkConfirm}
  title="Delete selected characters?"
  message={`Delete ${selected.size} character${selected.size === 1 ? '' : 's'}? This cannot be undone.`}
  confirmText={bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
  cancelText="Cancel"
  variant="danger"
  onconfirm={confirmBulkDelete}
  oncancel={() => (showBulkConfirm = false)}
/>

<Modal open={showImport} title="Import characters" onclose={() => (showImport = false)}>
  <div class="space-y-3">
    <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <p class="mb-2 text-sm font-semibold text-neutral-200">From a file</p>
      <p class="mb-3 text-xs text-neutral-400">
        Pick an exported SW character JSON file from disk.
      </p>
      <Button variant="secondary" size="sm" onclick={handleUploadClick}>Upload JSON file</Button>
      <!-- Hidden browser fallback when running outside Tauri (vite dev). -->
      <input
        bind:this={fileInputEl}
        type="file"
        accept=".json,application/json"
        class="hidden"
        onchange={handleFileChosen}
      />
    </div>

    <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <p class="mb-2 text-sm font-semibold text-neutral-200">Or paste JSON</p>
      <p class="mb-2 text-xs text-neutral-400">
        Paste exported SW character JSON. Either a single character object, an array, or a wrapped
        export file.
      </p>
      <TextArea bind:value={importText} rows={8} placeholder="Paste JSON…" />
    </div>

    {#if importError}
      <p class="text-sm text-red-400">{importError}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (showImport = false)}>Cancel</Button>
    <Button onclick={handleImport} disabled={!importText.trim()}>Import pasted</Button>
  {/snippet}
</Modal>

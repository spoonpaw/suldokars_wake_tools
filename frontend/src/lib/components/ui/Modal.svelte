<script module lang="ts">
  let modalIdCounter = 0;

  // Body-scroll lock — ref-counted so nested modals don't unlock prematurely.
  let openModalCount = 0;
  let savedBodyOverflow: string | null = null;
  function lockBodyScroll() {
    if (typeof document === 'undefined') return;
    if (openModalCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount++;
  }
  function unlockBodyScroll() {
    if (typeof document === 'undefined') return;
    if (openModalCount === 0) return;
    openModalCount--;
    if (openModalCount === 0) {
      document.body.style.overflow = savedBodyOverflow ?? '';
      savedBodyOverflow = null;
    }
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, onclose, children, footer }: Props = $props();

  const titleId = `modal-title-${++modalIdCounter}`;
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let modalEl: HTMLDivElement | undefined = $state();
  let previouslyFocused: HTMLElement | null = null;
  let focusToken = 0;

  function getFocusable(): HTMLElement[] {
    if (!modalEl) return [];
    return Array.from(modalEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = getFocusable();
    if (focusable.length === 0) {
      e.preventDefault();
      modalEl?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inModal = !!(active && modalEl?.contains(active));

    if (e.shiftKey) {
      if (!inModal || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (!inModal || active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    if (!open) {
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
      previouslyFocused = null;
      return;
    }
    previouslyFocused = document.activeElement as HTMLElement | null;
    const myToken = ++focusToken;
    tick().then(() => {
      if (myToken !== focusToken || !open || !modalEl) return;
      const focusable = getFocusable();
      (focusable[0] ?? modalEl).focus();
    });
  });

  // Lock body scroll while open. Ref-counted so multiple modals stack
  // safely. Cleanup runs on close OR component unmount (e.g. route change
  // with the modal still in the DOM).
  $effect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    bind:this={modalEl}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? titleId : undefined}
    aria-label={title ? undefined : 'Dialog'}
    tabindex="-1"
  >
    <!-- Modal — flex column so the body can scroll while header/footer stay
         pinned. max-h leaves a gutter so the modal never touches viewport edges. -->
    <div class="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
      <!-- Header -->
      {#if title}
        <div class="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 id={titleId} class="text-lg font-semibold text-neutral-100">{title}</h2>
          <button
            type="button"
            onclick={onclose}
            class="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            aria-label="Close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}

      <!-- Scrollable content body -->
      <div class="flex-1 overflow-y-auto p-4">
        {@render children()}
      </div>

      <!-- Footer -->
      {#if footer}
        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

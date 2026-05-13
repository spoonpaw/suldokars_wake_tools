<script lang="ts">
  import '../app.css';
  import { onMount, type Snippet } from 'svelte';
  import { initDatabase, getSetting, setSetting } from '$lib/stores/database';
  import { loadCharacters } from '$lib/stores/characters.svelte';
  import { initTheme, getTheme, toggleTheme, initUpdaterPrefs } from '$lib/stores/ui.svelte';
  import { initZoom, zoomIn, zoomOut, resetZoom } from '$lib/utils';
  import { checkForAppUpdate } from '$lib/utils/updater';

  let { children }: { children: Snippet } = $props();

  let isInitialized = $state(false);
  let initError = $state<string | null>(null);
  let navbarEl = $state<HTMLElement | null>(null);

  // Zoom indicator — shown for ~1.4s after a Cmd/Ctrl-+/-/0 keystroke.
  let zoomToast = $state<{ pct: number; key: number } | null>(null);
  let zoomToastTimer: ReturnType<typeof setTimeout> | null = null;

  const isDark = $derived(getTheme() === 'dark');

  // Mobile gets a "?" (info) icon since the page is purely About — no
  // settings to tweak. Desktop gets the gear since there's an Updates
  // section. Cheap UA sniff is fine: both iOS + Android Tauri WebViews
  // carry their OS in the UA string.
  const isMobile = typeof navigator !== 'undefined'
    && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  onMount(async () => {
    // Apply persisted zoom before any layout work happens — avoids a
    // flash from default 16px to the user's preferred size on reload.
    initZoom();
    try {
      await initDatabase();
      const savedTheme = await getSetting('theme');
      initTheme(savedTheme ?? 'dark');
      const autoCheck = await getSetting('autoCheckUpdates');
      const autoInstall = await getSetting('autoInstallUpdates');
      initUpdaterPrefs({
        autoCheck: autoCheck ?? undefined,
        autoInstall: autoInstall ?? undefined
      });
      await loadCharacters();
      isInitialized = true;
      // Desktop auto-update check — gated by autoCheckUpdates pref + fires
      // after the app is usable so a slow network never blocks startup.
      // No-op on mobile (App Store / Play Store handle updates there).
      void checkForAppUpdate({ silentIfNone: true });
    } catch (e) {
      initError = e instanceof Error ? e.message : 'Failed to initialize app';
      console.error('[App] Init error:', e);
      isInitialized = true;
    }
  });

  // Track navbar height -> CSS var --navbar-h, used by inner sticky headers
  $effect(() => {
    if (!navbarEl) return;
    const sync = () => {
      document.documentElement.style.setProperty('--navbar-h', `${navbarEl!.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(navbarEl);
    return () => ro.disconnect();
  });

  async function handleToggleTheme() {
    toggleTheme();
    try {
      await setSetting('theme', getTheme());
    } catch (e) {
      console.error('[App] Failed to save theme:', e);
    }
  }

  // ============================================
  // KEYBOARD ZOOM (Cmd/Ctrl + plus / minus / 0)
  // ============================================
  // We intercept *before* the browser's own zoom handler runs. Tauri's
  // webview generally lets these events pass through to JS — preventing
  // default keeps the app from also doing a native zoom on top of ours.
  //
  // Plus is awkward because typing "+" usually requires Shift on US
  // layouts: the event then reports key="+" with shiftKey=true. We
  // accept either "+" or "=" (the unshifted key on US layouts) so it
  // works whichever the platform reports. Numpad "+"/"-" come through
  // as the same `key` strings.
  function showZoomToast(factor: number) {
    const pct = Math.round(factor * 100);
    // Bump the key so the same percent re-triggers the fade-in animation.
    zoomToast = { pct, key: (zoomToast?.key ?? 0) + 1 };
    if (zoomToastTimer) clearTimeout(zoomToastTimer);
    zoomToastTimer = setTimeout(() => {
      zoomToast = null;
    }, 1400);
  }

  function handleZoomKey(e: KeyboardEvent) {
    // Need Cmd (mac) or Ctrl (win/linux). Accept either to keep this
    // working on every platform Tauri targets.
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    // Avoid hijacking input/textarea typing entirely — except for the
    // specific zoom combos. Browsers and OS already reserve these
    // chords, so the user's intent is unambiguously "zoom".
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      showZoomToast(zoomIn());
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      showZoomToast(zoomOut());
    } else if (e.key === '0') {
      e.preventDefault();
      showZoomToast(resetZoom());
    }
  }
</script>

<svelte:window onkeydown={handleZoomKey} />

<div class="min-h-screen">
  {#if !isInitialized}
    <div class="flex h-screen items-center justify-center">
      <div class="text-center">
        <div class="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mx-auto"></div>
        <p class="text-neutral-400">Loading Suldokar's Wake Tools…</p>
      </div>
    </div>
  {:else}
    <header bind:this={navbarEl} class="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur" style="padding-top: env(safe-area-inset-top);">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="/" class="text-lg font-bold text-neutral-100 hover:text-cyan-400 transition">
          Suldokar's Wake Tools
        </a>
        <nav class="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onclick={handleToggleTheme}
            class="rounded-full p-2 text-neutral-400 transition hover:bg-slate-300/60 hover:text-cyan-700 dark:hover:bg-neutral-800 dark:hover:text-white"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {#if isDark}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            {:else}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            {/if}
          </button>
          <a
            href="/settings"
            class="rounded-full p-2 text-neutral-400 transition hover:bg-slate-300/60 hover:text-cyan-700 dark:hover:bg-neutral-800 dark:hover:text-white"
            title={isMobile ? 'About' : 'Settings & about'}
            aria-label={isMobile ? 'About' : 'Settings & about'}
          >
            {#if isMobile}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            {:else}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            {/if}
          </a>
        </nav>
      </div>
    </header>

    {#if initError}
      <div class="bg-red-900/50 border-b border-red-800 px-4 py-2 text-center text-red-200 text-sm">
        {initError}
      </div>
    {/if}

    <main style="padding-bottom: env(safe-area-inset-bottom);">
      {@render children()}
    </main>
  {/if}

  {#if zoomToast}
    {#key zoomToast.key}
      <div
        class="zoom-toast pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-900/90 px-4 py-2 text-sm font-medium text-neutral-100 shadow-lg backdrop-blur"
      >
        Zoom {zoomToast.pct}%
      </div>
    {/key}
  {/if}
</div>

<style>
  /* Quick fade-in / fade-out so the indicator doesn't feel jarring. */
  .zoom-toast {
    animation: zoom-toast-fade 1.4s ease-out forwards;
    /* Theme-aware pill. Dark mode: slate pill on dark bg.
       Light mode: white pill with dark text + soft border. The
       html.light override below wins via specificity. */
    background: rgba(15, 23, 42, 0.92) !important;
    color: rgb(241, 245, 249) !important;
    border-color: rgba(71, 85, 105, 0.8) !important;
  }
  :global(html.light) .zoom-toast {
    background: rgba(255, 255, 255, 0.96) !important;
    color: rgb(15, 23, 42) !important;
    border-color: rgba(148, 163, 184, 0.6) !important;
  }
  @keyframes zoom-toast-fade {
    0% { opacity: 0; transform: translate(-50%, -6px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    75% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -6px); }
  }
</style>

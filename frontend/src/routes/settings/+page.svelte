<script lang="ts">
  import { onMount } from 'svelte';
  import { setSetting } from '$lib/stores/database';
  import {
    getAutoCheckUpdates,
    getAutoInstallUpdates,
    setAutoCheckUpdates,
    setAutoInstallUpdates
  } from '$lib/stores/ui.svelte';
  import { checkForAppUpdate } from '$lib/utils/updater';
  import { Card, Toggle, Button } from '$lib/components/ui';

  let appVersion = $state<string>('—');
  let checkingForUpdate = $state(false);

  // Read the version from Tauri at runtime so this page always shows the
  // installed binary's version (not a baked-in string we'd forget to bump).
  // On non-Tauri envs (e.g. browser preview), getVersion() throws — fall
  // back to "—".
  onMount(async () => {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      appVersion = await getVersion();
    } catch {
      appVersion = '—';
    }
  });

  async function toggleAutoCheck(v: boolean) {
    setAutoCheckUpdates(v);
    await setSetting('autoCheckUpdates', String(v));
  }
  async function toggleAutoInstall(v: boolean) {
    setAutoInstallUpdates(v);
    await setSetting('autoInstallUpdates', String(v));
  }
  async function manualCheck() {
    checkingForUpdate = true;
    try {
      // force=true bypasses the autoCheck pref + always shows a confirm
      // dialog (so user knows whether one was found).
      await checkForAppUpdate({ silentIfNone: false, force: true });
    } finally {
      checkingForUpdate = false;
    }
  }
</script>

<svelte:head>
  <title>Settings — Suldokar's Wake Tools</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6 space-y-4">
  <div class="flex items-center justify-between">
    <a href="/" class="text-sm text-cyan-400 hover:underline">← Characters</a>
  </div>

  <h1 class="text-2xl font-bold text-neutral-100">Settings & about</h1>

  <Card title="Updates">
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3 rounded-lg border border-neutral-700 bg-neutral-900/40 px-3 py-2">
        <p class="text-sm text-neutral-100">Check on launch</p>
        <Toggle checked={getAutoCheckUpdates()} onchange={toggleAutoCheck} />
      </div>

      <div class="flex items-center justify-between gap-3 rounded-lg border border-neutral-700 bg-neutral-900/40 px-3 py-2">
        <p class="text-sm text-neutral-100">Auto-install</p>
        <Toggle checked={getAutoInstallUpdates()} onchange={toggleAutoInstall} />
      </div>

      <div class="pt-1">
        <Button onclick={manualCheck} loading={checkingForUpdate}>Check now</Button>
      </div>
    </div>
  </Card>

  <Card title="About">
    <dl class="space-y-2 text-sm">
      <div class="flex items-baseline gap-3">
        <dt class="w-32 text-neutral-400">Version</dt>
        <dd class="font-mono text-neutral-100">{appVersion}</dd>
      </div>
      <div class="flex items-baseline gap-3">
        <dt class="w-32 text-neutral-400">Made by</dt>
        <dd class="text-neutral-100">Net Artisan Collective</dd>
      </div>
      <div class="flex items-baseline gap-3">
        <dt class="w-32 text-neutral-400">Built with</dt>
        <dd class="text-neutral-100">Tauri 2 · SvelteKit · Rust</dd>
      </div>
    </dl>

    <hr class="my-4 border-neutral-800" />

    <p class="text-sm text-neutral-300">
      <strong>Suldokar's Wake</strong> is a science-fiction post-apocalyptic
      tabletop RPG by <strong>Christian Mehrstam</strong>. This app is an
      independent character-management tool used <strong>with the author's
      permission</strong>. All game rules, setting material, and intellectual
      property remain the property of Christian Mehrstam. The app is not
      affiliated with or endorsed by him beyond that permission.
    </p>
  </Card>
</main>

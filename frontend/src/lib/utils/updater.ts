/**
 * updater.ts — desktop auto-update check.
 *
 * On boot the app pings the updater endpoint configured in tauri.conf.json
 * (currently the GitHub Releases `latest.json`). If a newer signed release
 * is available the user is shown a confirm dialog; on accept the new
 * bundle is downloaded, signature-verified, swapped over the running
 * binary, and the app relaunches.
 *
 * Mobile is no-op — App Store / Play Store handle updates natively.
 *
 * Failure modes (no network, malformed manifest, bad signature) are
 * silently logged. We never want a broken update server to block the
 * user from launching their app.
 */

import { check, type Update } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { getAutoCheckUpdates, getAutoInstallUpdates } from '$lib/stores/ui.svelte';

export async function checkForAppUpdate(opts?: { silentIfNone?: boolean; force?: boolean }): Promise<void> {
  const silentIfNone = opts?.silentIfNone ?? true;
  const force = opts?.force ?? false;
  // Auto-check pref only blocks the boot-time call. Manual button press
  // (force=true) always runs.
  if (!force && !getAutoCheckUpdates()) return;
  let update: Update | null = null;
  try {
    update = await check();
  } catch (e) {
    console.warn('[updater] check failed:', e);
    if (!silentIfNone) {
      await message(
        'Could not check for updates. Try again later.',
        { title: 'Update check failed', kind: 'warning' }
      );
    }
    return;
  }

  if (!update) {
    if (!silentIfNone) {
      await message('You are already on the latest version.', {
        title: 'Up to date',
        kind: 'info'
      });
    }
    return;
  }

  // If user has opted into "auto install", skip the confirm dialog.
  // Manual checks still always confirm.
  const autoInstall = !force && getAutoInstallUpdates();
  if (!autoInstall) {
    const proceed = await ask(
      `Suldokar's Wake Tools ${update.version} is available. Download and install?`,
      {
        title: 'Update available',
        kind: 'info',
        okLabel: 'Update',
        cancelLabel: 'Later'
      }
    );
    if (!proceed) return;
  }

  try {
    await update.downloadAndInstall();
    // Successful install — relaunch into the new binary.
    await relaunch();
  } catch (e) {
    console.error('[updater] install failed:', e);
    await message(
      `Update failed to install: ${e instanceof Error ? e.message : String(e)}`,
      { title: 'Update failed', kind: 'error' }
    );
  }
}

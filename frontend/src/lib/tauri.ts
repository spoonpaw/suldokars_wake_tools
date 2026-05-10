/**
 * tauri.ts - thin wrapper around Tauri's invoke() so the rest of the
 * frontend can call backend commands without importing the runtime
 * directly. Safe-call: returns null if not running inside Tauri.
 */

import { invoke } from '@tauri-apps/api/core';

export interface SystemInfo {
  os: string;
  arch: string;
  family: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return await invoke('get_system_info');
}

/** Backend RNG. Falls back silently if not in Tauri. */
export async function rollDieFromBackend(sides: number): Promise<number | null> {
  try {
    return await invoke<number>('roll_die', { sides });
  } catch {
    return null;
  }
}

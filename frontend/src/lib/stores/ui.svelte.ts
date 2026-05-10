/**
 * ui.svelte.ts - UI state (navigation, modals, theme).
 */

// ============================================
// VIEW STATE TYPES
// ============================================

export type DetailTab =
  | 'overview'
  | 'stacks'
  | 'keywords'
  | 'languages'
  | 'space'
  | 'equipment'
  | 'implants'
  | 'identity'
  | 'hooks'
  | 'trackers'
  | 'advancement';

export type Theme = 'light' | 'dark' | 'system';

// ============================================
// STATE
// ============================================

let showImportModal = $state(false);
let showExportModal = $state(false);
let deleteConfirmId = $state<string | null>(null);
let theme = $state<Theme>('dark');

/**
 * Per-character active tab. View + Edit pages share the same key so
 * switching between view and edit preserves the user's last tab pick
 * for that specific character. Default (when key is unset) is 'overview'.
 *
 * Keyed by character id so two characters in the same session don't drift
 * into the same tab (e.g. Osric on Equipment, Kira on Stacks should stay).
 *
 * The view-mode `DetailTab` and edit-mode `EditTab` are kept in lock-step
 * by design (see editTabs.ts) — same string ids, same order — so the union
 * stored here is interoperable across both routes.
 */
let detailTabByCharacter = $state<Record<string, DetailTab>>({});

// ============================================
// GETTERS
// ============================================

export function getShowImportModal(): boolean {
  return showImportModal;
}

export function getShowExportModal(): boolean {
  return showExportModal;
}

export function getDeleteConfirmId(): string | null {
  return deleteConfirmId;
}

export function getTheme(): Theme {
  return theme;
}

// ============================================
// PER-CHARACTER TAB STATE
// ============================================

/**
 * Read the persisted tab for `characterId`. Returns 'overview' when no value
 * has been stored yet — both pages call this on mount to seed local state.
 */
export function getDetailTab(characterId: string): DetailTab {
  return detailTabByCharacter[characterId] ?? 'overview';
}

/** Persist the user's tab pick — survives view ⇄ edit toggling. */
export function setDetailTab(characterId: string, t: DetailTab): void {
  detailTabByCharacter = { ...detailTabByCharacter, [characterId]: t };
}

// ============================================
// MODAL ACTIONS
// ============================================

export function openImportModal(): void {
  showImportModal = true;
}
export function closeImportModal(): void {
  showImportModal = false;
}
export function openExportModal(): void {
  showExportModal = true;
}
export function closeExportModal(): void {
  showExportModal = false;
}
export function showDeleteConfirm(characterId: string): void {
  deleteConfirmId = characterId;
}
export function hideDeleteConfirm(): void {
  deleteConfirmId = null;
}

// ============================================
// THEME
// ============================================

export function setTheme(newTheme: Theme): void {
  theme = newTheme;
  applyTheme(newTheme);
}

export function toggleTheme(): void {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

export function applyTheme(themeValue: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (themeValue === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else if (themeValue === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export function initTheme(savedTheme?: string): void {
  if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
    theme = savedTheme as Theme;
  }
  applyTheme(theme);
}

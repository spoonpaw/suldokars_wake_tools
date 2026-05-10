/**
 * editTabs.ts — shared tab-id type for the edit-mode tabbed layout.
 *
 * Mirrors the view-mode `DetailTab` order so the edit page can render the
 * exact same tab set in the same order. The two are kept in lock-step so
 * a player switching between view and edit lands on the corresponding
 * section in both.
 *
 * The `advancement` tab is shown but its content reuses the same
 * AdvancementPanel as view-mode — Save/Cancel still apply to the surrounding
 * `working` clone.
 */

export type EditTab =
  | 'overview'
  | 'stacks'
  | 'advancement'
  | 'keywords'
  | 'languages'
  | 'space'
  | 'equipment'
  | 'implants'
  | 'identity'
  | 'hooks'
  | 'trackers';

export const EDIT_TABS: { id: EditTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stacks', label: 'Stacks & Combat' },
  { id: 'advancement', label: 'Advancement' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'languages', label: 'Languages' },
  { id: 'space', label: 'Space' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'implants', label: 'Implants' },
  { id: 'identity', label: 'Identity' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'trackers', label: 'Trackers' }
];

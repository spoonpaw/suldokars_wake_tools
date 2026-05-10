<!--
  AdvancementPanel.svelte — character-sheet panel that composes:
    - TypeGraphView (current position rendered)
    - TypeGraphLegend (mini-key)
    - Session log card (read-only history of all logged sessions)
    - "Take advancement step" workflow (single button → modal with direction picker)
    - "Log session (no move)" button for sessions without advancement
    - Advancement-history log with rollback for the most recent entry

  Per rules/52 (strict no-banking): each session in which the character
  survives a Shadow Encounter of degree > current Shadow grants ONE
  orthogonal step on the type-graph during that session. Use it or lose
  it. There is no carry-over, no banked-session inventory, no spending
  state. Multi-step moves to a plotted node happen across multiple
  sessions, never bundled in a single click.

  This panel does NOT enforce "one move per session" — that's a table
  convention. Each "Take advancement step" click writes a new
  SessionLogEntry; if a player misuses it, the log shows what happened.
-->
<script lang="ts">
  import type {
    SWCharacter,
    AdvancementLogEntry,
    SessionLogEntry,
    CharacterKeyword,
    CharacterSpace
  } from '$lib/models/SWCharacter';
  import type { TypeGraphNode, OrthogonalDir } from '$lib/data/typeGraphs';
  import {
    legalNextNodes,
    applyDir,
    findNodeAt,
    ORTHOGONAL_DIRS
  } from '$lib/data/typeGraphs';
  import {
    getActiveGraph,
    getActiveOwnedGraph,
    addCustomGraph,
    addLootedGraph,
    deleteGraph,
    renameGraph
  } from '$lib/utils/graphLibrary';
  import { getTypeGraph } from '$lib/data/typeGraphs';
  import TypeGraphView from './TypeGraphView.svelte';
  import TypeGraphLegend from './TypeGraphLegend.svelte';
  import AdvancementModal from './AdvancementModal.svelte';
  import GraphLibrary from './advancement/GraphLibrary.svelte';
  import CustomGraphEditor from './advancement/CustomGraphEditor.svelte';
  import GraphSwapModal from './advancement/GraphSwapModal.svelte';
  import { Button, Card, Badge, Modal, NumberInput, Input, TextArea, Select } from '$lib/components/ui';

  interface Props {
    character: SWCharacter;
    /** Called with the new character + log entry when an advancement is confirmed. */
    onadvance?: (updated: SWCharacter, log: AdvancementLogEntry) => void;
    /** Called with the new character for non-advancement edits (session log / corrections). */
    onupdate?: (updated: SWCharacter) => void;
    /**
     * When true, render every section as read-only — no Take-step button,
     * no Log-session, no Edit/Remove on session-log entries, no Rollback.
     * The type-graph still renders (in `mode: 'view'`) and the session log
     * + history list still display. Used by the view-mode page so the
     * player has to switch to Edit to mutate state.
     */
    readOnly?: boolean;
  }

  let { character, onadvance, onupdate, readOnly = false }: Props = $props();

  function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ============================================
  // SESSION ↔ ADVANCEMENT LINK INTEGRITY
  // ============================================
  // A SessionLogEntry "powers" an AdvancementLogEntry when the latter's
  // `sessionLogEntryId` matches the former's `id`. While that link exists
  // we cannot delete the session entry (it would orphan the advancement
  // record); rolling back the advancement breaks the link, after which
  // the session entry becomes deletable again.

  /** True iff some advancementHistory entry references this session id. */
  function sessionIsTied(s: SessionLogEntry): boolean {
    return (character.advancementHistory ?? []).some(
      (h) => h.sessionLogEntryId === s.id
    );
  }

  /** Look up the SessionLogEntry that powered an advancement (by id). */
  function findLinkedSession(advEntry: AdvancementLogEntry): SessionLogEntry | null {
    if (!advEntry.sessionLogEntryId) return null;
    return (
      (character.sessionLog ?? []).find((s) => s.id === advEntry.sessionLogEntryId) ?? null
    );
  }

  /** Anchor id for a SessionLogEntry's row in the log (for scroll-to). */
  function sessionRowDomId(sessionId: string): string {
    return `session-log-row-${sessionId}`;
  }

  /** Smooth-scroll to a session row when the user clicks the linked badge. */
  function scrollToSession(sessionId: string) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(sessionRowDomId(sessionId));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ============================================
  // POSITION + GRAPH DERIVATIONS
  // ============================================
  const currentPos = $derived({
    x: character.typeGraphPosition?.x ?? 0,
    y: character.typeGraphPosition?.y ?? 0
  });
  const activeOwned = $derived(getActiveOwnedGraph(character));
  const graph = $derived(getActiveGraph(character));
  const currentNode = $derived(findNodeAt(graph, currentPos));

  // ============================================
  // SESSION LOG VIEW — newest first
  // ============================================
  const sessionLog = $derived(
    [...(character.sessionLog ?? [])].sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    )
  );

  // ============================================
  // TAKE-STEP MODAL STATE
  // ============================================
  // Two workflows share this modal:
  //   1. CREATE — player clicks "Take advancement step…" at panel root.
  //      A NEW SessionLogEntry is created on confirm.
  //   2. PROMOTE — player clicks "Take step using this session" on a
  //      previously-logged no-move row. The EXISTING SessionLogEntry is
  //      promoted (its `moved`/from/to/direction fields populated). No
  //      new entry is created; the AdvancementLogEntry's
  //      sessionLogEntryId points at the existing session.
  // The discriminator is `promoteSessionId`: null = CREATE, string = PROMOTE.
  let takeStepOpen = $state(false);
  let stepLabel = $state('');
  let stepDegree = $state(1);
  let stepNotes = $state('');
  let stepDir = $state<OrthogonalDir | null>(null);
  let promoteSessionId = $state<string | null>(null);

  /** True iff the take-step modal is in PROMOTE mode. */
  const isPromoteMode = $derived(promoteSessionId !== null);
  /** Lookup the session being promoted (null in CREATE mode). */
  const promoteSession = $derived(
    promoteSessionId
      ? (character.sessionLog ?? []).find((s) => s.id === promoteSessionId) ?? null
      : null
  );
  /** Modal title varies by mode. */
  const takeStepTitle = $derived(
    isPromoteMode
      ? `Take step using session: ${promoteSession?.sessionLabel ?? '<unlabeled>'}`
      : 'Take advancement step'
  );

  function openTakeStep() {
    promoteSessionId = null;
    stepLabel = '';
    stepDegree = Math.max(1, character.shadow + 1);
    stepNotes = '';
    stepDir = null;
    takeStepOpen = true;
  }
  /**
   * PROMOTE flow — open the take-step modal pre-filled from an existing
   * no-move SessionLogEntry. On confirm, that entry is promoted in-place
   * (no new SessionLogEntry is created).
   */
  function openPromoteSession(s: SessionLogEntry) {
    if (s.moved) return; // Defense: only no-move rows are promotable.
    promoteSessionId = s.id;
    stepLabel = s.sessionLabel ?? '';
    stepDegree = s.highestEncounterDegree ?? Math.max(1, character.shadow + 1);
    stepNotes = s.notes ?? '';
    stepDir = null;
    takeStepOpen = true;
  }
  function closeTakeStep() {
    takeStepOpen = false;
    stepDir = null;
    promoteSessionId = null;
  }

  /** Direction-picker preview target — null until the player picks a dir. */
  const takeStepTarget = $derived(stepDir ? applyDir(currentPos, stepDir) : null);
  const takeStepLandsOnNode = $derived(takeStepTarget ? findNodeAt(graph, takeStepTarget) : null);

  function confirmTakeStep() {
    if (!stepDir || !takeStepTarget) return;
    const target = takeStepTarget;

    // ============================================
    // PROMOTE-MODE REVALIDATION
    // ============================================
    // Re-check the live session still exists, is still no-move, and is
    // not already tied to an advancement. The state could have shifted
    // between openPromoteSession() and confirm (Edit/Remove on the row,
    // a parallel tab, etc.). Defense-in-depth — we never want to write
    // an advancement entry whose sessionLogEntryId doesn't resolve, or
    // double-promote a single session.
    let livePromoteSession: SessionLogEntry | null = null;
    if (isPromoteMode) {
      const id = promoteSessionId!;
      livePromoteSession = (character.sessionLog ?? []).find((s) => s.id === id) ?? null;
      if (!livePromoteSession) {
        console.warn('[AdvancementPanel] Promote target session no longer exists; aborting.');
        closeTakeStep();
        return;
      }
      if (livePromoteSession.moved) {
        console.warn('[AdvancementPanel] Promote target session already moved; aborting.');
        closeTakeStep();
        return;
      }
      if (sessionIsTied(livePromoteSession)) {
        console.warn('[AdvancementPanel] Promote target already tied to an advancement; aborting.');
        closeTakeStep();
        return;
      }
    }

    // PROMOTE mode reuses the existing session id (so the AdvancementLogEntry
    // points at it and Modal will REPLACE rather than append). CREATE mode
    // mints a fresh id for a brand-new SessionLogEntry.
    const sessionLogEntryId = isPromoteMode ? promoteSessionId! : newId();
    // In PROMOTE mode we preserve the original loggedAt — the session was
    // logged earlier and the timestamp matters for history ordering.
    // Use the LIVE session, not the snapshot taken at openPromoteSession,
    // so any concurrent edit to loggedAt (unlikely but possible) is honored.
    const loggedAt = isPromoteMode && livePromoteSession
      ? livePromoteSession.loggedAt
      : new Date().toISOString();
    // Preserve the original shadowAtSessionStart so the historical record
    // reflects the shadow at the time of logging, not the time of promotion.
    const shadowAtSessionStart = isPromoteMode && livePromoteSession
      ? livePromoteSession.shadowAtSessionStart
      : character.shadow;
    const sessionEntry: SessionLogEntry = {
      id: sessionLogEntryId,
      loggedAt,
      sessionLabel: stepLabel.trim() || undefined,
      highestEncounterDegree: stepDegree,
      notes: stepNotes.trim() || undefined,
      shadowAtSessionStart,
      moved: true,
      fromNode: { x: currentPos.x, y: currentPos.y },
      toNode: { x: target.x, y: target.y },
      direction: stepDir
    };

    if (takeStepLandsOnNode) {
      // Chain into the node-effects wizard. The session entry hasn't been
      // written to the character yet — we hand it + the target node to the
      // AdvancementModal, which writes BOTH the session entry AND the
      // advancement-history entry on confirm. The modal detects PROMOTE vs
      // CREATE by checking whether the session id already exists in the
      // character's sessionLog (replace vs append) and re-validates the
      // same liveness invariants we just checked here. This preserves
      // "one click = one session, one history entry, one step" while
      // letting the wizard pick floors / spaces / keywords / bond.
      pendingSessionEntry = sessionEntry;
      pendingTargetNode = takeStepLandsOnNode;
      pendingFromNode = { x: currentPos.x, y: currentPos.y };
      takeStepOpen = false;
      modalOpen = true;
      return;
    }

    // Intermediate cell — apply directly, no node effects.
    const beforeState: NonNullable<AdvancementLogEntry['beforeState']> = {
      shadow: character.shadow,
      guntaValue: character.guntaValue
    };
    // Snapshot the pre-promote session record so rollback restores any
    // label/degree/notes edits the player made in the promote modal,
    // not just the move-detail fields. Only relevant in PROMOTE mode.
    if (isPromoteMode && livePromoteSession) {
      beforeState.priorSession = {
        sessionLabel: livePromoteSession.sessionLabel,
        highestEncounterDegree: livePromoteSession.highestEncounterDegree,
        notes: livePromoteSession.notes
      };
    }
    const updated: SWCharacter = JSON.parse(JSON.stringify(character));
    updated.typeGraphPosition = { x: target.x, y: target.y };
    updated.shadow = target.x;
    updated.guntaValue = target.y;
    // PROMOTE: replace the existing session in-place (we already validated
    // the entry exists). CREATE: append a new one.
    if (isPromoteMode) {
      updated.sessionLog = (updated.sessionLog ?? []).map((e) =>
        e.id === sessionLogEntryId ? sessionEntry : e
      );
    } else {
      updated.sessionLog = [...(updated.sessionLog ?? []), sessionEntry];
    }

    // Mark prior advancement-history entries non-reversible — only the latest is undoable.
    const priorHistory = (updated.advancementHistory ?? []).map((e) => ({
      ...e,
      reversible: false
    }));
    const logEntry: AdvancementLogEntry = {
      id: newId(),
      fromNode: { x: currentPos.x, y: currentPos.y },
      toNode: { x: target.x, y: target.y },
      appliedAt: new Date().toISOString(),
      changes: [
        `Moved (${currentPos.x}, ${currentPos.y}) → (${target.x}, ${target.y}) — intermediate cell`,
        `Shadow ${currentPos.x} → ${target.x}`,
        `Gunta ${currentPos.y} → ${target.y}`
      ],
      sessionLogEntryId,
      reversible: true,
      beforeState
    };
    updated.advancementHistory = [...priorHistory, logEntry];
    updated.updatedAt = new Date().toISOString();
    closeTakeStep();
    onadvance?.(updated, logEntry);
  }

  // ============================================
  // LOG-SESSION-NO-MOVE MODAL STATE
  // ============================================
  // For sessions where the player wants to record the session but didn't
  // advance (couldn't survive a higher-degree encounter, or chose not to).
  let logNoMoveOpen = $state(false);
  let noMoveLabel = $state('');
  let noMoveDegree = $state(0);
  let noMoveNotes = $state('');

  function openLogNoMove() {
    noMoveLabel = '';
    noMoveDegree = 0;
    noMoveNotes = '';
    logNoMoveOpen = true;
  }
  function closeLogNoMove() {
    logNoMoveOpen = false;
  }
  function confirmLogNoMove() {
    const entry: SessionLogEntry = {
      id: newId(),
      loggedAt: new Date().toISOString(),
      sessionLabel: noMoveLabel.trim() || undefined,
      highestEncounterDegree: noMoveDegree > 0 ? noMoveDegree : undefined,
      notes: noMoveNotes.trim() || undefined,
      shadowAtSessionStart: character.shadow,
      moved: false
    };
    const updated: SWCharacter = {
      ...character,
      sessionLog: [...(character.sessionLog ?? []), entry],
      updatedAt: new Date().toISOString()
    };
    closeLogNoMove();
    onupdate?.(updated);
  }

  // ============================================
  // SESSION-LOG ENTRY EDITING (correction UI)
  // ============================================
  let editEntryId = $state<string | null>(null);
  let editLabel = $state('');
  let editDegree = $state(0);
  let editNotes = $state('');
  const editEntry = $derived(
    editEntryId ? sessionLog.find((e) => e.id === editEntryId) ?? null : null
  );

  function openEditEntry(entry: SessionLogEntry) {
    editEntryId = entry.id;
    editLabel = entry.sessionLabel ?? '';
    editDegree = entry.highestEncounterDegree ?? 0;
    editNotes = entry.notes ?? '';
  }
  function closeEditEntry() {
    editEntryId = null;
  }
  function confirmEditEntry() {
    if (!editEntryId) return;
    const updated: SWCharacter = {
      ...character,
      sessionLog: (character.sessionLog ?? []).map((e) =>
        e.id === editEntryId
          ? {
              ...e,
              sessionLabel: editLabel.trim() || undefined,
              highestEncounterDegree: editDegree > 0 ? editDegree : undefined,
              notes: editNotes.trim() || undefined
            }
          : e
      ),
      updatedAt: new Date().toISOString()
    };
    closeEditEntry();
    onupdate?.(updated);
  }
  function removeEntry(id: string) {
    // Defense-in-depth: even if the disabled Remove button is bypassed
    // (keyboard nav, future code path), we never orphan an advancement
    // entry by deleting the SessionLogEntry it points at.
    const target = (character.sessionLog ?? []).find((e) => e.id === id);
    if (target && sessionIsTied(target)) return;
    const updated: SWCharacter = {
      ...character,
      sessionLog: (character.sessionLog ?? []).filter((e) => e.id !== id),
      updatedAt: new Date().toISOString()
    };
    onupdate?.(updated);
  }

  // ============================================
  // PLOTTED-NODE NODE-EFFECTS MODAL
  // ============================================
  // Opened only when "Take advancement step" lands on a plotted node.
  // The AdvancementModal handles floors / spaces / keywords / bond and
  // writes both the SessionLogEntry and the AdvancementLogEntry.
  let modalOpen = $state(false);
  let pendingTargetNode = $state<TypeGraphNode | null>(null);
  let pendingFromNode = $state<{ x: number; y: number } | null>(null);
  let pendingSessionEntry = $state<SessionLogEntry | null>(null);

  function handleConfirm(updated: SWCharacter, log: AdvancementLogEntry) {
    modalOpen = false;
    pendingTargetNode = null;
    pendingFromNode = null;
    pendingSessionEntry = null;
    // PROMOTE flow ended successfully — clear the marker so a subsequent
    // open of the take-step modal starts fresh in CREATE mode.
    promoteSessionId = null;
    onadvance?.(updated, log);
  }
  function closeModal() {
    modalOpen = false;
    pendingTargetNode = null;
    pendingFromNode = null;
    pendingSessionEntry = null;
    // Cancel of the node-effects wizard during a PROMOTE flow — also
    // clear the marker so the take-step modal is fresh next time.
    promoteSessionId = null;
  }

  // ============================================
  // ROLLBACK
  // ============================================
  // Walk the most recent entry's `beforeState` and reverse each delta.
  // The linked SessionLogEntry's `moved` flips back to `false` and the
  // move-detail fields clear so the log shows "session logged but
  // movement was rolled back". The new "most recent" entry (if any) is
  // re-marked reversible so undos can chain backwards.

  function rollback(entry: AdvancementLogEntry) {
    if (!entry.reversible) return;
    const updated: SWCharacter = JSON.parse(JSON.stringify(character));

    // Graph-swap entries — revert the active graph id to the fromGraphId.
    // Stack-floor / space additions applied by the swap are already
    // captured in beforeState (same shape as a normal advancement) and
    // get reverted by the same code below.
    //
    // If the player deleted the prior graph between the swap and the
    // undo (only inactive non-default graphs are deletable, so this is
    // possible if fromGraph was custom/looted), fromGraphId no longer
    // resolves. Fall back to the first remaining graph's id so we never
    // leave activeGraphId pointing at a missing graph. The toGraph
    // (currently active) is always present, so it's a safe fallback.
    if (entry.kind === 'graph_swap' && entry.graphSwap) {
      const stillExists = (updated.ownedGraphs ?? []).some(
        (og) => og.id === entry.graphSwap!.fromGraphId
      );
      if (stillExists) {
        updated.activeGraphId = entry.graphSwap.fromGraphId;
      } else {
        const fallback = (updated.ownedGraphs ?? [])[0]?.id;
        if (fallback) updated.activeGraphId = fallback;
        console.warn(
          '[AdvancementPanel] Rollback: prior graph id missing — falling back to first owned graph.'
        );
      }
    }

    // Position + derived Shadow/Gunta — revert to fromNode (or beforeState
    // values if recorded — they should agree). For graph_swap entries
    // fromNode === toNode (no move), so this is a no-op.
    updated.typeGraphPosition = { x: entry.fromNode.x, y: entry.fromNode.y };
    updated.shadow = entry.beforeState?.shadow ?? entry.fromNode.x;
    updated.guntaValue = entry.beforeState?.guntaValue ?? entry.fromNode.y;

    // Revert raised stack floors.
    if (entry.beforeState?.stacks) {
      for (const [k, v] of Object.entries(entry.beforeState.stacks)) {
        if (typeof v === 'number') {
          (updated.stacks as unknown as Record<string, number>)[k] = v;
        }
      }
    }
    if (entry.beforeState?.implantsCap !== undefined) {
      updated.origo.implants = entry.beforeState.implantsCap;
    }

    // Remove space slots this entry added (by id, not by name — only those).
    if (entry.beforeState?.spacesAddedIds?.length) {
      const drop = new Set(entry.beforeState.spacesAddedIds);
      updated.spaces = updated.spaces.filter((s) => !drop.has(s.id));
    }
    // Remove keywords this entry added (by id).
    if (entry.beforeState?.keywordsAddedIds?.length) {
      const drop = new Set(entry.beforeState.keywordsAddedIds);
      updated.keywords = updated.keywords.filter((k) => !drop.has(k.id));
    }
    // Restore prior keyword stack assignments (rearrange undo).
    if (entry.beforeState?.keywordRearrangements?.length) {
      const map = new Map(
        entry.beforeState.keywordRearrangements.map((r) => [r.keywordId, r.previousStack])
      );
      updated.keywords = updated.keywords.map((k) =>
        map.has(k.id) ? { ...k, stack: map.get(k.id)! } : k
      );
    }
    // Restore prior bond + the prior notes (so a swap-then-undo round-trip
    // brings back any notes the player wrote before the swap, instead of
    // dropping them).
    if (entry.beforeState?.coreBond !== undefined) {
      updated.coreBond = entry.beforeState.coreBond;
      updated.coreBondNotes = entry.beforeState.coreBondNotes ?? '';
    }
    // Restore prior composition slots (paired with `stacks` revert above).
    if (entry.beforeState?.stackComposition) {
      const restored = { ...(updated.stackComposition ?? {}) };
      for (const [k, v] of Object.entries(entry.beforeState.stackComposition)) {
        if (v) (restored as Record<string, typeof v>)[k] = v;
      }
      updated.stackComposition = restored as typeof updated.stackComposition;
    }

    // Flip the linked SessionLogEntry back to moved=false and clear the
    // move-detail fields. The session itself stays in the log (the player
    // logged it; the rollback only undoes the movement, not the record).
    // For PROMOTE-flow advancements, also restore the pre-promote
    // sessionLabel/degree/notes — the player may have edited them in the
    // promote modal, and rollback should make the session look the way
    // it did before the promote was applied.
    if (entry.sessionLogEntryId) {
      const targetId = entry.sessionLogEntryId;
      const priorSession = entry.beforeState?.priorSession;
      updated.sessionLog = (updated.sessionLog ?? []).map((e) =>
        e.id === targetId
          ? {
              ...e,
              moved: false,
              fromNode: undefined,
              toNode: undefined,
              direction: undefined,
              ...(priorSession
                ? {
                    sessionLabel: priorSession.sessionLabel,
                    highestEncounterDegree: priorSession.highestEncounterDegree,
                    notes: priorSession.notes
                  }
                : {})
            }
          : e
      );
    }

    // Drop the rolled-back history entry; re-mark the new tail (if any)
    // as reversible — but ONLY if it carries a beforeState snapshot we
    // could actually revert. Legacy/incomplete entries lack beforeState
    // and would only revert position+shadow+gunta, silently leaving
    // stack/space/keyword/bond changes orphaned.
    const remaining = (updated.advancementHistory ?? []).filter((e) => e.id !== entry.id);
    if (remaining.length > 0) {
      const tail = remaining[remaining.length - 1];
      if (tail.beforeState) {
        remaining[remaining.length - 1] = { ...tail, reversible: true };
      }
    }
    updated.advancementHistory = remaining;
    updated.updatedAt = new Date().toISOString();
    onadvance?.(updated, entry);
  }

  // ============================================
  // TYPE-GRAPH HIGHLIGHTS
  // ============================================
  // When the take-step modal is open and the player has picked a direction,
  // highlight the destination cell. Otherwise no highlight (no banking, no
  // permanent "could go here" hints).
  // For now this is a behavioral hook: TypeGraphView renders neighbours
  // when interactive+wizard. The take-step direction picker shows the
  // target cell coords inside the modal preview.

  // History list — newest first.
  const history = $derived([...(character.advancementHistory ?? [])].reverse());

  // ============================================
  // GRAPH LIBRARY MODAL STATE
  // ============================================
  // Each modal opens via an explicit `open*` callback, validates against
  // the live character, and closes via the `close*` partner. All side
  // effects route through onadvance / onupdate so the parent edit form
  // sees the new character and can persist on Save.

  // Swap modal — confirms the swap from active → target graph.
  let swapTargetId = $state<string | null>(null);
  function openSwapModal(graphId: string) {
    if (readOnly) return;
    if (!character.ownedGraphs?.some((og) => og.id === graphId)) return;
    if (graphId === character.activeGraphId) return;
    swapTargetId = graphId;
  }
  function closeSwapModal() {
    swapTargetId = null;
  }
  function handleSwapConfirm(updated: SWCharacter, log: AdvancementLogEntry) {
    swapTargetId = null;
    onadvance?.(updated, log);
  }

  // Rename modal — minimal Input + Save.
  let renameGraphId = $state<string | null>(null);
  let renameDraft = $state('');
  function openRenameModal(graphId: string) {
    if (readOnly) return;
    const og = character.ownedGraphs?.find((g) => g.id === graphId);
    if (!og) return;
    renameGraphId = graphId;
    renameDraft = og.name;
  }
  function closeRenameModal() {
    renameGraphId = null;
    renameDraft = '';
  }
  function confirmRename() {
    if (!renameGraphId) return;
    const updated = renameGraph(character, renameGraphId, renameDraft);
    closeRenameModal();
    onupdate?.(updated);
  }

  // Edit-nodes modal — wraps CustomGraphEditor.
  let editGraphId = $state<string | null>(null);
  function openEditGraphModal(graphId: string) {
    if (readOnly) return;
    const og = character.ownedGraphs?.find((g) => g.id === graphId);
    if (!og || og.source === 'default') return;
    editGraphId = graphId;
  }
  function closeEditGraphModal() {
    editGraphId = null;
  }
  function handleEditGraphSave(updated: SWCharacter) {
    editGraphId = null;
    onupdate?.(updated);
  }

  // Delete confirm — inline confirm dialog state.
  let deleteGraphId = $state<string | null>(null);
  /**
   * True iff some still-reversible graph_swap log entry references this
   * graph id as its `fromGraphId`. Deleting such a graph would orphan
   * the rollback (rollback would point at a missing graph). We block
   * deletion in that case until the swap is rolled back or another
   * reversible advancement supersedes it.
   */
  function graphIsReferencedByReversibleSwap(graphId: string): boolean {
    const hist = character.advancementHistory ?? [];
    return hist.some(
      (h) =>
        h.reversible === true &&
        h.kind === 'graph_swap' &&
        h.graphSwap?.fromGraphId === graphId
    );
  }
  function confirmDeleteGraph(graphId: string) {
    if (readOnly) return;
    if (graphIsReferencedByReversibleSwap(graphId)) {
      // Prefer to fail loud — surface a transient warning via a separate
      // modal flag so the player understands why delete was refused.
      deleteBlockedReason =
        'This graph is the rollback target of the most recent swap. Roll back the swap first or take another advancement to seal it.';
      return;
    }
    deleteBlockedReason = null;
    deleteGraphId = graphId;
  }
  function cancelDelete() {
    deleteGraphId = null;
    deleteBlockedReason = null;
  }
  function performDelete() {
    if (!deleteGraphId) return;
    const updated = deleteGraph(character, deleteGraphId);
    deleteGraphId = null;
    onupdate?.(updated);
  }
  /** Non-null when the delete was refused; rendered in a small inline modal. */
  let deleteBlockedReason = $state<string | null>(null);

  // Add custom graph modal.
  let addCustomOpen = $state(false);
  let addCustomName = $state('');
  function openAddCustomModal() {
    if (readOnly) return;
    addCustomName = '';
    addCustomOpen = true;
  }
  function closeAddCustomModal() {
    addCustomOpen = false;
    addCustomName = '';
  }
  function performAddCustom() {
    const updated = addCustomGraph(character, addCustomName.trim());
    closeAddCustomModal();
    onupdate?.(updated);
  }

  // Loot a graph modal — clones one of the static defaults under a new name.
  let lootOpen = $state(false);
  let lootName = $state('');
  let lootSourceType = $state<'apt' | 'core' | 'prime'>('apt');
  let lootBlank = $state(false);
  function openLootGraphModal() {
    if (readOnly) return;
    lootName = '';
    lootSourceType = character.type;
    lootBlank = false;
    lootOpen = true;
  }
  function closeLootModal() {
    lootOpen = false;
    lootName = '';
  }
  function performLoot() {
    const baseGraph = getTypeGraph(lootSourceType);
    const cloned = lootBlank
      ? { ...baseGraph, nodes: [] }
      : structuredClone(baseGraph);
    const name = lootName.trim() || `Looted: ${lootSourceType.toUpperCase()}`;
    const updated = addLootedGraph(character, name, cloned);
    closeLootModal();
    onupdate?.(updated);
  }

  // ============================================
  // KEYBOARD
  // ============================================
  function escapeHandler(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (editEntryId) closeEditEntry();
    else if (logNoMoveOpen) closeLogNoMove();
    else if (takeStepOpen) closeTakeStep();
    else if (swapTargetId) closeSwapModal();
    else if (renameGraphId) closeRenameModal();
    else if (editGraphId) closeEditGraphModal();
    else if (deleteGraphId) cancelDelete();
    else if (addCustomOpen) closeAddCustomModal();
    else if (lootOpen) closeLootModal();
  }

  // ============================================
  // READONLY GUARD
  // ============================================
  // If the parent flips us into readOnly mode while a modal is open, the
  // template's `open={... && !readOnly}` gate hides the UI but the *state*
  // (takeStepOpen, modalOpen, promoteSessionId, etc.) survives. Clear it
  // proactively so a later switch back to edit mode starts fresh.
  $effect(() => {
    if (!readOnly) return;
    takeStepOpen = false;
    logNoMoveOpen = false;
    editEntryId = null;
    modalOpen = false;
    pendingTargetNode = null;
    pendingFromNode = null;
    pendingSessionEntry = null;
    promoteSessionId = null;
    stepDir = null;
    swapTargetId = null;
    renameGraphId = null;
    editGraphId = null;
    deleteGraphId = null;
    deleteBlockedReason = null;
    addCustomOpen = false;
    lootOpen = false;
  });
</script>

<svelte:window onkeydown={escapeHandler} />

<div class="space-y-4">
  <!-- ============= GRAPH LIBRARY ============= -->
  <GraphLibrary
    {character}
    {readOnly}
    onMakeActive={openSwapModal}
    onRename={openRenameModal}
    onEditNodes={openEditGraphModal}
    onDelete={confirmDeleteGraph}
    onAddCustom={openAddCustomModal}
    onLoot={openLootGraphModal}
  />

  <!-- ============= GRAPH + POSITION HEADER ============= -->
  <Card title={`Type graph — ${(activeOwned?.name ?? character.type.toUpperCase())}`}>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div class="text-neutral-300">
        Position: <strong class="text-neutral-100">({currentPos.x}, {currentPos.y})</strong>
        {#if currentNode}
          <Badge variant="info">{currentNode.kind.replace('_', ' + ')}</Badge>
        {:else if currentPos.x === 0 && currentPos.y === 0}
          <Badge variant="warning">origo</Badge>
        {:else}
          <Badge variant="warning">intermediate</Badge>
        {/if}
      </div>
      <div class="text-neutral-300">
        Shadow <strong class="text-neutral-100">{character.shadow}</strong> · Gunta value
        <strong class="text-neutral-100">{character.guntaValue}</strong>
      </div>
    </div>

    <div class="overflow-x-auto">
      <TypeGraphView
        {graph}
        currentPosition={currentPos}
        interactive={false}
        mode="view"
        highlightOrthogonals={!readOnly && takeStepOpen && !stepDir}
        highlightCell={!readOnly && takeStepOpen && stepDir ? takeStepTarget : null}
      />
    </div>

    {#if readOnly}
      <p class="mt-4 rounded-lg bg-neutral-800/40 p-2 text-xs italic text-neutral-400">
        View mode — switch to Edit to log sessions or take advancement steps.
      </p>
    {:else}
      <!-- Primary advancement controls -->
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button onclick={openTakeStep}>Take advancement step…</Button>
        <Button variant="secondary" onclick={openLogNoMove}>Log session (no move)</Button>
      </div>
      <p class="mt-3 rounded-lg bg-neutral-800/40 p-2 text-xs text-neutral-400">
        Per rules/52 (strict): each session you survive a shadow encounter of degree &gt; current Shadow ({character.shadow}), you may take ONE orthogonal step on the graph. Use it or lose it — there is no banking. To reach a plotted node 2 steps away, advance over two separate sessions.
      </p>
    {/if}
  </Card>

  <TypeGraphLegend />

  <!-- ============= SESSION LOG ============= -->
  <Card title="Session log">
    {#if sessionLog.length === 0}
      <p class="text-sm text-neutral-400">
        No sessions logged yet.
        {#if !readOnly}
          Use <em>Take advancement step</em> when you advance, or <em>Log session (no move)</em> to record a session without movement.
        {/if}
      </p>
    {:else}
      <ul class="space-y-2">
        {#each sessionLog as e (e.id)}
          {@const tied = sessionIsTied(e)}
          <li
            id={sessionRowDomId(e.id)}
            class={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-neutral-900/40 p-2 text-sm ${
              tied ? 'border-cyan-500/40' : 'border-neutral-800'
            }`}
          >
            <div class="flex-1">
              <p class="text-neutral-100">
                <span class="text-xs text-neutral-500">{new Date(e.loggedAt).toLocaleString()}</span>
                {#if e.sessionLabel}
                  <span class="ml-2 font-semibold">{e.sessionLabel}</span>
                {/if}
                {#if e.moved}
                  <Badge variant="success">advanced</Badge>
                {:else}
                  <Badge variant="warning">no move</Badge>
                {/if}
                {#if tied}
                  <span
                    class="ml-1 inline-flex items-center gap-1 rounded bg-cyan-900/40 px-1.5 py-0.5 text-xs text-cyan-200"
                    title="Linked to an advancement step — rollback the step first to delete this entry. Edits are still allowed but count as a record correction."
                    aria-label="Linked to advancement history"
                  >
                    <span aria-hidden="true">🔗</span> linked
                  </span>
                {/if}
              </p>
              <p class="mt-0.5 text-xs text-neutral-400">
                {#if e.highestEncounterDegree !== undefined}
                  Highest encounter degree: <strong class="text-neutral-300">{e.highestEncounterDegree}</strong>
                {/if}
                {#if e.shadowAtSessionStart !== undefined}
                  · Shadow at start: {e.shadowAtSessionStart}
                {/if}
                {#if e.moved && e.fromNode && e.toNode}
                  · <span class="text-cyan-300">moved ({e.fromNode.x},{e.fromNode.y}) → ({e.toNode.x},{e.toNode.y})</span>
                  {#if e.direction}
                    [{e.direction}]
                  {/if}
                {/if}
              </p>
              {#if e.notes}
                <p class="mt-1 text-xs italic text-neutral-300">"{e.notes}"</p>
              {/if}
            </div>
            {#if !readOnly}
              <div class="flex flex-wrap gap-1">
                {#if !e.moved}
                  <span
                    class="inline-block"
                    title="Promote this no-move session into an advancement step. The existing entry is updated in place — no new session is created."
                  >
                    <Button variant="secondary" onclick={() => openPromoteSession(e)}>
                      Take step using this session
                    </Button>
                  </span>
                {/if}
                <Button variant="ghost" onclick={() => openEditEntry(e)}>Edit</Button>
                {#if tied}
                  <span
                    class="inline-block"
                    title="Linked to advancement step — rollback the step first."
                  >
                    <Button variant="ghost" disabled onclick={() => removeEntry(e.id)}>
                      Remove
                    </Button>
                  </span>
                {:else}
                  <Button variant="ghost" onclick={() => removeEntry(e.id)}>Remove</Button>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <!-- ============= ADVANCEMENT HISTORY ============= -->
  <Card title="Advancement history">
    {#if history.length === 0}
      <p class="text-sm text-neutral-400">
        No steps logged yet. The character starts at origo (0, 0); each step you advance is logged here.
      </p>
    {:else}
      <ul class="space-y-2">
        {#each history as h (h.id)}
          {@const linkedSession = findLinkedSession(h)}
          <li class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-neutral-100">
                ({h.fromNode.x}, {h.fromNode.y}) → <strong>({h.toNode.x}, {h.toNode.y})</strong>
                <span class="ml-2 text-xs text-neutral-500">{new Date(h.appliedAt).toLocaleString()}</span>
              </p>
              {#if h.reversible && !readOnly}
                <Button variant="ghost" onclick={() => rollback(h)}>Undo</Button>
              {:else if !h.reversible}
                <span class="text-xs text-neutral-500">locked</span>
              {/if}
            </div>
            {#if linkedSession}
              <button
                type="button"
                class="mt-1 inline-flex items-center gap-1 rounded bg-cyan-900/40 px-1.5 py-0.5 text-xs text-cyan-200 hover:bg-cyan-900/60 hover:text-cyan-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                onclick={() => scrollToSession(linkedSession.id)}
                title="Scroll to the linked session log entry"
                aria-label={`Powered by session ${linkedSession.sessionLabel ?? '<unlabeled>'} (degree ${linkedSession.highestEncounterDegree ?? '—'}). Click to scroll to it.`}
              >
                <span aria-hidden="true">🔗</span>
                powered by Session: {linkedSession.sessionLabel ?? '<unlabeled>'}
                {#if linkedSession.highestEncounterDegree !== undefined}
                  (degree {linkedSession.highestEncounterDegree})
                {/if}
              </button>
            {:else if h.sessionLogEntryId}
              <p class="mt-1 inline-flex items-center gap-1 rounded bg-neutral-800/60 px-1.5 py-0.5 text-xs text-neutral-400">
                <span aria-hidden="true">🔗</span>
                linked session missing (id {h.sessionLogEntryId.slice(0, 8)})
              </p>
            {/if}
            <ul class="mt-1 space-y-0.5 text-xs text-neutral-400">
              {#each h.changes as c}
                <li>· {c}</li>
              {/each}
            </ul>
            {#if h.notes}
              <p class="mt-1 text-xs italic text-neutral-300">"{h.notes}"</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <!-- ============= TAKE-STEP MODAL =============
       Modal opens when the player clicks "Take advancement step…". Player
       picks a direction; preview shows where the step lands. On confirm,
       intermediate cells apply directly; plotted nodes chain into
       AdvancementModal for node effects. Defense-in-depth: gate `open`
       on `!readOnly` too. -->
  <Modal open={takeStepOpen && !readOnly} title={takeStepTitle} onclose={closeTakeStep}>
    {#snippet children()}
      <div class="space-y-3 text-sm text-neutral-300">
        {#if isPromoteMode}
          <p class="rounded-lg border border-cyan-700/40 bg-cyan-900/20 p-2 text-xs text-cyan-100">
            <span aria-hidden="true">🔗</span> Promoting an existing no-move session log entry. On confirm, this entry will be updated in place (its <code>moved</code>, from/to, and direction fields populated) — no new session entry will be created.
          </p>
        {/if}
        <p class="text-xs text-neutral-400">
          Per rules/52: surviving a shadow encounter of degree &gt; current Shadow ({character.shadow}) lets you take ONE orthogonal step on the graph this session.
        </p>
        <Input label="Session label" bind:value={stepLabel} placeholder="e.g. Session 3, scene 2" />
        <NumberInput
          label="Highest survived shadow encounter degree this session"
          value={stepDegree}
          min={0}
          onchange={(v) => (stepDegree = v)}
        />
        <TextArea label="Notes (optional)" bind:value={stepNotes} rows={3} placeholder="What happened?" />

        <div>
          <p class="mb-1 text-xs text-neutral-400">Direction (one orthogonal step from current position):</p>
          <div class="flex flex-wrap items-center gap-2">
            {#each ORTHOGONAL_DIRS as d (d.dir)}
              {@const target = applyDir(currentPos, d.dir)}
              {@const inBounds = target !== null}
              {@const picked = stepDir === d.dir}
              <button
                type="button"
                class={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition ${
                  picked
                    ? 'border-cyan-400 bg-cyan-900/40 text-cyan-100'
                    : 'border-neutral-700 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-800'
                } disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={!inBounds}
                onclick={() => (stepDir = d.dir)}
                aria-pressed={picked}
              >
                <span class="text-lg">{d.symbol}</span>
                <span class="text-xs uppercase">{d.dir}</span>
                {#if inBounds}
                  <span class="text-xs text-neutral-400">→ ({target!.x},{target!.y})</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        {#if stepDir && takeStepTarget}
          <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2 text-xs">
            Will move to <strong class="text-neutral-100">({takeStepTarget.x}, {takeStepTarget.y})</strong>
            {#if takeStepLandsOnNode}
              <Badge variant="info">plotted node</Badge>
              <span class="text-neutral-400"> — node-effects wizard will open after confirming.</span>
            {:else}
              <Badge variant="warning">intermediate cell</Badge>
              <span class="text-neutral-400"> — Shadow → {takeStepTarget.x}, Gunta → {takeStepTarget.y}.</span>
            {/if}
          </div>
        {/if}
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeTakeStep}>Cancel</Button>
      <Button disabled={!stepDir} onclick={confirmTakeStep}>Confirm step</Button>
    {/snippet}
  </Modal>

  <!-- ============= LOG-SESSION-NO-MOVE MODAL ============= -->
  <Modal open={logNoMoveOpen && !readOnly} title="Log session (no move)" onclose={closeLogNoMove}>
    {#snippet children()}
      <div class="space-y-3 text-sm text-neutral-300">
        <p class="text-xs text-neutral-400">
          Record a session without an advancement step. Use this when you didn't survive a high-enough-degree encounter, or chose not to advance.
        </p>
        <Input label="Session label" bind:value={noMoveLabel} placeholder="e.g. Session 4, downtime" />
        <NumberInput
          label="Highest survived shadow encounter degree (optional)"
          value={noMoveDegree}
          min={0}
          onchange={(v) => (noMoveDegree = v)}
        />
        <TextArea label="Notes (optional)" bind:value={noMoveNotes} rows={3} placeholder="What happened?" />
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeLogNoMove}>Cancel</Button>
      <Button onclick={confirmLogNoMove}>Log session</Button>
    {/snippet}
  </Modal>

  <!-- ============= EDIT-ENTRY MODAL ============= -->
  <Modal open={!!editEntry && !readOnly} title="Edit session log entry" onclose={closeEditEntry}>
    {#snippet children()}
      {#if editEntry}
        <div class="space-y-3 text-sm text-neutral-300">
          <p class="text-xs text-neutral-400">
            Update the record. Edits do NOT change the character's position or stats — only the historical entry.
          </p>
          {#if sessionIsTied(editEntry)}
            <p class="rounded-lg border border-amber-700/40 bg-amber-900/20 p-2 text-xs text-amber-200">
              <span aria-hidden="true">🔗</span> This session powers an advancement step. Editing degree (or label) is a <strong>record correction</strong> — the audit trail keeps the original advancement linked. Roll back the step first if you want a clean undo.
            </p>
          {/if}
          <Input label="Session label" bind:value={editLabel} placeholder="e.g. Session 3, scene 2" />
          <NumberInput
            label="Highest survived shadow encounter degree"
            value={editDegree}
            min={0}
            onchange={(v) => (editDegree = v)}
          />
          <TextArea label="Notes" bind:value={editNotes} rows={3} />
        </div>
      {/if}
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeEditEntry}>Cancel</Button>
      <Button onclick={confirmEditEntry}>Save changes</Button>
    {/snippet}
  </Modal>

  <!-- ============= ADVANCEMENT WIZARD MODAL =============
       Triggered when the take-step modal lands on a plotted node. The
       wizard walks the player through node effects (floors, spaces,
       keywords, bond) and, on confirm, writes both the SessionLogEntry
       AND the AdvancementLogEntry. -->
  {#if pendingTargetNode && pendingFromNode && pendingSessionEntry && modalOpen && !readOnly}
    <AdvancementModal
      open={modalOpen}
      {character}
      targetNode={pendingTargetNode}
      sessionLogEntry={pendingSessionEntry}
      onclose={closeModal}
      onconfirm={handleConfirm}
    />
  {/if}

  <!-- ============= GRAPH-LIBRARY MODALS ============= -->
  {#if swapTargetId && !readOnly}
    <GraphSwapModal
      open={!!swapTargetId}
      {character}
      toGraphId={swapTargetId}
      onclose={closeSwapModal}
      onConfirm={handleSwapConfirm}
    />
  {/if}

  {#if editGraphId && !readOnly}
    <CustomGraphEditor
      open={!!editGraphId}
      {character}
      graphId={editGraphId}
      onclose={closeEditGraphModal}
      onSave={handleEditGraphSave}
    />
  {/if}

  <Modal open={!!renameGraphId && !readOnly} title="Rename graph" onclose={closeRenameModal}>
    {#snippet children()}
      <div class="space-y-2 text-sm">
        <Input label="Graph name" bind:value={renameDraft} placeholder="e.g. My Spy Build" />
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeRenameModal}>Cancel</Button>
      <Button onclick={confirmRename} disabled={!renameDraft.trim()}>Save</Button>
    {/snippet}
  </Modal>

  <Modal open={!!deleteGraphId && !readOnly} title="Delete graph?" onclose={cancelDelete}>
    {#snippet children()}
      <p class="text-sm text-neutral-300">
        Delete this graph from your library? This cannot be undone (the graph
        is removed from the character permanently). Any advancement history
        already logged stays in place.
      </p>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={cancelDelete}>Cancel</Button>
      <Button onclick={performDelete}>Delete</Button>
    {/snippet}
  </Modal>

  <Modal open={!!deleteBlockedReason && !readOnly} title="Delete refused" onclose={cancelDelete}>
    {#snippet children()}
      <p class="text-sm text-neutral-300">{deleteBlockedReason}</p>
    {/snippet}
    {#snippet footer()}
      <Button onclick={cancelDelete}>OK</Button>
    {/snippet}
  </Modal>

  <Modal open={addCustomOpen && !readOnly} title="Add custom graph" onclose={closeAddCustomModal}>
    {#snippet children()}
      <div class="space-y-2 text-sm text-neutral-300">
        <p class="text-xs text-neutral-400">
          Create a brand-new advancement graph for this character. The graph
          starts empty — add nodes via the "Edit nodes" button afterward.
        </p>
        <Input label="Name" bind:value={addCustomName} placeholder="e.g. Custom: My Spy Build" />
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeAddCustomModal}>Cancel</Button>
      <Button onclick={performAddCustom}>Add graph</Button>
    {/snippet}
  </Modal>

  <Modal open={lootOpen && !readOnly} title="Loot a graph" onclose={closeLootModal}>
    {#snippet children()}
      <div class="space-y-3 text-sm text-neutral-300">
        <p class="text-xs text-neutral-400">
          Add a graph to the library by cloning one of the existing type
          defaults. Use this when an adventure rewards your character with a
          new advancement path. Optionally start blank if the looted graph is
          a rough sketch you'll fill in later.
        </p>
        <Input label="Name" bind:value={lootName} placeholder="e.g. Looted: Gauss Researcher Path" />
        <Select
          label="Clone source (type)"
          options={[
            { value: 'apt', label: 'Apt (default)' },
            { value: 'core', label: 'Core (default)' },
            { value: 'prime', label: 'Prime (default)' }
          ]}
          value={lootSourceType}
          onchange={(v) => (lootSourceType = v as 'apt' | 'core' | 'prime')}
        />
        <label class="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" bind:checked={lootBlank} />
          <span>Start blank (clone origo only — no plotted nodes)</span>
        </label>
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={closeLootModal}>Cancel</Button>
      <Button onclick={performLoot}>Loot graph</Button>
    {/snippet}
  </Modal>
</div>

/**
 * DawStore.ts — Application Controller (Layer 2, BLoC pattern).
 *
 * Owns DawState internally. Coordinates engine-first-state-second ordering.
 * Exposes subscribe/getProjectSnapshot/getUiSnapshot for useSyncExternalStore.
 *
 * CRITICAL: No React imports. No side effects outside of #dispatch.
 * Engine calls ALWAYS precede state updates — if engine throws, state is
 * unchanged (external store consistency guarantee).
 */
import type { DawState, ProjectDocument, UiState } from './types';
import type { DawAction } from './actions';
import { dawReducer } from './dawReducer';
import { createIdService } from './idService';
import type { EngineApi } from '../engine/engineSingleton';

export class DawStore {
  #state: DawState;
  #engine: EngineApi;
  #listeners: Set<() => void>;
  #idService: ReturnType<typeof createIdService>;
  #projectSnapshot: ProjectDocument;
  #uiSnapshot: UiState;

  constructor(engine: EngineApi, initialState: DawState) {
    this.#engine = engine;
    this.#state = initialState;
    this.#listeners = new Set();
    this.#idService = createIdService();

    // Seed the ID service with all pre-existing track IDs so they are never
    // regenerated, even after the tracks are removed.
    this.#idService.seed(initialState.project.tracks.ids as string[]);

    // Initialize cached snapshots — same reference until state changes.
    // Object.freeze prevents accidental mutation of snapshot objects.
    this.#projectSnapshot = Object.freeze({ ...initialState.project });
    this.#uiSnapshot = Object.freeze({ ...initialState.ui });
  }

  // ---------------------------------------------------------------------------
  // useSyncExternalStore interface
  // Arrow-method class fields: stable reference identity across renders.
  // Passing these directly to useSyncExternalStore is safe without useCallback.
  // ---------------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /**
   * Returns the cached ProjectDocument snapshot.
   * Same reference is returned on successive calls when state has not changed.
   * React uses Object.is to detect changes — NEVER construct new object here.
   */
  getProjectSnapshot = (): ProjectDocument => this.#projectSnapshot;

  /**
   * Returns the cached UiState snapshot.
   * Same reference is returned on successive calls when state has not changed.
   */
  getUiSnapshot = (): UiState => this.#uiSnapshot;

  // ---------------------------------------------------------------------------
  // Public methods — engine first, state second
  // ---------------------------------------------------------------------------

  /**
   * Add a new audio track.
   * 1. Generates unique ID via ID service (never reuses removed IDs).
   * 2. Creates engine subgraph — engine FIRST.
   * 3. Dispatches ADD_TRACK — state SECOND.
   * Returns the new track ID.
   */
  addTrack(): string {
    const id = this.#idService.generate();
    const displayName = `Track ${this.#state.project.tracks.ids.length + 1}`;

    // Engine first — if this throws, state is never modified.
    this.#engine.createTrackSubgraph(id);

    // State second — dispatched atomically (ADD_TRACK also auto-selects in uiReducer).
    this.#dispatch({ type: 'ADD_TRACK', id, displayName });

    return id;
  }

  /**
   * Remove an audio track by ID.
   * Enforces min-1 track rule — returns early without engine or state change.
   * Engine FIRST, state SECOND.
   */
  removeTrack(id: string): void {
    // Business rule: cannot remove the last track.
    if (this.#state.project.tracks.ids.length <= 1) {
      return;
    }

    // Guard: track must exist in state.
    if (!(id in this.#state.project.tracks.byId)) {
      return;
    }

    // Engine first — if this throws, state is never modified.
    this.#engine.removeTrackSubgraph(id);

    // State second.
    this.#dispatch({ type: 'REMOVE_TRACK', id });
  }

  /**
   * Select a track by ID.
   * UI-only — no engine call required.
   */
  selectTrack(id: string): void {
    this.#dispatch({ type: 'SELECT_TRACK', id });
  }

  /**
   * Set record-arm state for a track.
   * UI-only — no engine call required.
   */
  setRecArm(trackId: string, armed: boolean): void {
    this.#dispatch({ type: 'SET_REC_ARM', trackId, armed });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Internal dispatch: runs dawReducer, updates snapshots if state changed,
   * then notifies all listeners.
   *
   * Snapshots are only replaced when their respective slices change (reference
   * equality check). This prevents unnecessary re-renders in useSyncExternalStore
   * consumers that only subscribe to one slice.
   */
  #dispatch(action: DawAction): void {
    const newState = dawReducer(this.#state, action);

    // Replace snapshot references only if the slice actually changed.
    // Object.is is used here (same check React uses in useSyncExternalStore).
    if (!Object.is(newState.project, this.#state.project)) {
      this.#projectSnapshot = Object.freeze({ ...newState.project });
    }
    if (!Object.is(newState.ui, this.#state.ui)) {
      this.#uiSnapshot = Object.freeze({ ...newState.ui });
    }

    this.#state = newState;
    this.#notify();
  }

  /** Notify all subscribed listeners (e.g. React re-renders via useSyncExternalStore). */
  #notify(): void {
    this.#listeners.forEach((listener) => listener());
  }
}

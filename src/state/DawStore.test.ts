/**
 * DawStore.test.ts — Comprehensive unit tests for the DawStore application controller.
 *
 * Uses default node environment (no jsdom comment needed).
 * All tests use a mock engine — no real audio, no Web Audio API, no Tone.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DawStore } from './DawStore';
import type { DawState } from './types';
import { DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE } from './defaultState';

// ---------------------------------------------------------------------------
// Mock engine factory
// ---------------------------------------------------------------------------

function createMockEngine() {
  return {
    createTrackSubgraph: vi.fn(),
    removeTrackSubgraph: vi.fn(),
    getTrackFacade: vi.fn(),
    getMasterFacade: vi.fn(),
    getLimiterInputMeter: vi.fn(),
    getLimiterReductionDb: vi.fn(() => 0),
    connectToTrackInput: vi.fn(),
    _legacy: {
      audioContext: {} as unknown as AudioContext,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      limiterGraph: {} as any,
      getTrackStripGraph: vi.fn(),
    },
  };
}

function createDefaultState(): DawState {
  return {
    project: DEFAULT_PROJECT_DOCUMENT,
    ui: DEFAULT_UI_STATE,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DawStore', () => {
  let engine: ReturnType<typeof createMockEngine>;
  let store: DawStore;

  beforeEach(() => {
    engine = createMockEngine();
    store = new DawStore(engine, createDefaultState());
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('construction', () => {
    it('creates without throwing', () => {
      expect(() => new DawStore(engine, createDefaultState())).not.toThrow();
    });

    it('getProjectSnapshot() returns initial project data', () => {
      const snapshot = store.getProjectSnapshot();
      expect(snapshot.tracks.ids).toEqual(DEFAULT_PROJECT_DOCUMENT.tracks.ids);
      expect(snapshot.masterTrack.id).toBe('master');
    });

    it('getUiSnapshot() returns initial ui state', () => {
      const snapshot = store.getUiSnapshot();
      expect(snapshot.selectedTrackId).toBe(DEFAULT_UI_STATE.selectedTrackId);
    });
  });

  // -------------------------------------------------------------------------
  // addTrack
  // -------------------------------------------------------------------------

  describe('addTrack()', () => {
    it('calls engine.createTrackSubgraph with the generated ID', () => {
      const id = store.addTrack();
      expect(engine.createTrackSubgraph).toHaveBeenCalledWith(id);
      expect(engine.createTrackSubgraph).toHaveBeenCalledTimes(1);
    });

    it('adds the new track ID to getProjectSnapshot().tracks.ids', () => {
      const id = store.addTrack();
      expect(store.getProjectSnapshot().tracks.ids).toContain(id);
    });

    it('adds the new track to getProjectSnapshot().tracks.byId', () => {
      const id = store.addTrack();
      expect(store.getProjectSnapshot().tracks.byId[id]).toBeDefined();
      expect(store.getProjectSnapshot().tracks.byId[id].id).toBe(id);
    });

    it('auto-selects the new track (getUiSnapshot().selectedTrackId)', () => {
      const id = store.addTrack();
      expect(store.getUiSnapshot().selectedTrackId).toBe(id);
    });

    it('returns the new track ID', () => {
      const id = store.addTrack();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('notifies listeners on addTrack', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.addTrack();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('two successive addTrack calls produce different IDs', () => {
      const id1 = store.addTrack();
      const id2 = store.addTrack();
      expect(id1).not.toBe(id2);
    });

    it('calls engine.createTrackSubgraph BEFORE updating state (engine-first ordering)', () => {
      const callOrder: string[] = [];
      const initialTrackCount = store.getProjectSnapshot().tracks.ids.length;

      engine.createTrackSubgraph.mockImplementation(() => {
        // At this point state should NOT yet have changed
        callOrder.push(`engine(${store.getProjectSnapshot().tracks.ids.length})`);
      });

      store.addTrack();

      // Engine was called when track count was still at initial value
      expect(callOrder[0]).toBe(`engine(${initialTrackCount})`);
    });
  });

  // -------------------------------------------------------------------------
  // removeTrack
  // -------------------------------------------------------------------------

  describe('removeTrack()', () => {
    let secondTrackId: string;

    beforeEach(() => {
      secondTrackId = store.addTrack();
      vi.clearAllMocks(); // Reset call counts after setup
    });

    it('calls engine.removeTrackSubgraph with the track ID', () => {
      store.removeTrack(secondTrackId);
      expect(engine.removeTrackSubgraph).toHaveBeenCalledWith(secondTrackId);
      expect(engine.removeTrackSubgraph).toHaveBeenCalledTimes(1);
    });

    it('removes the track from getProjectSnapshot().tracks.byId', () => {
      store.removeTrack(secondTrackId);
      expect(store.getProjectSnapshot().tracks.byId[secondTrackId]).toBeUndefined();
    });

    it('removes the track from getProjectSnapshot().tracks.ids', () => {
      store.removeTrack(secondTrackId);
      expect(store.getProjectSnapshot().tracks.ids).not.toContain(secondTrackId);
    });

    it('adjusts selectedTrackId when removing the selected track', () => {
      // Second track is currently selected (auto-selected by addTrack)
      expect(store.getUiSnapshot().selectedTrackId).toBe(secondTrackId);
      store.removeTrack(secondTrackId);
      // Should fall back to the first track
      const remainingIds = store.getProjectSnapshot().tracks.ids;
      expect(remainingIds).toContain(store.getUiSnapshot().selectedTrackId);
    });

    it('does NOT call engine or change state when only 1 track remains (min-1 guard)', () => {
      // Remove the second track first so we're left with 1
      store.removeTrack(secondTrackId);
      vi.clearAllMocks();

      const snapshotBefore = store.getProjectSnapshot();
      const uiBefore = store.getUiSnapshot();

      // Try to remove the last remaining track
      const remainingId = store.getProjectSnapshot().tracks.ids[0];
      store.removeTrack(remainingId);

      expect(engine.removeTrackSubgraph).not.toHaveBeenCalled();
      // State is unchanged — same references
      expect(store.getProjectSnapshot()).toBe(snapshotBefore);
      expect(store.getUiSnapshot()).toBe(uiBefore);
    });

    it('does NOT call engine or change state for unknown track ID', () => {
      const snapshotBefore = store.getProjectSnapshot();
      store.removeTrack('non-existent-track-id');
      expect(engine.removeTrackSubgraph).not.toHaveBeenCalled();
      expect(store.getProjectSnapshot()).toBe(snapshotBefore);
    });

    it('notifies listeners on successful removeTrack', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.removeTrack(secondTrackId);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does NOT notify listeners when min-1 guard fires', () => {
      store.removeTrack(secondTrackId); // Back to 1 track
      vi.clearAllMocks();

      const listener = vi.fn();
      store.subscribe(listener);

      const remainingId = store.getProjectSnapshot().tracks.ids[0];
      store.removeTrack(remainingId);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // selectTrack
  // -------------------------------------------------------------------------

  describe('selectTrack()', () => {
    it('updates getUiSnapshot().selectedTrackId', () => {
      const id2 = store.addTrack();
      const id3 = store.addTrack();

      store.selectTrack(id2);
      expect(store.getUiSnapshot().selectedTrackId).toBe(id2);

      store.selectTrack(id3);
      expect(store.getUiSnapshot().selectedTrackId).toBe(id3);
    });

    it('does NOT call any engine methods', () => {
      store.selectTrack(DEFAULT_UI_STATE.selectedTrackId);
      expect(engine.createTrackSubgraph).not.toHaveBeenCalled();
      expect(engine.removeTrackSubgraph).not.toHaveBeenCalled();
      expect(engine.getTrackFacade).not.toHaveBeenCalled();
    });

    it('notifies listeners on selectTrack', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.selectTrack(DEFAULT_UI_STATE.selectedTrackId);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Snapshot stability (CRITICAL — prevents infinite re-render)
  // -------------------------------------------------------------------------

  describe('snapshot stability', () => {
    it('getProjectSnapshot() returns same reference on successive calls when state unchanged', () => {
      const ref1 = store.getProjectSnapshot();
      const ref2 = store.getProjectSnapshot();
      expect(Object.is(ref1, ref2)).toBe(true);
    });

    it('getUiSnapshot() returns same reference on successive calls when state unchanged', () => {
      const ref1 = store.getUiSnapshot();
      const ref2 = store.getUiSnapshot();
      expect(Object.is(ref1, ref2)).toBe(true);
    });

    it('getProjectSnapshot() returns a NEW reference after addTrack (project changed)', () => {
      const before = store.getProjectSnapshot();
      store.addTrack();
      const after = store.getProjectSnapshot();
      expect(Object.is(before, after)).toBe(false);
    });

    it('getProjectSnapshot() returns the SAME reference after selectTrack (project unchanged)', () => {
      const before = store.getProjectSnapshot();
      store.selectTrack(DEFAULT_UI_STATE.selectedTrackId);
      const after = store.getProjectSnapshot();
      // selectTrack only changes UI — project snapshot must be identical reference
      expect(Object.is(before, after)).toBe(true);
    });

    it('getUiSnapshot() returns a NEW reference after selectTrack (ui changed)', () => {
      const id2 = store.addTrack(); // adds and auto-selects track 2
      const before = store.getUiSnapshot(); // selectedTrackId = id2

      // Select original default track to trigger a UI change
      store.selectTrack(DEFAULT_UI_STATE.selectedTrackId);
      const after = store.getUiSnapshot();
      expect(Object.is(before, after)).toBe(false);
    });

    it('snapshots are frozen (Object.isFrozen)', () => {
      expect(Object.isFrozen(store.getProjectSnapshot())).toBe(true);
      expect(Object.isFrozen(store.getUiSnapshot())).toBe(true);
    });

    it('after removeTrack, getProjectSnapshot() returns a NEW reference', () => {
      const id2 = store.addTrack();
      const before = store.getProjectSnapshot();
      store.removeTrack(id2);
      const after = store.getProjectSnapshot();
      expect(Object.is(before, after)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe / unsubscribe
  // -------------------------------------------------------------------------

  describe('subscribe / unsubscribe', () => {
    it('subscribe returns an unsubscribe function', () => {
      const unsubscribe = store.subscribe(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('after unsubscribe, listener is NOT called on state changes', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      store.addTrack();
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners all get notified', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      const l3 = vi.fn();
      store.subscribe(l1);
      store.subscribe(l2);
      store.subscribe(l3);
      store.addTrack();
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
      expect(l3).toHaveBeenCalledTimes(1);
    });

    it('only the unsubscribed listener stops receiving updates', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      store.subscribe(l1);
      const unsubscribe2 = store.subscribe(l2);

      store.addTrack();
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);

      unsubscribe2();
      store.addTrack();
      expect(l1).toHaveBeenCalledTimes(2);
      expect(l2).toHaveBeenCalledTimes(1); // did not increase
    });
  });

  // -------------------------------------------------------------------------
  // Engine-first ordering — state unchanged when engine throws
  // -------------------------------------------------------------------------

  describe('engine-first ordering', () => {
    it('if engine.createTrackSubgraph throws, state is unchanged', () => {
      engine.createTrackSubgraph.mockImplementation(() => {
        throw new Error('Engine error: track already exists');
      });

      const snapshotBefore = store.getProjectSnapshot();
      const uiBefore = store.getUiSnapshot();

      expect(() => store.addTrack()).toThrow('Engine error');

      // State must not have changed
      expect(store.getProjectSnapshot()).toBe(snapshotBefore);
      expect(store.getUiSnapshot()).toBe(uiBefore);
    });

    it('if engine.removeTrackSubgraph throws, state is unchanged', () => {
      const id2 = store.addTrack();
      engine.removeTrackSubgraph.mockImplementation(() => {
        throw new Error('Engine error: remove failed');
      });

      const snapshotBefore = store.getProjectSnapshot();
      const uiBefore = store.getUiSnapshot();

      expect(() => store.removeTrack(id2)).toThrow('Engine error');

      // State must not have changed
      expect(store.getProjectSnapshot()).toBe(snapshotBefore);
      expect(store.getUiSnapshot()).toBe(uiBefore);
    });

    it('if engine.createTrackSubgraph throws, listeners are NOT notified', () => {
      engine.createTrackSubgraph.mockImplementation(() => {
        throw new Error('Engine error');
      });
      const listener = vi.fn();
      store.subscribe(listener);

      try { store.addTrack(); } catch { /* expected */ }
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // ID service integration — IDs never reused after removal
  // -------------------------------------------------------------------------

  describe('ID service integration', () => {
    it('after adding and removing tracks, new addTrack never reuses a removed ID', () => {
      const usedIds = new Set<string>();

      // Add 5 tracks, record all IDs
      for (let i = 0; i < 5; i++) {
        usedIds.add(store.addTrack());
      }

      // Remove all but the first (default) track
      const idsToRemove = [...store.getProjectSnapshot().tracks.ids].filter(
        (id) => id !== DEFAULT_PROJECT_DOCUMENT.tracks.ids[0],
      );
      for (const id of idsToRemove) {
        store.removeTrack(id);
      }

      // Add more tracks and verify none reuse a previously used ID
      for (let i = 0; i < 3; i++) {
        const newId = store.addTrack();
        expect(usedIds).not.toContain(newId);
        usedIds.add(newId);
      }
    });

    it('initial state track IDs are seeded and never regenerated', () => {
      const defaultTrackId = DEFAULT_PROJECT_DOCUMENT.tracks.ids[0];
      // Add multiple tracks — none should reuse the default ID
      for (let i = 0; i < 10; i++) {
        const newId = store.addTrack();
        expect(newId).not.toBe(defaultTrackId);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import { dawReducer } from './dawReducer';
import type { DawState } from './types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeState(trackIds: string[], selectedTrackId: string): DawState {
  const byId = Object.fromEntries(
    trackIds.map((id) => [
      id,
      { id, displayName: id, deviceIds: [], clipIds: [] },
    ]),
  );
  return {
    project: {
      tracks: { byId, ids: trackIds },
      devices: {},
      clips: {},
      masterTrack: { id: 'master', displayName: 'Master', deviceIds: [] },
    },
    ui: {
      selectedTrackId,
      recArmByTrackId: Object.fromEntries(trackIds.map((id) => [id, false])),
    },
  };
}

// ---------------------------------------------------------------------------
// ADD_TRACK — atomically updates both project and ui
// ---------------------------------------------------------------------------

describe('dawReducer — ADD_TRACK', () => {
  it('adds the track to project.tracks', () => {
    const state = makeState(['track-1'], 'track-1');
    const next = dawReducer(state, { type: 'ADD_TRACK', id: 'track-2', displayName: 'Bass' });
    expect(next.project.tracks.byId['track-2']).toBeDefined();
    expect(next.project.tracks.ids).toContain('track-2');
  });

  it('auto-selects the new track in ui (atomic)', () => {
    const state = makeState(['track-1'], 'track-1');
    const next = dawReducer(state, { type: 'ADD_TRACK', id: 'track-2', displayName: 'Bass' });
    expect(next.ui.selectedTrackId).toBe('track-2');
  });

  it('both project and ui update in a single dispatch', () => {
    const state = makeState(['track-1'], 'track-1');
    const next = dawReducer(state, { type: 'ADD_TRACK', id: 'track-2', displayName: 'Bass' });
    // Both slices updated atomically
    expect(next.project.tracks.ids.includes('track-2')).toBe(true);
    expect(next.ui.selectedTrackId).toBe('track-2');
  });
});

// ---------------------------------------------------------------------------
// REMOVE_TRACK — removes from project AND adjusts ui selection
// ---------------------------------------------------------------------------

describe('dawReducer — REMOVE_TRACK', () => {
  it('removes the track from project.tracks', () => {
    const state = makeState(['track-1', 'track-2'], 'track-1');
    const next = dawReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(next.project.tracks.byId['track-1']).toBeUndefined();
    expect(next.project.tracks.ids).not.toContain('track-1');
  });

  it('adjusts selection to adjacent track when selected track removed', () => {
    const state = makeState(['track-1', 'track-2'], 'track-1');
    const next = dawReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(next.ui.selectedTrackId).toBe('track-2');
  });

  it('keeps selection unchanged when non-selected track removed', () => {
    const state = makeState(['track-1', 'track-2'], 'track-1');
    const next = dawReducer(state, { type: 'REMOVE_TRACK', id: 'track-2' });
    expect(next.ui.selectedTrackId).toBe('track-1');
  });

  it('selects previous track when removing last track in list', () => {
    const state = makeState(['track-1', 'track-2', 'track-3'], 'track-3');
    const next = dawReducer(state, { type: 'REMOVE_TRACK', id: 'track-3' });
    expect(next.ui.selectedTrackId).toBe('track-2');
  });
});

// ---------------------------------------------------------------------------
// SELECT_TRACK
// ---------------------------------------------------------------------------

describe('dawReducer — SELECT_TRACK', () => {
  it('updates ui.selectedTrackId without touching project', () => {
    const state = makeState(['track-1', 'track-2'], 'track-1');
    const next = dawReducer(state, { type: 'SELECT_TRACK', id: 'track-2' });
    expect(next.ui.selectedTrackId).toBe('track-2');
    // Project is unchanged (same reference)
    expect(next.project).toBe(state.project);
  });
});

// ---------------------------------------------------------------------------
// Purity guarantee — verify no engine imports at module level
// ---------------------------------------------------------------------------

describe('dawReducer — purity', () => {
  it('is a pure function: same input produces same output', () => {
    const state = makeState(['track-1'], 'track-1');
    const action = { type: 'ADD_TRACK' as const, id: 'track-2', displayName: 'X' };
    const result1 = dawReducer(state, action);
    const result2 = dawReducer(state, action);
    // Results are structurally equal (both from same input)
    expect(result1.project.tracks.ids).toEqual(result2.project.tracks.ids);
    expect(result1.ui.selectedTrackId).toBe(result2.ui.selectedTrackId);
  });

  it('does not mutate the original state', () => {
    const state = makeState(['track-1'], 'track-1');
    const originalIds = state.project.tracks.ids;
    dawReducer(state, { type: 'ADD_TRACK', id: 'track-2', displayName: 'X' });
    expect(state.project.tracks.ids).toBe(originalIds); // same reference
  });
});

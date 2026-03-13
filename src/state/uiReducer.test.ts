import { describe, it, expect } from 'vitest';
import { uiReducer } from './uiReducer';
import type { UiState, ProjectDocument } from './types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeUi(selectedTrackId = 'track-1'): UiState {
  return { selectedTrackId };
}

function makeProject(ids: string[]): ProjectDocument {
  const byId = Object.fromEntries(
    ids.map((id) => [
      id,
      { id, displayName: id, deviceIds: [], clipIds: [] },
    ]),
  );
  return {
    tracks: { byId, ids },
    devices: {},
    clips: {},
    masterTrack: { id: 'master', displayName: 'Master', deviceIds: [] },
  };
}

// ---------------------------------------------------------------------------
// ADD_TRACK
// ---------------------------------------------------------------------------

describe('uiReducer — ADD_TRACK', () => {
  it('sets selectedTrackId to the new track id', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1']);
    const next = uiReducer(ui, { type: 'ADD_TRACK', id: 'track-2', displayName: 'X' }, project);
    expect(next.selectedTrackId).toBe('track-2');
  });

  it('does not mutate original ui state', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1']);
    uiReducer(ui, { type: 'ADD_TRACK', id: 'track-2', displayName: 'X' }, project);
    expect(ui.selectedTrackId).toBe('track-1');
  });
});

// ---------------------------------------------------------------------------
// REMOVE_TRACK — selected track is removed
// ---------------------------------------------------------------------------

describe('uiReducer — REMOVE_TRACK (selected track removed)', () => {
  it('selects the next track when selected track is removed (not last)', () => {
    const ui = makeUi('track-1');
    // Project BEFORE removal: track-1, track-2, track-3
    const project = makeProject(['track-1', 'track-2', 'track-3']);
    const next = uiReducer(ui, { type: 'REMOVE_TRACK', id: 'track-1' }, project);
    expect(next.selectedTrackId).toBe('track-2');
  });

  it('selects the previous track when selected track is last', () => {
    const ui = makeUi('track-3');
    // Project BEFORE removal: track-1, track-2, track-3
    const project = makeProject(['track-1', 'track-2', 'track-3']);
    const next = uiReducer(ui, { type: 'REMOVE_TRACK', id: 'track-3' }, project);
    expect(next.selectedTrackId).toBe('track-2');
  });

  it('selects the previous track when selected is middle track and no next exists after gap', () => {
    const ui = makeUi('track-2');
    const project = makeProject(['track-1', 'track-2', 'track-3']);
    const next = uiReducer(ui, { type: 'REMOVE_TRACK', id: 'track-2' }, project);
    // track-3 is next (index 2), so it should be selected
    expect(next.selectedTrackId).toBe('track-3');
  });
});

// ---------------------------------------------------------------------------
// REMOVE_TRACK — non-selected track is removed
// ---------------------------------------------------------------------------

describe('uiReducer — REMOVE_TRACK (non-selected track removed)', () => {
  it('keeps current selection when a different track is removed', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1', 'track-2']);
    const next = uiReducer(ui, { type: 'REMOVE_TRACK', id: 'track-2' }, project);
    expect(next.selectedTrackId).toBe('track-1');
  });

  it('returns the same state reference when selection is unchanged', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1', 'track-2']);
    const next = uiReducer(ui, { type: 'REMOVE_TRACK', id: 'track-2' }, project);
    expect(next).toBe(ui); // same reference — no allocation
  });
});

// ---------------------------------------------------------------------------
// SELECT_TRACK
// ---------------------------------------------------------------------------

describe('uiReducer — SELECT_TRACK', () => {
  it('updates selectedTrackId', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1', 'track-2']);
    const next = uiReducer(ui, { type: 'SELECT_TRACK', id: 'track-2' }, project);
    expect(next.selectedTrackId).toBe('track-2');
  });

  it('does not change other ui state (idempotent on same id)', () => {
    const ui = makeUi('track-1');
    const project = makeProject(['track-1']);
    const next = uiReducer(ui, { type: 'SELECT_TRACK', id: 'track-1' }, project);
    expect(next.selectedTrackId).toBe('track-1');
  });
});

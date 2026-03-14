import { describe, it, expect } from 'vitest';
import { projectReducer } from './projectReducer';
import type { ProjectDocument } from './types';

// ---------------------------------------------------------------------------
// Minimal fixture helpers — no audio, no React
// ---------------------------------------------------------------------------

function makeProject(overrides?: Partial<ProjectDocument>): ProjectDocument {
  return {
    tracks: {
      byId: {
        'track-1': {
          id: 'track-1',
          displayName: 'synth1',
          deviceIds: ['dev-synth'],
          clipIds: ['clip-1'],
        },
      },
      ids: ['track-1'],
    },
    devices: {
      'dev-synth': { id: 'dev-synth', kind: 'SYNTH', displayName: 'Synth' },
    },
    clips: {},
    masterTrack: { id: 'master', displayName: 'Master', deviceIds: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ADD_TRACK
// ---------------------------------------------------------------------------

describe('projectReducer — ADD_TRACK', () => {
  it('adds the track to byId', () => {
    const state = makeProject();
    const next = projectReducer(state, {
      type: 'ADD_TRACK',
      id: 'track-2',
      displayName: 'Guitar',
    });
    expect(next.tracks.byId['track-2']).toBeDefined();
    expect(next.tracks.byId['track-2'].displayName).toBe('Guitar');
  });

  it('appends the track ID to ids', () => {
    const state = makeProject();
    const next = projectReducer(state, {
      type: 'ADD_TRACK',
      id: 'track-2',
      displayName: 'Guitar',
    });
    expect(next.tracks.ids).toEqual(['track-1', 'track-2']);
  });

  it('new track has empty deviceIds', () => {
    const state = makeProject();
    const next = projectReducer(state, {
      type: 'ADD_TRACK',
      id: 'track-2',
      displayName: 'Guitar',
    });
    expect(next.tracks.byId['track-2'].deviceIds).toEqual([]);
  });

  it('new track has empty clipIds', () => {
    const state = makeProject();
    const next = projectReducer(state, {
      type: 'ADD_TRACK',
      id: 'track-2',
      displayName: 'Guitar',
    });
    expect(next.tracks.byId['track-2'].clipIds).toEqual([]);
  });

  it('does not mutate original state', () => {
    const state = makeProject();
    const originalIds = state.tracks.ids;
    projectReducer(state, { type: 'ADD_TRACK', id: 'track-2', displayName: 'X' });
    expect(state.tracks.ids).toBe(originalIds); // same reference = not mutated
  });
});

// ---------------------------------------------------------------------------
// REMOVE_TRACK
// ---------------------------------------------------------------------------

describe('projectReducer — REMOVE_TRACK', () => {
  it('removes the track from byId', () => {
    const state = makeProject();
    const next = projectReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(next.tracks.byId['track-1']).toBeUndefined();
  });

  it('removes the track ID from ids', () => {
    const state = makeProject({
      tracks: {
        byId: {
          'track-1': { id: 'track-1', displayName: 'A', deviceIds: [], clipIds: [] },
          'track-2': { id: 'track-2', displayName: 'B', deviceIds: [], clipIds: [] },
        },
        ids: ['track-1', 'track-2'],
      },
    });
    const next = projectReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(next.tracks.ids).toEqual(['track-2']);
  });

  it('does not remove other tracks', () => {
    const state = makeProject({
      tracks: {
        byId: {
          'track-1': { id: 'track-1', displayName: 'A', deviceIds: [], clipIds: [] },
          'track-2': { id: 'track-2', displayName: 'B', deviceIds: [], clipIds: [] },
        },
        ids: ['track-1', 'track-2'],
      },
    });
    const next = projectReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(next.tracks.byId['track-2']).toBeDefined();
  });

  it('does not mutate original state', () => {
    const state = makeProject();
    const originalById = state.tracks.byId;
    projectReducer(state, { type: 'REMOVE_TRACK', id: 'track-1' });
    expect(state.tracks.byId).toBe(originalById);
  });
});

// ---------------------------------------------------------------------------
// SELECT_TRACK
// ---------------------------------------------------------------------------

describe('projectReducer — SELECT_TRACK', () => {
  it('returns state unchanged (selection is UI-only)', () => {
    const state = makeProject();
    const next = projectReducer(state, { type: 'SELECT_TRACK', id: 'track-1' });
    expect(next).toBe(state); // same reference
  });
});

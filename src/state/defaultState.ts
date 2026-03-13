import { DEFAULT_TRACK_ID } from '../engine/engineSingleton';
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_STORE,
} from '../project-runtime/midiClipStore';
import type { ProjectDocument, UiState } from './types';

/**
 * DEFAULT_PROJECT_DOCUMENT — initial project state that matches the engine
 * singleton's bootstrap state (track-1 + master chain pre-wired).
 *
 * Replaces DEFAULT_UI_PLAN + DEFAULT_MIDI_CLIP_STORE usage in App.tsx.
 */
export const DEFAULT_PROJECT_DOCUMENT: ProjectDocument = {
  tracks: {
    byId: {
      [DEFAULT_TRACK_ID]: {
        id: DEFAULT_TRACK_ID,
        displayName: 'synth1',
        deviceIds: ['dev-synth', 'dev-panner'],
        clipIds: [DEFAULT_MIDI_CLIP_ID],
      },
    },
    ids: [DEFAULT_TRACK_ID],
  },
  devices: {
    'dev-synth': { id: 'dev-synth', kind: 'SYNTH', displayName: 'Synth' },
    'dev-panner': { id: 'dev-panner', kind: 'PANNER', displayName: 'Panner' },
    'dev-limiter': { id: 'dev-limiter', kind: 'LIMITER', displayName: 'Limiter' },
  },
  clips: DEFAULT_MIDI_CLIP_STORE,
  masterTrack: {
    id: 'master',
    displayName: 'Master',
    deviceIds: ['dev-limiter'],
  },
};

/**
 * DEFAULT_UI_STATE — initial UI selection state.
 * Selects the default track on startup.
 */
export const DEFAULT_UI_STATE: UiState = {
  selectedTrackId: DEFAULT_TRACK_ID,
};

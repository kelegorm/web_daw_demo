// Re-export MidiClip and MidiStep so consumers import from src/state/types
// rather than reaching into project-runtime directly.
export type { MidiClip, MidiStep } from '../project-runtime/midiClipStore';

/** A single audio track in the project document. */
export interface Track {
  readonly id: string;
  readonly displayName: string;
  readonly deviceIds: readonly string[];
  readonly clipIds: readonly string[];
}

/** A device (instrument or effect) referenced by a Track or MasterTrack. */
export interface Device {
  readonly id: string;
  readonly kind: 'SYNTH' | 'PANNER' | 'LIMITER';
  readonly displayName: string;
}

/** The fixed master output track. */
export interface MasterTrack {
  readonly id: string;
  readonly displayName: string;
  readonly deviceIds: readonly string[];
}

/**
 * Normalized collection: O(1) lookup via byId, ordered iteration via ids.
 */
export interface NormalizedMap<T> {
  readonly byId: Readonly<Record<string, T>>;
  readonly ids: readonly string[];
}

/**
 * ProjectDocument — the structural, engine-independent representation of the
 * current music project. No audio values live here (gain, mute, pan, meters
 * all live on engine facades).
 */
export interface ProjectDocument {
  readonly tracks: NormalizedMap<Track>;
  readonly devices: Readonly<Record<string, Device>>;
  readonly clips: Readonly<Record<string, import('../project-runtime/midiClipStore').MidiClip>>;
  readonly masterTrack: MasterTrack;
}

/**
 * UiState — UI-only state that does not belong in the domain model.
 * Kept separate so selection changes do not re-render project consumers.
 */
export interface UiState {
  readonly selectedTrackId: string;
  /** Per-track record-arm state. True = armed. Managed by ADD_TRACK/REMOVE_TRACK/SET_REC_ARM. */
  readonly recArmByTrackId: Readonly<Record<string, boolean>>;
}

/**
 * DawState — combined top-level state held by DawStore.
 * Passed to dawReducer on each dispatch.
 */
export interface DawState {
  readonly project: ProjectDocument;
  readonly ui: UiState;
}

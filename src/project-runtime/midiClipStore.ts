export const STEP_BEATS = 0.5;

export interface MidiStep {
  /**
   * Step-level on/off flag used by sequencer event builders.
   */
  enabled: boolean;
  note: number;
  velocity: number;
  /**
   * Normalized note duration multiplier in range 0..1.
   * Note duration is derived as: stepDuration * gate.
   */
  gate: number;
}

export interface MidiClip {
  clipId: string;
  /**
   * Absolute clip offset in beats. Fractional values are valid, and value must be >= 0.
   */
  startBeat: number;
  /**
   * Number of sequencer steps in this clip. Must be an integer > 0.
   * Derived clip length in beats is: lengthSteps * STEP_BEATS.
   */
  lengthSteps: number;
  steps: MidiStep[];
}

export type MidiClipStore = Record<string, MidiClip>;

// Temporary default-id wiring for the current demo runtime only.
export const DEFAULT_MIDI_CLIP_ID = 'default-midi-clip';

const DEFAULT_NOTE_SEQUENCE = [60, 62, 64, 65, 67, 69, 71, 72];

// Temporary default clip data; remove after project-runtime clip loading is in place.
export const DEFAULT_MIDI_CLIP_STORE: MidiClipStore = {
  [DEFAULT_MIDI_CLIP_ID]: {
    clipId: DEFAULT_MIDI_CLIP_ID,
    startBeat: 0,
    lengthSteps: DEFAULT_NOTE_SEQUENCE.length,
    steps: DEFAULT_NOTE_SEQUENCE.map((note) => ({
      enabled: true,
      note,
      velocity: 100,
      gate: 0.8,
    })),
  },
};

export function getMidiClipOrThrow(store: MidiClipStore, clipId: string): MidiClip {
  const clip = store[clipId];
  if (!clip) {
    throw new Error(`Missing MIDI clip for clipId "${clipId}"`);
  }

  return clip;
}

export function getMidiClipLengthBeats(clip: MidiClip): number {
  return clip.lengthSteps * STEP_BEATS;
}

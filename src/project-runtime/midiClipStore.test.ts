import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
  getMidiClipLengthBeats,
  getMidiClipOrThrow,
  resolveMidiClipSourceOrThrow,
  type MidiClipStore,
} from './midiClipStore';

describe('midiClipStore', () => {
  it('exports default clip data matching current demo sequence', () => {
    const clip = getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, DEFAULT_MIDI_CLIP_ID);

    expect(clip.startBeat).toBe(0);
    expect(clip.lengthSteps).toBe(8);
    expect(getMidiClipLengthBeats(clip)).toBe(4);
    expect(clip.steps.map((step) => step.note)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);

    for (const step of clip.steps) {
      expect(step.enabled).toBe(true);
      expect(step.velocity).toBe(100);
      expect(step.gate).toBe(0.8);
    }
  });

  it('derives fractional beat lengths for odd step counts', () => {
    const store: MidiClipStore = {
      odd: {
        clipId: 'odd',
        startBeat: 0,
        lengthSteps: 7,
        steps: [],
      },
    };

    expect(getMidiClipLengthBeats(getMidiClipOrThrow(store, 'odd'))).toBe(3.5);
  });

  it('throws for missing clip ids', () => {
    expect(() => getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, 'missing-clip')).toThrow(
      'Missing MIDI clip for clipId "missing-clip"',
    );
  });

  it('throws for missing clip ids in an empty store', () => {
    expect(() => getMidiClipOrThrow({}, DEFAULT_MIDI_CLIP_ID)).toThrow(
      `Missing MIDI clip for clipId "${DEFAULT_MIDI_CLIP_ID}"`,
    );
  });

  it('resolves default clip source via shared clip-source contract', () => {
    const clip = resolveMidiClipSourceOrThrow(DEFAULT_MIDI_CLIP_SOURCE);

    expect(clip).toBe(DEFAULT_MIDI_CLIP_STORE[DEFAULT_MIDI_CLIP_ID]);
  });
});

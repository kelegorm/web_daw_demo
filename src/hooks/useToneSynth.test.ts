import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToneSynth } from './useToneSynth';

const mockFilter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  frequency: { value: 2000 },
};

const mockPolySynth = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  triggerAttack: vi.fn(),
  triggerRelease: vi.fn(),
  releaseAll: vi.fn(),
  set: vi.fn(),
  volume: { value: 0 },
};

vi.mock('tone', () => {
  return {
    PolySynth: vi.fn(() => mockPolySynth),
    Synth: vi.fn(),
    Filter: vi.fn(() => mockFilter),
    Frequency: vi.fn((midi: number) => ({
      toNote: () => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const name = notes[midi % 12];
        return `${name}${octave}`;
      },
    })),
    now: vi.fn(() => 0),
    getDestination: vi.fn(() => ({})),
  };
});

describe('createToneSynth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilter.frequency.value = 2000;
    mockPolySynth.volume.value = 0;
  });

  it('noteOn(60, 100) triggers attack on PolySynth', () => {
    const synth = createToneSynth();
    synth.noteOn(60, 100);
    expect(mockPolySynth.triggerAttack).toHaveBeenCalledOnce();
    const [note, , velocity] = (mockPolySynth.triggerAttack as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(note).toContain('C'); // MIDI 60 = C4
    expect(velocity).toBeCloseTo(100 / 127, 2);
  });

  it('panic() calls releaseAll() on PolySynth', () => {
    const synth = createToneSynth();
    synth.noteOn(60);
    synth.noteOn(64);
    synth.panic();
    expect(mockPolySynth.releaseAll).toHaveBeenCalledOnce();
  });

  it('setFilterCutoff(800) updates filter frequency value', () => {
    const synth = createToneSynth();
    synth.setFilterCutoff(800);
    expect(mockFilter.frequency.value).toBe(800);
  });

  it('noteOff(60) triggers release on PolySynth', () => {
    const synth = createToneSynth();
    synth.noteOn(60);
    synth.noteOff(60);
    expect(mockPolySynth.triggerRelease).toHaveBeenCalledOnce();
  });

  it('setEnabled(false) mutes synth output', () => {
    const synth = createToneSynth();
    synth.setEnabled(false);
    expect(mockPolySynth.volume.value).toBe(-Infinity);
  });

  it('setEnabled(true) restores synth volume', () => {
    const synth = createToneSynth();
    synth.setVolume(-9);
    synth.setEnabled(false);
    synth.setEnabled(true);
    expect(mockPolySynth.volume.value).toBe(-9);
  });

  it('exposes default UI parameter values', () => {
    const synth = createToneSynth();
    expect(synth.isEnabled).toBe(true);
    expect(synth.filterCutoff).toBe(2000);
    expect(synth.voiceSpread).toBe(0);
    expect(synth.volume).toBe(0);
  });

  it('updates exposed values through setters', () => {
    const synth = createToneSynth();
    synth.setFilterCutoff(1200);
    synth.setVoiceSpread(0.4);
    synth.setVolume(-6);
    synth.setEnabled(false);

    expect(synth.filterCutoff).toBe(1200);
    expect(synth.voiceSpread).toBe(0.4);
    expect(synth.volume).toBe(-6);
    expect(synth.isEnabled).toBe(false);
  });
});

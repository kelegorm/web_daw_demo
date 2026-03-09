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

  it('setEnabled(false) disconnects filter from destination', () => {
    const synth = createToneSynth();
    synth.setEnabled(false);
    expect(mockFilter.disconnect).toHaveBeenCalled();
  });

  it('setEnabled(true) reconnects filter to destination', () => {
    const synth = createToneSynth();
    // First disable then enable
    synth.setEnabled(false);
    synth.setEnabled(true);
    expect(mockFilter.connect).toHaveBeenCalled();
  });
});

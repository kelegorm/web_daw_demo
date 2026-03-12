import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSequencer, getClipLoopEnd, type SequencerClipInput } from './useSequencer';
import type { SequencerTransport } from '../engine/transportService';
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_STORE,
  getMidiClipOrThrow,
  type MidiClipStore,
} from '../project-runtime/midiClipStore';

interface SequencerStepEvent {
  enabled: boolean;
  note: number;
  velocity: number;
  gate: number;
  step: number;
}

const DEFAULT_CLIP = getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, DEFAULT_MIDI_CLIP_ID);
const DEFAULT_CLIP_STEPS = DEFAULT_CLIP.steps.slice(0, DEFAULT_CLIP.lengthSteps);
const DEFAULT_ENABLED_STEPS = DEFAULT_CLIP_STEPS.filter((step) => step.enabled);
const DEFAULT_NOTES = DEFAULT_ENABLED_STEPS.map((step) => step.note);

const { mockState } = vi.hoisted(() => ({
  mockState: {
    callback: null as ((time: number, event: SequencerStepEvent) => void) | null,
    events: [] as [string, SequencerStepEvent][],
    part: {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      loop: false,
      loopEnd: '',
    },
    transport: {
      start: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      state: 'stopped',
      loop: false,
      loopStart: 0,
      loopEnd: '0:0:0',
    },
  },
}));

vi.mock('tone', () => ({
  Part: vi.fn().mockImplementation((cb: any, events: any[]) => {
    mockState.callback = cb;
    mockState.events = events;
    return mockState.part;
  }),
  getTransport: vi.fn(() => mockState.transport),
  Time: vi.fn(() => ({ toSeconds: () => 0.25 })),
  start: vi.fn(),
}));

function createTransportMock(): SequencerTransport & {
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setLoopConfig: ReturnType<typeof vi.fn>;
} {
  return {
    start: vi.fn(() => {
      mockState.transport.start();
    }),
    pause: vi.fn(() => {
      mockState.transport.pause();
    }),
    stop: vi.fn(() => {
      mockState.transport.stop();
    }),
    setLoopConfig: vi.fn((loop: boolean, loopEnd: string) => {
      mockState.transport.loop = loop;
      mockState.transport.loopStart = 0;
      mockState.transport.loopEnd = loopEnd;
    }),
  };
}

function createClipInput(
  clipStore: MidiClipStore = DEFAULT_MIDI_CLIP_STORE,
  clipId: string = DEFAULT_MIDI_CLIP_ID,
): SequencerClipInput {
  return { clipStore, clipId };
}

describe('createSequencer (Tone.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.callback = null;
    mockState.events = [];
  });

  it('fires enabled default-clip notes in order', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();

    expect(mockState.callback).not.toBeNull();
    expect(mockState.events.length).toBe(DEFAULT_CLIP.lengthSteps);

    for (const [, event] of mockState.events) {
      mockState.callback!(0, event);
    }

    expect(noteOn.mock.calls.map((c) => c[0])).toEqual(DEFAULT_NOTES);
  });

  it('stop mid-sequence prevents further notes from firing', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();

    // Fire first event
    mockState.callback!(0, mockState.events[0][1]);
    expect(noteOn.mock.calls.length).toBe(1);

    seq.stop();

    // Fire second event after stop - should not call noteOn
    mockState.callback!(0, mockState.events[1][1]);
    expect(noteOn.mock.calls.length).toBe(1);
  });

  it('stop calls panic and resets current step', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const onStepChange = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      onStepChange,
      createClipInput(),
    );
    seq.start();

    mockState.callback!(0, mockState.events[0][1]);
    expect(seq.currentStep()).toBe(0);

    seq.stop();

    expect(panic).toHaveBeenCalledOnce();
    expect(seq.currentStep()).toBe(-1);
    expect(mockState.transport.stop).toHaveBeenCalled();
    expect(mockState.part.cancel).toHaveBeenCalledWith(0);
  });

  it('play after a single stop schedules notes again', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();
    mockState.callback!(0, mockState.events[0][1]);
    expect(noteOn).toHaveBeenCalledTimes(1);

    seq.stop();
    seq.start();

    mockState.callback!(0, mockState.events[0][1]);
    expect(noteOn).toHaveBeenCalledTimes(2);
  });

  it('pause does not call panic and preserves current step', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();

    mockState.callback!(0, mockState.events[2][1]);
    expect(seq.currentStep()).toBe(2);

    seq.pause();

    expect(panic).not.toHaveBeenCalled();
    expect(seq.currentStep()).toBe(2);
    expect(mockState.transport.pause).toHaveBeenCalled();
  });

  it('at BPM 120, noteOff is scheduled at audio-time (no wall-clock setTimeout)', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();

    // Tone.Time mock returns { toSeconds: () => 0.25 }, so noteDuration = 0.25 * 0.8 = 0.2
    const audioTime = 1.0;
    mockState.callback!(audioTime, mockState.events[0][1]);

    // noteOff should be called immediately with the future audio time, not via setTimeout
    expect(noteOff).toHaveBeenCalledOnce();
    expect(noteOff).toHaveBeenCalledWith(DEFAULT_NOTES[0], audioTime + 0.25 * 0.8);

    // noteOn should also carry the audio time
    expect(noteOn).toHaveBeenCalledWith(DEFAULT_NOTES[0], 100, audioTime);
  });

  it('noteOff is not called after stop()', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );
    seq.start();

    mockState.callback!(0, mockState.events[0][1]);
    expect(noteOn).toHaveBeenCalledTimes(1);

    seq.stop();
    noteOn.mockClear();
    noteOff.mockClear();

    // Fire a Part callback after stop — _active is false, nothing should be called
    mockState.callback!(0, mockState.events[1][1]);
    expect(noteOn).not.toHaveBeenCalled();
    expect(noteOff).not.toHaveBeenCalled();
  });

  it('setLoop toggles loop mode for part and transport', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(),
    );

    seq.setLoop(true);
    expect(mockState.part.loop).toBe(true);
    expect(mockState.transport.loop).toBe(true);
    expect(mockState.transport.loopEnd).toBe(getClipLoopEnd(DEFAULT_CLIP));

    seq.setLoop(false);
    expect(mockState.part.loop).toBe(false);
    expect(mockState.transport.loop).toBe(false);
  });

  it('resolves clip by clipId and derives events and loop end from clip shape', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const clipStore: MidiClipStore = {
      odd: {
        clipId: 'odd',
        startBeat: 0.5,
        lengthSteps: 7,
        steps: [60, 61, 62, 63, 64, 65, 66].map((note, step) => ({
          enabled: step !== 3,
          note,
          velocity: 90 + step,
          gate: 0.5,
        })),
      },
    };

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(clipStore, 'odd'),
    );

    expect(mockState.events.map(([time]) => time)).toEqual([
      '0:0:2',
      '0:1:0',
      '0:1:2',
      '0:2:0',
      '0:2:2',
      '0:3:0',
      '0:3:2',
    ]);
    expect(mockState.transport.loopEnd).toBe('0:3:2');

    seq.start();

    for (const [, event] of mockState.events) {
      mockState.callback!(1, event);
    }

    expect(noteOn.mock.calls.map((call) => call[0])).toEqual([60, 61, 62, 64, 65, 66]);
    expect(noteOn.mock.calls[0]).toEqual([60, 90, 1]);
    expect(noteOff).toHaveBeenCalledTimes(6);
    expect(noteOff.mock.calls[0][1]).toBeCloseTo(1 + 0.25 * 0.5, 6);
  });

  it('derives loop end for odd clip lengths that produce fractional beat durations', () => {
    const oddClip = {
      clipId: 'odd-loop',
      startBeat: 0,
      lengthSteps: 7,
      steps: [],
    };

    expect(getClipLoopEnd(oddClip)).toBe('0:3:2');
  });

  it('schedules noteOff using each clip step gate value', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();
    const clipStore: MidiClipStore = {
      gates: {
        clipId: 'gates',
        startBeat: 0,
        lengthSteps: 2,
        steps: [
          { enabled: true, note: 60, velocity: 100, gate: 0.25 },
          { enabled: true, note: 62, velocity: 100, gate: 1 },
        ],
      },
    };

    const seq = createSequencer(
      noteOn,
      noteOff,
      panic,
      transport,
      undefined,
      createClipInput(clipStore, 'gates'),
    );

    seq.start();
    mockState.callback!(2, mockState.events[0][1]);
    mockState.callback!(3, mockState.events[1][1]);

    expect(noteOff).toHaveBeenNthCalledWith(1, 60, 2 + 0.25 * 0.25);
    expect(noteOff).toHaveBeenNthCalledWith(2, 62, 3 + 0.25 * 1);
  });

  it('fails fast when clip lengthSteps exceeds available step data', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();
    const clipStore: MidiClipStore = {
      malformed: {
        clipId: 'malformed',
        startBeat: 0,
        lengthSteps: 2,
        steps: [{ enabled: true, note: 60, velocity: 100, gate: 0.8 }],
      },
    };

    expect(() =>
      createSequencer(
        noteOn,
        noteOff,
        panic,
        transport,
        undefined,
        createClipInput(clipStore, 'malformed'),
      ),
    ).toThrow('MIDI clip "malformed" has 1 steps, expected at least 2');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSequencer, SEQUENCER_NOTES } from './useSequencer';
import type { SequencerTransport } from '../engine/transportService';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    callback: null as ((time: number, event: { note: number; step: number }) => void) | null,
    events: [] as [string, { note: number; step: number }][],
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

describe('createSequencer (Tone.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.callback = null;
    mockState.events = [];
  });

  it('fires notes [60, 62, 64, 65, 67, 69, 71, 72] in order', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
    seq.start();

    expect(mockState.callback).not.toBeNull();
    expect(mockState.events.length).toBe(8);

    for (const [, event] of mockState.events) {
      mockState.callback!(0, event);
    }

    expect(noteOn.mock.calls.map((c) => c[0])).toEqual(SEQUENCER_NOTES);
  });

  it('stop mid-sequence prevents further notes from firing', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
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

    const seq = createSequencer(noteOn, noteOff, panic, onStepChange, transport);
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

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
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

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
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

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
    seq.start();

    // Tone.Time mock returns { toSeconds: () => 0.25 }, so noteDuration = 0.25 * 0.8 = 0.2
    const audioTime = 1.0;
    mockState.callback!(audioTime, mockState.events[0][1]);

    // noteOff should be called immediately with the future audio time, not via setTimeout
    expect(noteOff).toHaveBeenCalledOnce();
    expect(noteOff).toHaveBeenCalledWith(SEQUENCER_NOTES[0], audioTime + 0.25 * 0.8);

    // noteOn should also carry the audio time
    expect(noteOn).toHaveBeenCalledWith(SEQUENCER_NOTES[0], 100, audioTime);
  });

  it('noteOff is not called after stop()', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();
    const transport = createTransportMock();

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);
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

    const seq = createSequencer(noteOn, noteOff, panic, undefined, transport);

    seq.setLoop(true);
    expect(mockState.part.loop).toBe(true);
    expect(mockState.transport.loop).toBe(true);
    expect(mockState.transport.loopEnd).toBe('1m');

    seq.setLoop(false);
    expect(mockState.part.loop).toBe(false);
    expect(mockState.transport.loop).toBe(false);
  });
});

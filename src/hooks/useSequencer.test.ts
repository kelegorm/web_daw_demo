import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSequencer, SEQUENCER_NOTES } from './useSequencer';

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

describe('createSequencer (Tone.js)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockState.callback = null;
    mockState.events = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires notes [60, 62, 64, 65, 67, 69, 71, 72] in order', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();

    const seq = createSequencer(noteOn, noteOff, panic);
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

    const seq = createSequencer(noteOn, noteOff, panic);
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

    const seq = createSequencer(noteOn, noteOff, panic, onStepChange);
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

    const seq = createSequencer(noteOn, noteOff, panic);
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

    const seq = createSequencer(noteOn, noteOff, panic);
    seq.start();

    mockState.callback!(0, mockState.events[2][1]);
    expect(seq.currentStep()).toBe(2);

    seq.pause();

    expect(panic).not.toHaveBeenCalled();
    expect(seq.currentStep()).toBe(2);
    expect(mockState.transport.pause).toHaveBeenCalled();
  });

  it('noteOff is scheduled after 80% of 8th note duration', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const panic = vi.fn();

    const seq = createSequencer(noteOn, noteOff, panic);
    seq.start();

    mockState.callback!(0, mockState.events[0][1]);
    expect(noteOff).not.toHaveBeenCalled();

    // Time mock: 0.25s * 0.8 * 1000 = 200ms
    vi.advanceTimersByTime(200);
    expect(noteOff).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTransportCore } from './useTransportController';
import { SEQUENCER_NOTES } from './useSequencer';
import type { TransportService } from '../engine/transportService';

// ── Tone.js mock ──────────────────────────────────────────────────────────────
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
      bpm: { value: 120 },
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

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<Parameters<typeof createTransportCore>[0]> = {}) {
  let mutedState = false;
  const setTrackMuted = vi.fn((muted: boolean) => {
    mutedState = muted;
  });

  return {
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    synthPanic: vi.fn(),
    setTrackMuted,
    onStepChange: vi.fn(),
    getMutedState: () => mutedState,
    ...overrides,
  };
}

function makeTransportService(): TransportService {
  return {
    getSnapshot: vi.fn(() => ({
      isPlaying: false,
      positionSeconds: 0,
      currentStep: -1,
      bpm: mockState.transport.bpm.value,
    })),
    subscribe: vi.fn(() => vi.fn()),
    play: vi.fn(),
    start: vi.fn(() => {
      mockState.transport.start();
    }),
    pause: vi.fn(() => {
      mockState.transport.pause();
    }),
    stop: vi.fn(() => {
      mockState.transport.stop();
    }),
    setBpm: vi.fn((bpm: number) => {
      mockState.transport.bpm.value = bpm;
    }),
    setLoopConfig: vi.fn((loop: boolean, loopEnd: string) => {
      mockState.transport.loop = loop;
      mockState.transport.loopStart = 0;
      mockState.transport.loopEnd = loopEnd;
    }),
    updateCurrentStep: vi.fn(),
    dispose: vi.fn(),
  };
}

/** Fire events[i] through the Part callback (simulates Tone scheduling). */
function fireStep(i: number) {
  mockState.callback!(0, mockState.events[i][1]);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('createTransportCore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockState.callback = null;
    mockState.events = [];
    mockState.transport.bpm.value = 120;
    mockState.transport.loop = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. play → pause → play resumes from paused step
  it('pause preserves current step and does not call panic', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.play();
    fireStep(2); // advance to step 2
    expect(core.currentStep()).toBe(2);

    core.pause();

    // step should still be 2 after pause
    expect(core.currentStep()).toBe(2);
    // panic must not have been called
    expect(deps.synthPanic).not.toHaveBeenCalled();
    // transport.pause called, not stop
    expect(mockState.transport.pause).toHaveBeenCalled();
    expect(mockState.transport.stop).not.toHaveBeenCalled();
  });

  it('play → pause → play: step is preserved across pause', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.play();
    fireStep(3);
    expect(core.currentStep()).toBe(3);

    core.pause();
    expect(core.currentStep()).toBe(3); // preserved

    // resume
    core.play();
    expect(core.isPlaying()).toBe(true);
    expect(core.currentStep()).toBe(3); // still 3 until sequencer fires next event
  });

  // 2. stop triggers panic once and resets step
  it('stop resets step to -1 and calls panic exactly once', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.play();
    fireStep(4);
    expect(core.currentStep()).toBe(4);

    core.stop();

    expect(deps.synthPanic).toHaveBeenCalledOnce();
    expect(core.currentStep()).toBe(-1);
    expect(mockState.transport.stop).toHaveBeenCalled();
  });

  // 3. mute delegates to channel strip mute, unmute restores it
  it('setTrackMute(true) mutes channel strip, setTrackMute(false) unmutes it', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.setTrackMute(true);
    expect(deps.setTrackMuted).toHaveBeenCalledWith(true);
    expect(deps.getMutedState()).toBe(true);

    core.setTrackMute(false);
    expect(deps.setTrackMuted).toHaveBeenCalledWith(false);
    expect(deps.getMutedState()).toBe(false);
  });

  // 4. while muted, sequencer current step still advances
  it('while muted, sequencer step continues to advance', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.play();
    core.setTrackMute(true);

    fireStep(0);
    expect(core.currentStep()).toBe(0);
    fireStep(1);
    expect(core.currentStep()).toBe(1);
    fireStep(2);
    expect(core.currentStep()).toBe(2);

    // Channel strip mute remains active.
    expect(deps.getMutedState()).toBe(true);
  });

  // 5. track mute ON keeps channel strip muted regardless of synth/panner state
  it('track mute state is preserved independently from synth/panner enable state', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    // Simulate synth+panner both "enabled" (irrelevant to mute gate).
    core.setTrackMute(true);
    expect(deps.getMutedState()).toBe(true);
    expect(core.isTrackMuted()).toBe(true);

    // Unmute restores
    core.setTrackMute(false);
    expect(deps.getMutedState()).toBe(false);
    expect(core.isTrackMuted()).toBe(false);
  });

  // Additional: setBpm updates transport
  it('setBpm updates Tone.getTransport().bpm.value', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.setBpm(140);
    expect(mockState.transport.bpm.value).toBe(140);
    expect(transportService.setBpm).toHaveBeenCalledWith(140);
  });

  // Additional: setLoop toggles transport loop
  it('setLoop sets transport loop flag', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.setLoop(true);
    expect(mockState.part.loop).toBe(true);
    expect(mockState.transport.loop).toBe(true);

    core.setLoop(false);
    expect(mockState.part.loop).toBe(false);
    expect(mockState.transport.loop).toBe(false);
  });

  // Additional: panic calls synthPanic
  it('panic() calls synthPanic', () => {
    const deps = makeDeps();
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.panic();
    expect(deps.synthPanic).toHaveBeenCalledOnce();
  });

  it('one clip playback delivers full 8-note stream to synth sink', () => {
    const synthSink = {
      noteOn: vi.fn(),
      noteOff: vi.fn(),
      panic: vi.fn(),
    };
    const deps = makeDeps({
      noteOn: (midi, velocity, time) => synthSink.noteOn(midi, velocity, time),
      noteOff: (midi, time) => synthSink.noteOff(midi, time),
      synthPanic: () => synthSink.panic(),
    });
    const transportService = makeTransportService();
    const core = createTransportCore(deps, transportService);

    core.play();
    expect(mockState.events).toHaveLength(SEQUENCER_NOTES.length);

    for (let i = 0; i < mockState.events.length; i += 1) {
      const [, event] = mockState.events[i];
      const eventTime = i * 0.25;
      mockState.callback!(eventTime, event);
    }

    expect(synthSink.noteOn).toHaveBeenCalledTimes(SEQUENCER_NOTES.length);
    expect(synthSink.noteOff).toHaveBeenCalledTimes(SEQUENCER_NOTES.length);
    expect(synthSink.noteOn.mock.calls.map((call) => call[0])).toEqual(SEQUENCER_NOTES);
    expect(synthSink.noteOff.mock.calls.map((call) => call[0])).toEqual(SEQUENCER_NOTES);

    for (let i = 0; i < SEQUENCER_NOTES.length; i += 1) {
      const onTime = synthSink.noteOn.mock.calls[i][2];
      const offTime = synthSink.noteOff.mock.calls[i][1];
      expect(typeof onTime).toBe('number');
      expect(typeof offTime).toBe('number');
      expect(offTime).toBeCloseTo(onTime + 0.25 * 0.8, 6);
    }
  });
});

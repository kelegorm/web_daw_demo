import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LimiterGraph } from '../hooks/useLimiter';
import type { MasterStripGraph } from '../hooks/useMasterStrip';
import type { TrackStripGraph } from '../hooks/useTrackStrip';
import type { MeterSource } from './types';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockPort = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function createPort(): MockPort {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function createMockMeterSource(): MeterSource {
  return { subscribe: vi.fn(() => vi.fn()) };
}

function createMockTrackStrip(): TrackStripGraph & {
  _input: MockPort;
  _output: MockPort;
} {
  const _input = createPort();
  const _output = createPort();
  const meterSource = createMockMeterSource();
  return {
    _input,
    _output,
    get input() { return _input as unknown as GainNode; },
    get output() { return _output as unknown as GainNode; },
    get trackVolume() { return 0; },
    get isTrackMuted() { return false; },
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    meterSource,
    dispose: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Tone.getContext() to return a fake AudioContext.
// The fake context has all the factory methods used by createLimiter /
// createMasterStrip — even though those are also mocked below, this keeps
// TypeScript happy and covers any future direct context usage.
const mockDestination = createPort();

// preLimiterBus GainNode — shared so tests can reference the exact object
const mockPreLimiterBusGainNode = {
  gain: { value: 1 },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAudioContext = {
  createGain: vi.fn(() => mockPreLimiterBusGainNode),
  createAnalyser: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), fftSize: 2048 })),
  createChannelSplitter: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  createDynamicsCompressor: vi.fn(() => ({
    threshold: { value: -3 },
    knee: { value: 0 },
    ratio: { value: 20 },
    attack: { value: 0.001 },
    release: { value: 0.1 },
    reduction: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: mockDestination,
} as unknown as AudioContext;

vi.mock('tone', () => ({
  getContext: vi.fn(() => ({ rawContext: mockAudioContext })),
}));

// Shared mock instances for limiter and masterStrip — recreated in beforeEach.
let mockLimiterInput: MockPort;
let mockLimiterOutput: MockPort;
let mockLimiterMeterSource: MeterSource;
let mockLimiterGetReductionDb: ReturnType<typeof vi.fn>;
let mockLimiterGraph: LimiterGraph;

let mockMasterStripInput: MockPort;
let mockMasterStripOutput: MockPort;
let mockMasterStripMeterSource: MeterSource;
let mockMasterStripSetMasterVolume: ReturnType<typeof vi.fn>;
let mockMasterStripMasterVolume: number;
let mockMasterStripGraph: MasterStripGraph;

// Ordered list of mock strips created — cleared in beforeEach (MUTATED, not reassigned,
// so the vi.mock closure always references the same array instance).
// createdStrips[0] = default track bootstrap strip, [1] = first explicit createTrackSubgraph, etc.
const createdStrips: ReturnType<typeof createMockTrackStrip>[] = [];

function resetMocks() {
  mockLimiterInput = createPort();
  mockLimiterOutput = createPort();
  mockLimiterMeterSource = createMockMeterSource();
  mockLimiterGetReductionDb = vi.fn(() => 2.5);
  mockLimiterGraph = {
    get input() { return mockLimiterInput as unknown as AudioNode; },
    get output() { return mockLimiterOutput as unknown as AudioNode; },
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: mockLimiterGetReductionDb,
    meterSource: mockLimiterMeterSource,
    dispose: vi.fn(),
  };

  mockMasterStripInput = createPort();
  mockMasterStripOutput = createPort();
  mockMasterStripMeterSource = createMockMeterSource();
  mockMasterStripSetMasterVolume = vi.fn();
  mockMasterStripMasterVolume = -6;
  mockMasterStripGraph = {
    get input() { return mockMasterStripInput as unknown as GainNode; },
    get output() { return mockMasterStripOutput as unknown as GainNode; },
    get masterVolume() { return mockMasterStripMasterVolume; },
    setMasterVolume: mockMasterStripSetMasterVolume,
    meterSource: mockMasterStripMeterSource,
    dispose: vi.fn(),
  };

  // Clear the ordered strips list (mutate, not reassign — vi.mock closure holds this reference)
  createdStrips.length = 0;

  // Reset the preLimiterBus connect/disconnect call history
  mockPreLimiterBusGainNode.connect.mockClear();
  mockPreLimiterBusGainNode.disconnect.mockClear();
}

vi.mock('../hooks/useLimiter', () => ({
  createLimiter: vi.fn(() => mockLimiterGraph),
}));

vi.mock('../hooks/useMasterStrip', () => ({
  createMasterStrip: vi.fn(() => mockMasterStripGraph),
}));

vi.mock('../hooks/useTrackStrip', () => ({
  createTrackStrip: vi.fn(() => {
    const strip = createMockTrackStrip();
    createdStrips.push(strip);
    return strip;
  }),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import { _resetEngineForTesting, DEFAULT_TRACK_ID, getAudioEngine } from './engineSingleton';
import { createLimiter } from '../hooks/useLimiter';
import { createMasterStrip } from '../hooks/useMasterStrip';
import * as Tone from 'tone';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMocks();
  // Update vi.mock factory return values for the new mock instances
  vi.mocked(createLimiter).mockReturnValue(mockLimiterGraph);
  vi.mocked(createMasterStrip).mockReturnValue(mockMasterStripGraph);
  // Reset call counts on Tone.getContext
  vi.mocked(Tone.getContext).mockReturnValue({ rawContext: mockAudioContext } as any);
  vi.mocked(Tone.getContext).mockClear();
  // Reset AudioContext factory call counts
  mockAudioContext.createGain = vi.fn(() => mockPreLimiterBusGainNode);
  _resetEngineForTesting();
});

// ---------------------------------------------------------------------------
// Group 1: Singleton idempotency
// ---------------------------------------------------------------------------

describe('Singleton idempotency', () => {
  it('getAudioEngine() returns the same instance on repeated calls', () => {
    const first = getAudioEngine();
    const second = getAudioEngine();
    expect(first).toBe(second);
  });

  it('getAudioEngine() after _resetEngineForTesting() returns a new instance', () => {
    const first = getAudioEngine();
    _resetEngineForTesting();
    resetMocks();
    vi.mocked(createLimiter).mockReturnValue(mockLimiterGraph);
    vi.mocked(createMasterStrip).mockReturnValue(mockMasterStripGraph);
    mockAudioContext.createGain = vi.fn(() => mockPreLimiterBusGainNode);
    const second = getAudioEngine();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Group 2: StrictMode simulation
// ---------------------------------------------------------------------------

describe('StrictMode simulation', () => {
  it('simulated StrictMode double-call produces same instance', () => {
    // React StrictMode invokes effects twice synchronously in development.
    // Simulate: two rapid getAudioEngine() calls (the typical pattern in useRef + useEffect).
    vi.mocked(Tone.getContext).mockClear();

    const first = getAudioEngine();
    const second = getAudioEngine();

    expect(first).toBe(second);
    // AudioContext factory should have been accessed exactly once
    expect(Tone.getContext).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Group 3: Master chain wiring
// ---------------------------------------------------------------------------

describe('Master chain wiring', () => {
  it('preLimiterBus connects to limiter input', () => {
    getAudioEngine();
    expect(mockPreLimiterBusGainNode.connect).toHaveBeenCalledWith(mockLimiterInput);
  });

  it('limiter output connects to master strip input', () => {
    getAudioEngine();
    expect(mockLimiterOutput.connect).toHaveBeenCalledWith(mockMasterStripInput);
  });

  it('master strip output connects to destination', () => {
    getAudioEngine();
    expect(mockMasterStripOutput.connect).toHaveBeenCalledWith(mockDestination);
  });

  it('getMasterFacade() returns working facade', () => {
    const engine = getAudioEngine();
    const facade = engine.getMasterFacade();

    // setGain delegates to masterStrip.setMasterVolume
    facade.setGain(-6);
    expect(mockMasterStripSetMasterVolume).toHaveBeenCalledWith(-6);

    // getGain returns the mocked value
    expect(facade.getGain()).toBe(mockMasterStripMasterVolume);

    // meterSource is the mock
    expect(facade.meterSource).toBe(mockMasterStripMeterSource);
  });
});

// ---------------------------------------------------------------------------
// Group 4: Limiter accessors
// ---------------------------------------------------------------------------

describe('Limiter accessors', () => {
  it("getLimiterInputMeter() returns limiter's meter source", () => {
    const engine = getAudioEngine();
    expect(engine.getLimiterInputMeter()).toBe(mockLimiterMeterSource);
  });

  it('getLimiterReductionDb() delegates to limiter.getReductionDb()', () => {
    const engine = getAudioEngine();
    const result = engine.getLimiterReductionDb();
    expect(mockLimiterGetReductionDb).toHaveBeenCalled();
    expect(result).toBe(2.5);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Default track bootstrap
// ---------------------------------------------------------------------------

describe('Default track bootstrap', () => {
  it('engine starts with default track already created', () => {
    const engine = getAudioEngine();
    // Should not throw — default track exists from bootstrap
    expect(() => engine.getTrackFacade(DEFAULT_TRACK_ID)).not.toThrow();
  });

  it('DEFAULT_TRACK_ID is "track-1"', () => {
    expect(DEFAULT_TRACK_ID).toBe('track-1');
  });

  it('default track strip output is connected to preLimiterBus on bootstrap', () => {
    getAudioEngine();
    // createdStrips[0] is the default track created during bootstrap
    const defaultStrip = createdStrips[0];
    expect(defaultStrip).toBeDefined();
    expect(defaultStrip._output.connect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
  });
});

// ---------------------------------------------------------------------------
// Group 6: createTrackSubgraph
// ---------------------------------------------------------------------------

describe('createTrackSubgraph', () => {
  it('creates a new track and returns its facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    expect(facade).toBeDefined();
    // getTrackFacade should return the same facade
    expect(engine.getTrackFacade('track-2')).toBe(facade);
  });

  it('new track strip output is connected to preLimiterBus', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    // createdStrips[1] is the track-2 strip (index 0 is the default track bootstrap)
    const track2Strip = createdStrips[1];
    expect(track2Strip).toBeDefined();
    expect(track2Strip._output.connect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
  });

  it('facade.setGain delegates to strip.setTrackVolume', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    const track2Strip = createdStrips[1];
    facade.setGain(-6);
    expect(track2Strip.setTrackVolume).toHaveBeenCalledWith(-6);
  });

  it('facade.setMute delegates to strip.setTrackMuted', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    const track2Strip = createdStrips[1];
    facade.setMute(true);
    expect(track2Strip.setTrackMuted).toHaveBeenCalledWith(true);
  });

  it('facade.getGain returns strip.trackVolume', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    // mock returns 0 for trackVolume
    expect(facade.getGain()).toBe(0);
  });

  it('facade.isMuted returns strip.isTrackMuted', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    // mock returns false for isTrackMuted
    expect(facade.isMuted()).toBe(false);
  });

  it('facade.meterSource returns strip.meterSource', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    const track2Strip = createdStrips[1];
    expect(facade.meterSource).toBe(track2Strip.meterSource);
  });

  it('throws when creating track with duplicate id', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    expect(() => engine.createTrackSubgraph('track-2')).toThrow(
      '[engine] track already exists: track-2',
    );
  });
});

// ---------------------------------------------------------------------------
// Group 7: removeTrackSubgraph
// ---------------------------------------------------------------------------

describe('removeTrackSubgraph', () => {
  it('removes track and disconnects strip output from preLimiterBus', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    const track2Strip = createdStrips[1];

    engine.removeTrackSubgraph('track-2');

    expect(track2Strip._output.disconnect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
    expect(track2Strip.dispose).toHaveBeenCalled();
  });

  it('getTrackFacade throws after removal', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => engine.getTrackFacade('track-2')).toThrow('[engine] unknown track: track-2');
  });

  it('throws when removing unknown track', () => {
    const engine = getAudioEngine();
    expect(() => engine.removeTrackSubgraph('nonexistent')).toThrow(
      '[engine] unknown track: nonexistent',
    );
  });

  it('disconnect is called before dispose', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    const track2Strip = createdStrips[1];

    // Track call order: disconnect must come before dispose
    const callOrder: string[] = [];
    track2Strip._output.disconnect.mockImplementation(() => { callOrder.push('disconnect'); });
    vi.mocked(track2Strip.dispose).mockImplementation(() => { callOrder.push('dispose'); });

    engine.removeTrackSubgraph('track-2');

    expect(callOrder).toEqual(['disconnect', 'dispose']);
  });
});

// ---------------------------------------------------------------------------
// Group 8: TrackFacade dispose guard
// ---------------------------------------------------------------------------

describe('TrackFacade dispose guard', () => {
  it('setGain throws on disposed facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => facade.setGain(-6)).toThrow('[TrackFacade] method called on disposed facade');
  });

  it('setMute throws on disposed facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => facade.setMute(true)).toThrow('[TrackFacade] method called on disposed facade');
  });

  it('getGain throws on disposed facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => facade.getGain()).toThrow('[TrackFacade] method called on disposed facade');
  });

  it('isMuted throws on disposed facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => facade.isMuted()).toThrow('[TrackFacade] method called on disposed facade');
  });

  it('meterSource access throws on disposed facade', () => {
    const engine = getAudioEngine();
    const facade = engine.createTrackSubgraph('track-2');
    engine.removeTrackSubgraph('track-2');
    expect(() => facade.meterSource).toThrow('[TrackFacade] method called on disposed facade');
  });
});

// ---------------------------------------------------------------------------
// Group 9: Multiple tracks
// ---------------------------------------------------------------------------

describe('Multiple tracks', () => {
  it('can create and access multiple tracks simultaneously', () => {
    const engine = getAudioEngine();
    const f2 = engine.createTrackSubgraph('track-2');
    const f3 = engine.createTrackSubgraph('track-3');
    const f4 = engine.createTrackSubgraph('track-4');

    expect(engine.getTrackFacade('track-2')).toBe(f2);
    expect(engine.getTrackFacade('track-3')).toBe(f3);
    expect(engine.getTrackFacade('track-4')).toBe(f4);

    // createdStrips[0] = default, [1] = track-2, [2] = track-3, [3] = track-4
    expect(createdStrips[1]._output.connect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
    expect(createdStrips[2]._output.connect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
    expect(createdStrips[3]._output.connect).toHaveBeenCalledWith(mockPreLimiterBusGainNode);
  });

  it('removing one track does not affect others', () => {
    const engine = getAudioEngine();
    engine.createTrackSubgraph('track-2');
    const f3 = engine.createTrackSubgraph('track-3');

    engine.removeTrackSubgraph('track-2');

    // track-3 facade should still be accessible and usable
    expect(() => f3.setGain(-3)).not.toThrow();
    expect(engine.getTrackFacade('track-3')).toBe(f3);
  });
});

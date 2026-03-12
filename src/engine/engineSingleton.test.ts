import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LimiterGraph } from '../hooks/useLimiter';
import type { MasterStripGraph } from '../hooks/useMasterStrip';
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Tone.getContext() to return a fake AudioContext.
// The fake context has all the factory methods used by createLimiter /
// createMasterStrip — even though those are also mocked below, this keeps
// TypeScript happy and covers any future direct context usage.
const mockDestination = createPort();

const mockAudioContext = {
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
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
}

vi.mock('../hooks/useLimiter', () => ({
  createLimiter: vi.fn(() => mockLimiterGraph),
}));

vi.mock('../hooks/useMasterStrip', () => ({
  createMasterStrip: vi.fn(() => mockMasterStripGraph),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import { _resetEngineForTesting, getAudioEngine } from './engineSingleton';
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
  mockAudioContext.createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
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
    // createGain is called for preLimiterBus; its connect should have been called with limiterInput
    const gainNodes = vi.mocked(mockAudioContext.createGain).mock.results;
    // Find the preLimiterBus — first GainNode created
    const preLimiterBus = gainNodes[0]?.value;
    expect(preLimiterBus).toBeDefined();
    expect(preLimiterBus.connect).toHaveBeenCalledWith(mockLimiterInput);
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
// Group 5: Track API stubs
// ---------------------------------------------------------------------------

describe('Track API stubs', () => {
  it('getTrackFacade() throws before Plan 01-02', () => {
    const engine = getAudioEngine();
    expect(() => engine.getTrackFacade('track-1')).toThrow(
      '[engine] track API not yet implemented — see Plan 01-02',
    );
  });

  it('createTrackSubgraph() throws before Plan 01-02', () => {
    const engine = getAudioEngine();
    expect(() => engine.createTrackSubgraph('track-1')).toThrow(
      '[engine] track API not yet implemented — see Plan 01-02',
    );
  });

  it('removeTrackSubgraph() throws before Plan 01-02', () => {
    const engine = getAudioEngine();
    expect(() => engine.removeTrackSubgraph('track-1')).toThrow(
      '[engine] track API not yet implemented — see Plan 01-02',
    );
  });
});

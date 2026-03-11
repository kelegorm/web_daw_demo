import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMasterStrip } from './useMasterStrip';

const mockInputGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockMasterGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockOutputGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

function makeAnalyser() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 256,
    getByteTimeDomainData: vi.fn(),
  };
}

const mockMasterAnalyser = makeAnalyser();
const mockMasterAnalyserL = makeAnalyser();
const mockMasterAnalyserR = makeAnalyser();

const mockChannelSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

let gainCallCount = 0;
let analyserCallCount = 0;

const gainMocks = [mockInputGain, mockMasterGainNode, mockOutputGain];
const analyserMocks = [mockMasterAnalyser, mockMasterAnalyserL, mockMasterAnalyserR];

const mockAudioContext = {
  createGain: vi.fn(() => gainMocks[gainCallCount++ % gainMocks.length]),
  createAnalyser: vi.fn(() => analyserMocks[analyserCallCount++ % analyserMocks.length]),
  createChannelSplitter: vi.fn(() => mockChannelSplitter),
};

vi.mock('tone', () => ({
  getContext: vi.fn(() => ({
    rawContext: mockAudioContext,
  })),
}));

vi.mock('../engine/meterSource', () => ({
  createMeterSource: vi.fn(() => ({ subscribe: vi.fn(() => vi.fn()) })),
}));

describe('createMasterStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gainCallCount = 0;
    analyserCallCount = 0;
    mockMasterGainNode.gain.value = 1;
  });

  it('exposes default master volume', () => {
    const strip = createMasterStrip();
    expect(strip.masterVolume).toBe(0);
  });

  it('setMasterVolume stores current master volume and writes gain', () => {
    const strip = createMasterStrip();
    strip.setMasterVolume(-6);

    expect(strip.masterVolume).toBe(-6);
    expect(mockMasterGainNode.gain.value).toBeCloseTo(Math.pow(10, -6 / 20), 6);
  });

  it('output property returns output gain node', () => {
    const strip = createMasterStrip();
    expect(strip.output).toBe(mockOutputGain);
  });

  it('exposes a meterSource', () => {
    const strip = createMasterStrip();
    expect(strip.meterSource).toBeDefined();
    expect(typeof strip.meterSource.subscribe).toBe('function');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTrackStrip } from './useTrackStrip';

const mockInputGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockTrackGainNode = {
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

const mockTrackAnalyser = makeAnalyser();
const mockTrackAnalyserL = makeAnalyser();
const mockTrackAnalyserR = makeAnalyser();

const mockChannelSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

let gainCallCount = 0;
let analyserCallCount = 0;

const gainMocks = [mockInputGain, mockTrackGainNode, mockOutputGain];
const analyserMocks = [mockTrackAnalyser, mockTrackAnalyserL, mockTrackAnalyserR];

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

describe('createTrackStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gainCallCount = 0;
    analyserCallCount = 0;
    mockTrackGainNode.gain.value = 1;
  });

  it('exposes default track volume and mute state', () => {
    const strip = createTrackStrip();
    expect(strip.trackVolume).toBe(0);
    expect(strip.isTrackMuted).toBe(false);
  });

  it('setTrackVolume stores current track volume and writes gain', () => {
    const strip = createTrackStrip();
    strip.setTrackVolume(-12);

    expect(strip.trackVolume).toBe(-12);
    expect(mockTrackGainNode.gain.value).toBeCloseTo(Math.pow(10, -12 / 20), 6);
  });

  it('setTrackMuted(true) silences track gain and unmute restores previous track volume', () => {
    const strip = createTrackStrip();
    strip.setTrackVolume(-6);
    const beforeMute = mockTrackGainNode.gain.value;

    strip.setTrackMuted(true);
    expect(strip.isTrackMuted).toBe(true);
    expect(mockTrackGainNode.gain.value).toBe(0);

    strip.setTrackMuted(false);
    expect(strip.isTrackMuted).toBe(false);
    expect(mockTrackGainNode.gain.value).toBeCloseTo(beforeMute, 6);
  });

  it('getOutputNode returns output gain node', () => {
    const strip = createTrackStrip();
    expect(strip.getOutputNode()).toBe(mockOutputGain);
  });

  it('exposes stereo analyser taps', () => {
    const strip = createTrackStrip();
    expect(strip.getAnalyserNodeL()).toBe(mockTrackAnalyserL);
    expect(strip.getAnalyserNodeR()).toBe(mockTrackAnalyserR);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPanner } from './usePanner';

const mockPannerNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  pan: { value: 0 },
};

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

const mockMixerNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockMasterGainNode = {
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
const mockMasterAnalyser = makeAnalyser();
const mockMasterAnalyserL = makeAnalyser();
const mockMasterAnalyserR = makeAnalyser();

const mockChannelSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockMasterChannelSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

let gainCallCount = 0;
let analyserCallCount = 0;
let splitterCallCount = 0;

const gainMocks = [mockInputGain, mockTrackGainNode, mockMixerNode, mockMasterGainNode];
const analyserMocks = [
  mockTrackAnalyser,
  mockTrackAnalyserL,
  mockTrackAnalyserR,
  mockMasterAnalyser,
  mockMasterAnalyserL,
  mockMasterAnalyserR,
];
const splitterMocks = [mockChannelSplitter, mockMasterChannelSplitter];

const mockAudioContext = {
  createStereoPanner: vi.fn(() => mockPannerNode),
  createGain: vi.fn(() => gainMocks[gainCallCount++ % gainMocks.length]),
  createAnalyser: vi.fn(() => analyserMocks[analyserCallCount++ % analyserMocks.length]),
  createChannelSplitter: vi.fn(() => splitterMocks[splitterCallCount++ % splitterMocks.length]),
  destination: {},
};

vi.mock('tone', () => ({
  getContext: vi.fn(() => ({
    rawContext: mockAudioContext,
  })),
}));

describe('createPanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gainCallCount = 0;
    analyserCallCount = 0;
    splitterCallCount = 0;
    mockPannerNode.pan.value = 0;
    mockTrackGainNode.gain.value = 1;
    mockMasterGainNode.gain.value = 1;
  });

  it('setPan(-1) sets pannerNode.pan.value to -1', () => {
    const panner = createPanner();
    panner.setPan(-1);
    expect(mockPannerNode.pan.value).toBe(-1);
  });

  it('setPan clamps values to -1..1 range', () => {
    const panner = createPanner();
    panner.setPan(-2);
    expect(mockPannerNode.pan.value).toBe(-1);
    expect(panner.pan).toBe(-1);
    panner.setPan(2);
    expect(mockPannerNode.pan.value).toBe(1);
    expect(panner.pan).toBe(1);
  });

  it('exposes default pan, track and master volumes', () => {
    const panner = createPanner();
    expect(panner.pan).toBe(0);
    expect(panner.trackVolume).toBe(0);
    expect(panner.masterVolume).toBe(0);
  });

  it('setTrackVolume stores current track volume and writes gain', () => {
    const panner = createPanner();
    panner.setTrackVolume(-12);
    expect(panner.trackVolume).toBe(-12);
    expect(mockTrackGainNode.gain.value).toBeCloseTo(Math.pow(10, -12 / 20), 6);
  });

  it('setMasterVolume stores current master volume and writes gain', () => {
    const panner = createPanner();
    panner.setMasterVolume(-6);
    expect(panner.masterVolume).toBe(-6);
    expect(mockMasterGainNode.gain.value).toBeCloseTo(Math.pow(10, -6 / 20), 6);
  });

  it('setTrackMuted(true) silences track gain and unmute restores previous track volume', () => {
    const panner = createPanner();
    panner.setTrackVolume(-6);
    const beforeMute = mockTrackGainNode.gain.value;

    panner.setTrackMuted(true);
    expect(mockTrackGainNode.gain.value).toBe(0);

    panner.setTrackMuted(false);
    expect(mockTrackGainNode.gain.value).toBeCloseTo(beforeMute, 6);
  });

  it('isEnabled is true by default', () => {
    const panner = createPanner();
    expect(panner.isEnabled).toBe(true);
  });

  it('setEnabled(false) disconnects panner stage and bypasses input to track gain', () => {
    const panner = createPanner();
    panner.setEnabled(false);
    expect(panner.isEnabled).toBe(false);
    expect(mockInputGain.disconnect).toHaveBeenCalledWith(mockPannerNode);
    expect(mockInputGain.connect).toHaveBeenCalledWith(mockTrackGainNode);
  });

  it('setEnabled(true) after disable restores panner stage', () => {
    const panner = createPanner();
    panner.setEnabled(false);
    vi.clearAllMocks();
    panner.setEnabled(true);
    expect(panner.isEnabled).toBe(true);
    expect(mockInputGain.disconnect).toHaveBeenCalledWith(mockTrackGainNode);
    expect(mockInputGain.connect).toHaveBeenCalledWith(mockPannerNode);
  });

  it('getPannerNode returns the StereoPannerNode', () => {
    const panner = createPanner();
    expect(panner.getPannerNode()).toBe(mockPannerNode);
  });

  it('getGainNode/getTrackGainNode returns track gain node', () => {
    const panner = createPanner();
    expect(panner.getGainNode()).toBe(mockTrackGainNode);
    expect(panner.getTrackGainNode()).toBe(mockTrackGainNode);
  });

  it('getMixerNode returns mixer bus gain node', () => {
    const panner = createPanner();
    expect(panner.getMixerNode()).toBe(mockMixerNode);
  });

  it('getAnalyserNode returns track analyser node', () => {
    const panner = createPanner();
    expect(panner.getAnalyserNode()).toBe(mockTrackAnalyser);
  });

  it('getMasterAnalyserNode returns master analyser node', () => {
    const panner = createPanner();
    expect(panner.getMasterAnalyserNode()).toBe(mockMasterAnalyser);
  });
});

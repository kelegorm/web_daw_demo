import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPanner } from './usePanner';

const mockPannerNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  pan: { value: 0 },
};

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockInputGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockAudioContext = {
  createStereoPanner: vi.fn(() => mockPannerNode),
  createGain: vi.fn(() => mockGainNode),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  destination: {},
};

// createGain is called twice: once for inputGain, once for gainNode (mute)
// We track which call returns which mock
let gainCallCount = 0;
const gainMocks = [mockInputGain, mockGainNode];

vi.mock('tone', () => ({
  getContext: vi.fn(() => ({
    rawContext: mockAudioContext,
  })),
}));

describe('createPanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPannerNode.pan.value = 0;
    gainCallCount = 0;
    mockAudioContext.createGain.mockImplementation(() => {
      const mock = gainMocks[gainCallCount % 2];
      gainCallCount++;
      return mock;
    });
  });

  it('setPan(-1) sets pannerNode.pan.value to -1', () => {
    const panner = createPanner();
    panner.setPan(-1);
    expect(mockPannerNode.pan.value).toBe(-1);
  });

  it('setPan(0.5) sets pannerNode.pan.value to 0.5', () => {
    const panner = createPanner();
    panner.setPan(0.5);
    expect(mockPannerNode.pan.value).toBe(0.5);
  });

  it('setPan clamps values to -1..1 range', () => {
    const panner = createPanner();
    panner.setPan(-2);
    expect(mockPannerNode.pan.value).toBe(-1);
    panner.setPan(2);
    expect(mockPannerNode.pan.value).toBe(1);
  });

  it('isEnabled is true by default', () => {
    const panner = createPanner();
    expect(panner.isEnabled).toBe(true);
  });

  it('setEnabled(false) disconnects panner from chain', () => {
    const panner = createPanner();
    panner.setEnabled(false);
    expect(panner.isEnabled).toBe(false);
    expect(mockInputGain.disconnect).toHaveBeenCalled();
  });

  it('setEnabled(true) after disable reconnects panner', () => {
    const panner = createPanner();
    panner.setEnabled(false);
    vi.clearAllMocks();
    panner.setEnabled(true);
    expect(panner.isEnabled).toBe(true);
    expect(mockInputGain.connect).toHaveBeenCalled();
  });

  it('getPannerNode returns the StereoPannerNode', () => {
    const panner = createPanner();
    expect(panner.getPannerNode()).toBe(mockPannerNode);
  });

  it('getGainNode returns the GainNode', () => {
    const panner = createPanner();
    expect(panner.getGainNode()).toBe(mockGainNode);
  });

  it('getAnalyserNode returns the AnalyserNode', () => {
    const panner = createPanner();
    expect(panner.getAnalyserNode()).toBe(mockAnalyserNode);
  });
});

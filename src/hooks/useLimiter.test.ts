import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLimiter } from './useLimiter';

vi.mock('tone', () => ({
  getContext: vi.fn(),
}));

const mockCompressor = {
  threshold: { value: -3 },
  knee: { value: 0 },
  ratio: { value: 20 },
  attack: { value: 0.001 },
  release: { value: 0.1 },
  reduction: 0,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

function createMockAnalyser() {
  return {
    fftSize: 256,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  };
}

const mockInputAnalyserL = createMockAnalyser();
const mockInputAnalyserR = createMockAnalyser();
const mockInputSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const mockInputNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const mockOutputNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAudioContext = {
  createDynamicsCompressor: vi.fn(() => mockCompressor),
  createAnalyser: vi.fn(() => createMockAnalyser()),
  createChannelSplitter: vi.fn(() => mockInputSplitter),
  createGain: vi.fn(() => mockInputNode),
  destination: {},
};

describe('createLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompressor.threshold.value = -3;
    mockCompressor.reduction = 0;

    mockAudioContext.createGain
      .mockReturnValueOnce(mockInputNode)
      .mockReturnValueOnce(mockOutputNode);

    mockAudioContext.createDynamicsCompressor.mockReturnValue(mockCompressor);
    mockAudioContext.createChannelSplitter.mockReturnValue(mockInputSplitter);
    mockAudioContext.createAnalyser
      .mockReturnValueOnce(mockInputAnalyserL)
      .mockReturnValueOnce(mockInputAnalyserR);
  });

  it('isEnabled is true by default', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.isEnabled).toBe(true);
  });

  it('threshold is -3 by default', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.threshold).toBe(-3);
  });

  it('setThreshold(-6) sets compressor.threshold.value to -6', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    limiter.setThreshold(-6);
    expect(mockCompressor.threshold.value).toBe(-6);
  });

  it('setThreshold updates the exposed threshold value', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    limiter.setThreshold(-12);
    expect(limiter.threshold).toBe(-12);
  });

  it('setEnabled(false) bypasses limiter internally', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    vi.clearAllMocks();

    limiter.setEnabled(false);

    expect(limiter.isEnabled).toBe(false);
    expect(mockInputNode.disconnect).toHaveBeenCalledWith(mockCompressor);
    expect(mockCompressor.disconnect).toHaveBeenCalledWith(mockOutputNode);
    expect(mockInputNode.connect).toHaveBeenCalledWith(mockOutputNode);
  });

  it('setEnabled(true) after disable restores limiter chain internally', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    limiter.setEnabled(false);
    vi.clearAllMocks();

    limiter.setEnabled(true);

    expect(limiter.isEnabled).toBe(true);
    expect(mockInputNode.disconnect).toHaveBeenCalledWith(mockOutputNode);
    expect(mockInputNode.connect).toHaveBeenCalledWith(mockCompressor);
    expect(mockCompressor.connect).toHaveBeenCalledWith(mockOutputNode);
  });

  it('getLimiterNode returns the compressor node', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getLimiterNode()).toBe(mockCompressor);
  });

  it('getInputNode/getOutputNode return limiter module ports', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getInputNode()).toBe(mockInputNode);
    expect(limiter.getOutputNode()).toBe(mockOutputNode);
  });

  it('exposes input analyser nodes for stereo input metering', () => {
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);

    expect(limiter.getInputAnalyserNodeL()).toBe(mockInputAnalyserL);
    expect(limiter.getInputAnalyserNodeR()).toBe(mockInputAnalyserR);
  });

  it('getReductionDb returns positive dB from compressor.reduction', () => {
    mockCompressor.reduction = -6;
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getReductionDb()).toBe(6);
  });

  it('getReductionDb returns 0 when reduction is 0', () => {
    mockCompressor.reduction = 0;
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getReductionDb()).toBe(0);
  });

  it('getReductionDb applies epsilon to suppress tiny jitter', () => {
    mockCompressor.reduction = -0.03;
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getReductionDb()).toBe(0);
  });

  it('getReductionDb is not capped for strong attenuation', () => {
    mockCompressor.reduction = -40;
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getReductionDb()).toBe(40);
  });

  it('getReductionDb returns 0 for non-finite compressor reduction', () => {
    mockCompressor.reduction = Number.NaN;
    const limiter = createLimiter(mockAudioContext as unknown as AudioContext);
    expect(limiter.getReductionDb()).toBe(0);
  });
});

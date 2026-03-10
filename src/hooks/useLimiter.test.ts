import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLimiter } from './useLimiter';

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

function createMockAnalyser(sampleValue: number) {
  return {
    fftSize: 256,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn((buffer: Float32Array) => {
      buffer.fill(sampleValue);
    }),
  };
}

let mockInputAnalyserL = createMockAnalyser(0);
let mockInputAnalyserR = createMockAnalyser(0);
const mockInputSplitter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const mockMeterSinkGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockAudioContext = {
  createDynamicsCompressor: vi.fn(() => mockCompressor),
  createAnalyser: vi.fn(() => createMockAnalyser(0)),
  createChannelSplitter: vi.fn(() => mockInputSplitter),
  createGain: vi.fn(() => mockMeterSinkGain),
  destination: {},
};

const mockMasterGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: mockAudioContext,
};

const mockMasterAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: mockAudioContext,
};

describe('createLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompressor.threshold.value = -3;
    mockCompressor.reduction = 0;
    mockInputAnalyserL = createMockAnalyser(0);
    mockInputAnalyserR = createMockAnalyser(0);
    mockMeterSinkGain.gain.value = 1;
    mockAudioContext.createDynamicsCompressor.mockReturnValue(mockCompressor);
    mockAudioContext.createChannelSplitter.mockReturnValue(mockInputSplitter);
    mockAudioContext.createAnalyser
      .mockReturnValueOnce(mockInputAnalyserL)
      .mockReturnValueOnce(mockInputAnalyserR);
    mockAudioContext.createGain.mockReturnValue(mockMeterSinkGain);
  });

  it('isEnabled is true by default', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.isEnabled).toBe(true);
  });

  it('threshold is -3 by default', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.threshold).toBe(-3);
  });

  it('setThreshold(-6) sets compressor.threshold.value to -6', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    limiter.setThreshold(-6);
    expect(mockCompressor.threshold.value).toBe(-6);
  });

  it('setThreshold updates the exposed threshold value', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    limiter.setThreshold(-12);
    expect(limiter.threshold).toBe(-12);
  });

  it('setEnabled(false) removes limiter from chain, masterGain connects directly to masterAnalyser', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    vi.clearAllMocks();
    limiter.setEnabled(false);
    expect(limiter.isEnabled).toBe(false);
    expect(mockMasterGainNode.disconnect).toHaveBeenCalledWith(mockCompressor);
    expect(mockCompressor.disconnect).toHaveBeenCalledWith(mockMasterAnalyserNode);
    expect(mockMasterGainNode.connect).toHaveBeenCalledWith(mockMasterAnalyserNode);
  });

  it('setEnabled(true) after disable restores limiter in chain', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    limiter.setEnabled(false);
    vi.clearAllMocks();
    limiter.setEnabled(true);
    expect(limiter.isEnabled).toBe(true);
    expect(mockMasterGainNode.disconnect).toHaveBeenCalledWith(mockMasterAnalyserNode);
    expect(mockMasterGainNode.connect).toHaveBeenCalledWith(mockCompressor);
    expect(mockCompressor.connect).toHaveBeenCalledWith(mockMasterAnalyserNode);
  });

  it('getLimiterNode returns the compressor node', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getLimiterNode()).toBe(mockCompressor);
  });

  it('exposes input analyser nodes for stereo input metering', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );

    expect(limiter.getInputAnalyserNodeL()).toBe(mockInputAnalyserL);
    expect(limiter.getInputAnalyserNodeR()).toBe(mockInputAnalyserR);
  });

  it('getReductionDb returns positive dB from compressor.reduction', () => {
    mockCompressor.reduction = -6;
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(6);
  });

  it('getReductionDb returns 0 when reduction is 0', () => {
    mockCompressor.reduction = 0;
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(0);
  });

  it('getReductionDb applies epsilon to suppress tiny jitter', () => {
    mockCompressor.reduction = -0.03;
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(0);
  });

  it('getReductionDb is not capped for strong attenuation', () => {
    mockCompressor.reduction = -40;
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(40);
  });

  it('getReductionDb returns 0 for non-finite compressor reduction', () => {
    mockCompressor.reduction = Number.NaN;
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(0);
  });
});

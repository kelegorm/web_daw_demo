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

let mockPreAnalyser = createMockAnalyser(0);
let mockPostAnalyser = createMockAnalyser(0);
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
    mockPreAnalyser = createMockAnalyser(0);
    mockPostAnalyser = createMockAnalyser(0);
    mockInputAnalyserL = createMockAnalyser(0);
    mockInputAnalyserR = createMockAnalyser(0);
    mockMeterSinkGain.gain.value = 1;
    mockAudioContext.createDynamicsCompressor.mockReturnValue(mockCompressor);
    mockAudioContext.createChannelSplitter.mockReturnValue(mockInputSplitter);
    mockAudioContext.createAnalyser
      .mockReturnValueOnce(mockPreAnalyser)
      .mockReturnValueOnce(mockPostAnalyser)
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
    expect(mockMasterGainNode.disconnect).toHaveBeenCalledWith(mockPreAnalyser);
    expect(mockPostAnalyser.disconnect).toHaveBeenCalledWith(mockMasterAnalyserNode);
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
    expect(mockMasterGainNode.connect).toHaveBeenCalledWith(mockPreAnalyser);
    expect(mockPostAnalyser.connect).toHaveBeenCalledWith(mockMasterAnalyserNode);
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

  it('getReductionDb returns reduction in dB when output is quieter', () => {
    mockPreAnalyser = createMockAnalyser(1.0);
    mockPostAnalyser = createMockAnalyser(0.2);
    mockAudioContext.createAnalyser
      .mockReset()
      .mockReturnValueOnce(mockPreAnalyser)
      .mockReturnValueOnce(mockPostAnalyser)
      .mockReturnValueOnce(createMockAnalyser(0))
      .mockReturnValueOnce(createMockAnalyser(0));

    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    const gr = limiter.getReductionDb();
    expect(gr).toBeGreaterThan(13.9);
    expect(gr).toBeLessThan(14.1);
  });

  it('getReductionDb returns 0 when output is not quieter', () => {
    mockPreAnalyser = createMockAnalyser(0.1);
    mockPostAnalyser = createMockAnalyser(0.3);
    mockAudioContext.createAnalyser
      .mockReset()
      .mockReturnValueOnce(mockPreAnalyser)
      .mockReturnValueOnce(mockPostAnalyser)
      .mockReturnValueOnce(createMockAnalyser(0))
      .mockReturnValueOnce(createMockAnalyser(0));

    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getReductionDb()).toBe(0);
  });

  it('getReductionDb is not capped for very strong attenuation', () => {
    mockPreAnalyser = createMockAnalyser(1.0);   // 0 dBFS input peak
    mockPostAnalyser = createMockAnalyser(0.01); // unrealistic huge drop
    mockAudioContext.createAnalyser
      .mockReset()
      .mockReturnValueOnce(mockPreAnalyser)
      .mockReturnValueOnce(mockPostAnalyser)
      .mockReturnValueOnce(createMockAnalyser(0))
      .mockReturnValueOnce(createMockAnalyser(0));

    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    const gr = limiter.getReductionDb();
    expect(gr).toBeGreaterThan(39.9);
    expect(gr).toBeLessThan(40.1);
  });
});

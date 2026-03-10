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

const mockAudioContext = {
  createDynamicsCompressor: vi.fn(() => mockCompressor),
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
    mockAudioContext.createDynamicsCompressor.mockReturnValue(mockCompressor);
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
  });

  it('getLimiterNode returns the compressor node', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getLimiterNode()).toBe(mockCompressor);
  });
});

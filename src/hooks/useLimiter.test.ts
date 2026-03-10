import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLimiter } from './useLimiter';

const mockLimiterInput = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockLimiterOutput = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockLimiterNode = {
  threshold: { value: -3 },
  input: mockLimiterInput,
  output: mockLimiterOutput,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('tone', () => ({
  Limiter: vi.fn(() => mockLimiterNode),
}));

const mockMasterGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockMasterAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

describe('createLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimiterNode.threshold.value = -3;
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

  it('setThreshold(-6) sets limiterNode.threshold.value to -6', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    limiter.setThreshold(-6);
    expect(mockLimiterNode.threshold.value).toBe(-6);
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
    expect(mockMasterGainNode.disconnect).toHaveBeenCalledWith(mockLimiterInput);
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
    expect(mockMasterGainNode.connect).toHaveBeenCalledWith(mockLimiterInput);
  });

  it('getLimiterNode returns the Tone.Limiter instance', () => {
    const limiter = createLimiter(
      mockMasterGainNode as unknown as AudioNode,
      mockMasterAnalyserNode as unknown as AudioNode,
    );
    expect(limiter.getLimiterNode()).toBe(mockLimiterNode);
  });
});

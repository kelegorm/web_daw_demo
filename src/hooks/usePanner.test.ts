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

const mockOutputGain = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

let gainCallCount = 0;
const gainMocks = [mockInputGain, mockOutputGain];

const mockAudioContext = {
  createStereoPanner: vi.fn(() => mockPannerNode),
  createGain: vi.fn(() => gainMocks[gainCallCount++ % gainMocks.length]),
  destination: {},
};

vi.mock('tone', () => ({
  getContext: vi.fn(() => ({
    rawContext: mockAudioContext,
  })),
}));

describe('createPanner (pan-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gainCallCount = 0;
    mockPannerNode.pan.value = 0;
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

  it('isEnabled is true by default', () => {
    const panner = createPanner();
    expect(panner.isEnabled).toBe(true);
    expect(panner.pan).toBe(0);
  });

  it('setEnabled(false) disconnects panner stage and bypasses input to output', () => {
    const panner = createPanner();
    panner.setEnabled(false);

    expect(panner.isEnabled).toBe(false);
    expect(mockInputGain.disconnect).toHaveBeenCalledWith(mockPannerNode);
    expect(mockInputGain.connect).toHaveBeenCalledWith(mockOutputGain);
  });

  it('setEnabled(true) after disable restores panner stage', () => {
    const panner = createPanner();
    panner.setEnabled(false);
    vi.clearAllMocks();

    panner.setEnabled(true);

    expect(panner.isEnabled).toBe(true);
    expect(mockInputGain.disconnect).toHaveBeenCalledWith(mockOutputGain);
    expect(mockInputGain.connect).toHaveBeenCalledWith(mockPannerNode);
  });

  it('output property returns output gain node', () => {
    const panner = createPanner();
    expect(panner.output).toBe(mockOutputGain);
  });

  it('input property returns input gain node', () => {
    const panner = createPanner();
    expect(panner.input).toBe(mockInputGain);
  });
});

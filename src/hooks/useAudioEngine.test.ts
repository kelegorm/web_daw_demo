import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAudioEngine } from './useAudioEngine';

let mockPostMessage: ReturnType<typeof vi.fn>;
let mockSetValueAtTime: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllGlobals();

  mockPostMessage = vi.fn();
  mockSetValueAtTime = vi.fn();

  const makeParam = () => ({ setValueAtTime: mockSetValueAtTime, value: 0 });
  const mockParameters = new Map([
    ['filterCutoff', makeParam()],
    ['voiceSpread', makeParam()],
    ['reverbMix', makeParam()],
  ]);

  const mockWorkletNode = {
    port: { postMessage: mockPostMessage, onmessage: null },
    parameters: mockParameters,
    connect: vi.fn(),
  };

  vi.stubGlobal('AudioWorkletNode', vi.fn(() => mockWorkletNode));

  vi.stubGlobal(
    'AudioContext',
    vi.fn(() => ({
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      createAnalyser: vi.fn(() => ({ connect: vi.fn() })),
      destination: {},
    })),
  );

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    }),
  );
});

describe('createAudioEngine', () => {
  it('noteOn sends { type: "noteOn", note } to worklet port', async () => {
    const engine = createAudioEngine();
    await engine.initAudio();

    engine.noteOn(60);

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'noteOn', note: 60 });
  });

  it('setParam sets correct AudioParam value via setValueAtTime', async () => {
    const engine = createAudioEngine();
    await engine.initAudio();

    engine.setParam('filterCutoff', 1000);

    expect(mockSetValueAtTime).toHaveBeenCalledWith(1000, 0);
  });

  it('panic sends { type: "panic" } to worklet port', async () => {
    const engine = createAudioEngine();
    await engine.initAudio();

    engine.panic();

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'panic' });
  });
});

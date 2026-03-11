import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMeterSource } from './meterSource';

function makeAnalyser(fftSize = 256) {
  const buf = new Uint8Array(fftSize).fill(128); // 128 = zero signal in byte domain
  return {
    fftSize,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      arr.set(buf);
    }),
  } as unknown as AnalyserNode;
}

function makeSignalAnalyser(fftSize = 256, amplitude = 0.5) {
  // Fill buffer with a simple constant signal at given amplitude
  const sample = Math.round(128 + amplitude * 128);
  const buf = new Uint8Array(fftSize).fill(sample);
  return {
    fftSize,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      arr.set(buf);
    }),
  } as unknown as AnalyserNode;
}

describe('createMeterSource', () => {
  let rafCallbacks: Array<(time: number) => void> = [];
  let originalRaf: typeof requestAnimationFrame;
  let originalCaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;

    let idCounter = 1;
    globalThis.requestAnimationFrame = vi.fn((cb) => {
      rafCallbacks.push(cb);
      return idCounter++;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  function flushRaf(time = 0) {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(time));
  }

  it('subscribe returns an unsubscribe function', () => {
    const analyserL = makeAnalyser();
    const analyserR = makeAnalyser();
    const source = createMeterSource(analyserL, analyserR);
    const unsub = source.subscribe(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('emits a frame on each animation frame tick', () => {
    const analyserL = makeSignalAnalyser(256, 0.5);
    const analyserR = makeSignalAnalyser(256, 0.3);
    const source = createMeterSource(analyserL, analyserR);
    const cb = vi.fn();
    source.subscribe(cb);

    flushRaf(0);

    expect(cb).toHaveBeenCalledTimes(1);
    const frame = cb.mock.calls[0][0];
    expect(frame).toHaveProperty('leftRms');
    expect(frame).toHaveProperty('rightRms');
    expect(frame).toHaveProperty('leftPeak');
    expect(frame).toHaveProperty('rightPeak');
  });

  it('emits frames with values in 0..1 range', () => {
    const analyserL = makeSignalAnalyser(256, 0.5);
    const analyserR = makeSignalAnalyser(256, 0.5);
    const source = createMeterSource(analyserL, analyserR);
    const frames: Array<{ leftRms: number; rightRms: number; leftPeak: number; rightPeak: number }> = [];
    source.subscribe((f) => frames.push(f));

    flushRaf(0);
    flushRaf(16);

    for (const frame of frames) {
      expect(frame.leftRms).toBeGreaterThanOrEqual(0);
      expect(frame.leftRms).toBeLessThanOrEqual(1);
      expect(frame.rightRms).toBeGreaterThanOrEqual(0);
      expect(frame.rightRms).toBeLessThanOrEqual(1);
      expect(frame.leftPeak).toBeGreaterThanOrEqual(0);
      expect(frame.leftPeak).toBeLessThanOrEqual(1);
      expect(frame.rightPeak).toBeGreaterThanOrEqual(0);
      expect(frame.rightPeak).toBeLessThanOrEqual(1);
    }
  });

  it('emits zero-level frames for silent input', () => {
    const analyserL = makeAnalyser(); // filled with 128 = zero signal
    const analyserR = makeAnalyser();
    const source = createMeterSource(analyserL, analyserR);
    const cb = vi.fn();
    source.subscribe(cb);

    flushRaf(0);

    const frame = cb.mock.calls[0][0];
    expect(frame.leftRms).toBe(0);
    expect(frame.rightRms).toBe(0);
    expect(frame.leftPeak).toBe(0);
    expect(frame.rightPeak).toBe(0);
  });

  it('stops ticking after all subscribers unsubscribe', () => {
    const analyserL = makeAnalyser();
    const analyserR = makeAnalyser();
    const source = createMeterSource(analyserL, analyserR);
    const cb = vi.fn();
    const unsub = source.subscribe(cb);

    flushRaf(0);
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    flushRaf(16);
    // After unsubscribe, the rAF callback should have been cancelled
    expect(cancelAnimationFrame).toHaveBeenCalled();
    // No more calls after unsubscribe
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers receiving the same frames', () => {
    const analyserL = makeSignalAnalyser(256, 0.4);
    const analyserR = makeSignalAnalyser(256, 0.4);
    const source = createMeterSource(analyserL, analyserR);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    source.subscribe(cb1);
    source.subscribe(cb2);

    flushRaf(0);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1.mock.calls[0][0]).toEqual(cb2.mock.calls[0][0]);
  });
});

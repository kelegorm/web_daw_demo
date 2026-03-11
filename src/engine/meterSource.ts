import type { MeterFrame, MeterSource } from './types';

function readRmsAndPeak(analyser: AnalyserNode, buf: Uint8Array): { rms: number; peak: number } {
  if (buf.length !== analyser.fftSize) return { rms: 0, peak: 0 };
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = (buf[i] - 128) / 128;
    const abs = Math.abs(s);
    if (abs > peak) peak = abs;
    sum += s * s;
  }
  return { rms: Math.sqrt(sum / buf.length), peak };
}

export function createMeterSource(analyserL: AnalyserNode, analyserR: AnalyserNode): MeterSource {
  const subscribers = new Set<(frame: MeterFrame) => void>();
  let rafId: number | null = null;
  let bufL: Uint8Array | null = null;
  let bufR: Uint8Array | null = null;

  function tick() {
    if (subscribers.size === 0) {
      rafId = null;
      return;
    }

    if (!bufL || bufL.length !== analyserL.fftSize) bufL = new Uint8Array(analyserL.fftSize);
    if (!bufR || bufR.length !== analyserR.fftSize) bufR = new Uint8Array(analyserR.fftSize);

    const l = readRmsAndPeak(analyserL, bufL);
    const r = readRmsAndPeak(analyserR, bufR);

    const frame: MeterFrame = {
      leftRms: l.rms,
      rightRms: r.rms,
      leftPeak: l.peak,
      rightPeak: r.peak,
    };

    for (const cb of subscribers) cb(frame);

    rafId = requestAnimationFrame(tick);
  }

  return {
    subscribe(cb) {
      subscribers.add(cb);
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
      return () => {
        subscribers.delete(cb);
        if (subscribers.size === 0 && rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
    },
  };
}

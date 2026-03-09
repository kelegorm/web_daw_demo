import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Host imports required by synth.wasm
const imports = {
  env: {
    sinf: (x: number) => Math.sin(x),
    powf: (base: number, exp: number) => Math.pow(base, exp),
    memory: new WebAssembly.Memory({ initial: 1 }),
  },
};

interface SynthExports {
  memory: WebAssembly.Memory;
  noteOn: (note: number) => void;
  noteOff: () => void;
  panic: () => void;
  setFilterCutoff: (hz: number) => void;
  setVoiceSpread: (v: number) => void;
  setReverbMix: (v: number) => void;
  process: (ptr: number, blockSize: number) => void;
}

let exports: SynthExports;

// Offset within WASM memory to write the output buffer (after the stack area)
const OUT_PTR = 4096;
const BLOCK = 128;

beforeAll(async () => {
  const wasmPath = resolve(
    fileURLToPath(import.meta.url),
    '../../../public/synth.wasm'
  );
  const buffer = readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(buffer, imports);
  exports = instance.exports as unknown as SynthExports;
});

function readOutput(): Float32Array {
  const mem = new Float32Array(exports.memory.buffer, OUT_PTR, BLOCK);
  return Float32Array.from(mem); // copy so mutations don't affect assertion
}

describe('synth WASM', () => {
  it('produces non-zero output after noteOn', async () => {
    exports.noteOn(69); // A4 = 440 Hz
    exports.process(OUT_PTR, BLOCK);
    const out = readOutput();
    const nonZero = out.some((s) => Math.abs(s) > 0.001);
    expect(nonZero).toBe(true);
  });

  it('produces silent output after noteOff', async () => {
    exports.noteOn(69);
    exports.noteOff();
    exports.process(OUT_PTR, BLOCK);
    const out = readOutput();
    const allZero = out.every((s) => s === 0.0);
    expect(allZero).toBe(true);
  });

  it('produces silent output after panic', async () => {
    exports.noteOn(60);
    exports.panic();
    exports.process(OUT_PTR, BLOCK);
    const out = readOutput();
    const allZero = out.every((s) => s === 0.0);
    expect(allZero).toBe(true);
  });

  it('output amplitude is near 0.3 for a pure tone', async () => {
    exports.noteOn(69);
    exports.process(OUT_PTR, BLOCK);
    const out = readOutput();
    const maxAmp = Math.max(...out.map(Math.abs));
    expect(maxAmp).toBeCloseTo(0.3, 1);
  });
});

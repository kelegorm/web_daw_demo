// AudioWorklet processor — bridges MessagePort messages to WASM calls each audio block.
// Runs in AudioWorkletGlobalScope (separate thread, no DOM access).
// The WASM ArrayBuffer is sent from the main thread via { type: 'load-wasm', buffer }.

const OUT_PTR = 4096; // byte offset in WASM linear memory used for the output buffer

class SynthProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'filterCutoff', defaultValue: 20000, minValue: 20, maxValue: 20000 },
      { name: 'voiceSpread',  defaultValue: 0,     minValue: 0,  maxValue: 1      },
      { name: 'reverbMix',   defaultValue: 0,     minValue: 0,  maxValue: 1      },
    ];
  }

  constructor() {
    super();
    this._wasm = null;

    this.port.onmessage = ({ data }) => {
      if (data.type === 'load-wasm') {
        this._initWasm(data.buffer);
        return;
      }
      if (!this._wasm) return;
      if (data.type === 'noteOn')  this._wasm.noteOn(data.note);
      if (data.type === 'noteOff') this._wasm.noteOff();
      if (data.type === 'panic')   this._wasm.panic();
      if (data.type === 'get-output') {
        // For testing: compute one block and return samples via the port.
        this._wasm.process(OUT_PTR, 128);
        const mem = new Float32Array(this._wasm.memory.buffer, OUT_PTR, 128);
        this.port.postMessage({ type: 'output', samples: Array.from(mem) });
      }
    };
  }

  async _initWasm(buffer) {
    try {
      const { instance } = await WebAssembly.instantiate(buffer, {
        env: {
          sinf: Math.sin,
          powf: Math.pow,
        },
      });
      this._wasm = instance.exports;
      this.port.postMessage({ type: 'ready' });
    } catch (err) {
      this.port.postMessage({ type: 'error', message: String(err) });
    }
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0]?.[0];
    if (!output || !this._wasm) return true;

    const blockSize = output.length;

    this._wasm.setFilterCutoff(parameters.filterCutoff[0] ?? 20000);
    this._wasm.setVoiceSpread(parameters.voiceSpread[0]  ?? 0);
    this._wasm.setReverbMix(parameters.reverbMix[0]     ?? 0);

    this._wasm.process(OUT_PTR, blockSize);

    const mem = new Float32Array(this._wasm.memory.buffer, OUT_PTR, blockSize);
    output.set(mem);

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);

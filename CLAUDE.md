# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based synthesizer demo. Stack: React + TypeScript + Vite, Web Audio API, AudioWorklet, WASM DSP (compiled from C++ via Emscripten). No Tone.js — raw Web Audio API throughout.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

To build the WASM module (requires Emscripten):
```bash
emcc src/wasm/synth.cpp -O2 -s WASM=1 -s EXPORTED_FUNCTIONS="['_process','_noteOn','_noteOff','_panic','_setFilterCutoff','_setVoiceSpread','_setReverbMix']" -o public/synth.js
```

## Architecture

### Ownership boundary — this is strict:
- **JS layer**: transport, sequencer timing, MIDI event scheduling, AudioParam management, UI state
- **WASM layer**: audio rendering only — accepts `noteOn/noteOff/setParam`, produces samples, nothing else

### Data flow
```
React Components
  → useAudioEngine hook (src/hooks/useAudioEngine.ts)
    → AudioWorklet MessagePort
      → synth-processor.js (src/worklets/)
        → WASM module (public/synth.wasm)
          → Web Audio destination + AnalyserNode → VUMeter
```

### Key files
- `src/hooks/useAudioEngine.ts` — AudioContext lifecycle, worklet loading, exposes `noteOn(midi)`, `noteOff(midi)`, `panic()`, `setParam(name, value)`, `analyserNode`
- `src/hooks/useSequencer.ts` — sole owner of transport state; schedules 8-note melody [60,62,64,65,67,69,71,72] using `audioContext.currentTime` lookahead (100ms ahead)
- `src/worklets/synth-processor.js` — AudioWorklet processor; bridges MessagePort messages to WASM calls each audio block
- `src/wasm/synth.cpp` — DSP only: sine oscillator at gain 0.3, frequency from last `noteOn`

### WASM API
```cpp
void process(float* out, int blockSize);
void noteOn(int midiNote);
void noteOff();
void panic();
void setFilterCutoff(float hz);   // 20–20000 Hz
void setVoiceSpread(float v);     // 0–1
void setReverbMix(float v);       // 0–1
```

### AudioWorklet receives these MessagePort messages
```js
{ type: 'noteOn', note: 60 }
{ type: 'noteOff' }
{ type: 'panic' }
```
AudioParams (`filterCutoff`, `voiceSpread`, `reverbMix`) are passed to WASM each processing block.

### Components
- `PianoKeyboard.tsx` — 2 octaves C3–B4; mousedown → `noteOn`, mouseup/leave → `noteOff`
- `Transport.tsx` — Play/Pause toggle (controls `useSequencer`), Panic button (calls `useAudioEngine.panic()`)
- `Knob.tsx` — drag up/down to change value; used by `ParameterPanel.tsx`
- `SequencerDisplay.tsx` — 8 step indicators, highlights current step
- `VUMeter.tsx` — reads RMS from `AnalyserNode` via `requestAnimationFrame`

### Layout (App.tsx)
VU meter (top-right) → knob row → sequencer display → transport buttons → piano keyboard (bottom). Dark theme CSS, no UI framework.

## Testing Strategy

Unit tests (Vitest): mock the AudioWorklet port and verify messages sent by hooks; test WASM loads and `noteOn`/`noteOff` produce non-zero/silent output.

E2E tests (Playwright): full browser integration — worklet registration, audio output non-silence, UI interactions (key press CSS state, Play/Pause label toggle, knob drag changes value, meter reacts within 200ms of note).

## Implementation Plan

See `docs/plans/initial_demo.md` for the 10-task breakdown with checkbox progress tracking.

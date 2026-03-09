# Plan: Browser Synth Demo

## Overview
Browser-based synthesizer demo: React + TypeScript + Vite, Web Audio API,
AudioWorklet, WASM DSP stub. No Tone.js — raw Web Audio API throughout.

Architecture ownership:
- JS: transport, sequencer, timing, MIDI events
- WASM: audio rendering only — accepts noteOn/noteOff/setParam, nothing else

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Project scaffold
- [x] Set up Vite + React + TypeScript project
- [x] Create folder structure: `src/worklets`, `src/wasm`, `src/hooks`, `src/components`
- [x] Add Vitest and Playwright to dev dependencies
- [x] Add `test` and `test:e2e` scripts to package.json
- [x] Write smoke test: app mounts without errors (Playwright opens localhost, checks `<div id="root">` is present)
- [x] Mark completed

### Task 2: WASM stub module
- [x] Create `src/wasm/synth.cpp` exporting: `process(float* out, int blockSize)`, `noteOn(int midiNote)`, `noteOff()`, `panic()`, `setFilterCutoff(float)`, `setVoiceSpread(float)`, `setReverbMix(float)`
- [x] `process()` fills buffer with sine wave at gain 0.3, frequency from last `noteOn`
- [x] Compile via Emscripten to `public/synth.wasm` + `public/synth.js`
- [x] Write Vitest test: load WASM, call `noteOn(69)`, call `process()`, verify output buffer is non-zero
- [x] Write Vitest test: call `noteOff()`, call `process()`, verify output buffer is silent (all zeros)
- [x] Mark completed

### Task 3: AudioWorklet processor
- [x] Create `src/worklets/synth-processor.js`
- [x] Processor loads WASM, calls `process()` each block
- [x] Handles MessagePort messages: `noteOn`, `noteOff`, `panic`
- [x] Passes AudioParam values (`filterCutoff`, `voiceSpread`, `reverbMix`) to WASM each block
- [x] Write Playwright test: open app, run in browser console `await audioWorkletTest()`, verify worklet registers without errors
- [x] Write Playwright test: send `noteOn` message to worklet port, verify output node produces non-silent audio (check AnalyserNode getByteTimeDomainData is not flat)
- [x] Mark completed

### Task 4: useAudioEngine hook
- [x] Create `src/hooks/useAudioEngine.ts`
- [x] Creates AudioContext on first user interaction
- [x] Loads AudioWorklet module, connects to destination
- [x] Exposes: `noteOn(midi)`, `noteOff(midi)`, `panic()`, `setParam(name, value)`, `analyserNode`
- [x] Write Vitest test: `noteOn(60)` sends message `{ type: 'noteOn', note: 60 }` to worklet port (mock port)
- [x] Write Vitest test: `setParam('filterCutoff', 1000)` sets correct AudioParam value
- [x] Write Vitest test: `panic()` sends message `{ type: 'panic' }` to worklet port
- [x] Mark completed

### Task 5: Piano keyboard component
- [x] Create `src/components/PianoKeyboard.tsx`
- [x] 2 octaves C3–B4, white and black keys rendered correctly
- [x] Mouse down → `noteOn`, mouse up / mouse leave → `noteOff`
- [x] Visual pressed state per key
- [x] Write Playwright test: click middle C key, verify key gets `pressed` CSS class
- [x] Write Playwright test: mousedown on C3, verify `noteOn(48)` called (spy on hook); mouseup, verify `noteOff(48)` called
- [x] Mark completed

### Task 6: Transport controls
- [x] Create `src/components/Transport.tsx`
- [x] Play / Pause toggle button
- [x] Panic button (red)
- [x] Play/Pause controls `useSequencer` start/stop directly — does not send messages to AudioWorklet
- [x] Panic calls `panic()` via `useAudioEngine`
- [x] Write Playwright test: click Play, verify button label changes to "Pause"
- [x] Write Playwright test: click Panic, verify `panic()` called and all keys show unpressed state
- [x] Mark completed

### Task 7: MIDI clip sequencer
- [x] Create `src/hooks/useSequencer.ts`
- [x] `useSequencer` is the sole owner of transport state
- [x] Hardcoded 8-note melody: MIDI notes [60, 62, 64, 65, 67, 69, 71, 72] (C D E F G A B C, major scale, not chromatic)
- [x] Scheduler uses `audioContext.currentTime` lookahead pattern (schedule 100ms ahead)
- [x] Fires `noteOn` / `noteOff` via `useAudioEngine` on exact audio clock
- [x] Create `src/components/SequencerDisplay.tsx`: 8 step indicators, highlights current step
- [x] Write Vitest test: scheduler fires exactly [60, 62, 64, 65, 67, 69, 71, 72] in that order, not chromatic sequence
- [x] Write Vitest test: stop transport mid-sequence, verify no further notes fired
- [x] Write Playwright test: click Play, wait 2 beats, verify at least 2 different step indicators were highlighted
- [x] Mark completed

### Task 8: Parameter knobs
- [x] Create `src/components/Knob.tsx`: rotary knob, drag up/down changes value, label + value display
- [x] Create `src/components/ParameterPanel.tsx`: three knobs — Filter Cutoff (20–20000 Hz), Voice Spread (0–1), Reverb Mix (0–1)
- [x] Knobs call `setParam()` via `useAudioEngine` on change
- [x] Write Playwright test: drag Filter Cutoff knob upward, verify displayed value increases
- [x] Write Playwright test: drag Reverb Mix knob, verify `setParam('reverbMix', value)` called with value in range 0–1 (spy)
- [x] Mark completed

### Task 9: VU meter
- [x] Create `src/components/VUMeter.tsx`
- [x] Reads RMS from `AnalyserNode` via `requestAnimationFrame`
- [x] Vertical bar with green / yellow / red zones
- [x] Write Playwright test: with no notes playing, verify meter bar height is at minimum
- [x] Write Playwright test: click piano key, verify meter bar height increases above minimum within 200ms
- [x] Mark completed

### Task 10: Layout and final integration
- [x] Compose all components in `src/App.tsx`
- [x] Dark theme CSS, no UI framework
- [x] Layout: VU meter top-right, knob row, sequencer display, transport buttons, piano keyboard at bottom
- [x] Write Playwright test: full smoke — open app, click Play, click C3 key, verify meter reacts, verify sequencer steps advance, verify no console errors
- [x] Mark completed
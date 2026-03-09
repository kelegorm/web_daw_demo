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
- [ ] Create `src/hooks/useAudioEngine.ts`
- [ ] Creates AudioContext on first user interaction
- [ ] Loads AudioWorklet module, connects to destination
- [ ] Exposes: `noteOn(midi)`, `noteOff(midi)`, `panic()`, `setParam(name, value)`, `analyserNode`
- [ ] Write Vitest test: `noteOn(60)` sends message `{ type: 'noteOn', note: 60 }` to worklet port (mock port)
- [ ] Write Vitest test: `setParam('filterCutoff', 1000)` sets correct AudioParam value
- [ ] Write Vitest test: `panic()` sends message `{ type: 'panic' }` to worklet port
- [ ] Mark completed

### Task 5: Piano keyboard component
- [ ] Create `src/components/PianoKeyboard.tsx`
- [ ] 2 octaves C3–B4, white and black keys rendered correctly
- [ ] Mouse down → `noteOn`, mouse up / mouse leave → `noteOff`
- [ ] Visual pressed state per key
- [ ] Write Playwright test: click middle C key, verify key gets `pressed` CSS class
- [ ] Write Playwright test: mousedown on C3, verify `noteOn(48)` called (spy on hook); mouseup, verify `noteOff(48)` called
- [ ] Mark completed

### Task 6: Transport controls
- [ ] Create `src/components/Transport.tsx`
- [ ] Play / Pause toggle button
- [ ] Panic button (red)
- [ ] Play/Pause controls `useSequencer` start/stop directly — does not send messages to AudioWorklet
- [ ] Panic calls `panic()` via `useAudioEngine`
- [ ] Write Playwright test: click Play, verify button label changes to "Pause"
- [ ] Write Playwright test: click Panic, verify `panic()` called and all keys show unpressed state
- [ ] Mark completed

### Task 7: MIDI clip sequencer
- [ ] Create `src/hooks/useSequencer.ts`
- [ ] `useSequencer` is the sole owner of transport state
- [ ] Hardcoded 8-note melody: MIDI notes [60, 62, 64, 65, 67, 69, 71, 72] (C D E F G A B C, major scale, not chromatic)
- [ ] Scheduler uses `audioContext.currentTime` lookahead pattern (schedule 100ms ahead)
- [ ] Fires `noteOn` / `noteOff` via `useAudioEngine` on exact audio clock
- [ ] Create `src/components/SequencerDisplay.tsx`: 8 step indicators, highlights current step
- [ ] Write Vitest test: scheduler fires exactly [60, 62, 64, 65, 67, 69, 71, 72] in that order, not chromatic sequence
- [ ] Write Vitest test: stop transport mid-sequence, verify no further notes fired
- [ ] Write Playwright test: click Play, wait 2 beats, verify at least 2 different step indicators were highlighted
- [ ] Mark completed

### Task 8: Parameter knobs
- [ ] Create `src/components/Knob.tsx`: rotary knob, drag up/down changes value, label + value display
- [ ] Create `src/components/ParameterPanel.tsx`: three knobs — Filter Cutoff (20–20000 Hz), Voice Spread (0–1), Reverb Mix (0–1)
- [ ] Knobs call `setParam()` via `useAudioEngine` on change
- [ ] Write Playwright test: drag Filter Cutoff knob upward, verify displayed value increases
- [ ] Write Playwright test: drag Reverb Mix knob, verify `setParam('reverbMix', value)` called with value in range 0–1 (spy)
- [ ] Mark completed

### Task 9: VU meter
- [ ] Create `src/components/VUMeter.tsx`
- [ ] Reads RMS from `AnalyserNode` via `requestAnimationFrame`
- [ ] Vertical bar with green / yellow / red zones
- [ ] Write Playwright test: with no notes playing, verify meter bar height is at minimum
- [ ] Write Playwright test: click piano key, verify meter bar height increases above minimum within 200ms
- [ ] Mark completed

### Task 10: Layout and final integration
- [ ] Compose all components in `src/App.tsx`
- [ ] Dark theme CSS, no UI framework
- [ ] Layout: VU meter top-right, knob row, sequencer display, transport buttons, piano keyboard at bottom
- [ ] Write Playwright test: full smoke — open app, click Play, click C3 key, verify meter reacts, verify sequencer steps advance, verify no console errors
- [ ] Mark completed
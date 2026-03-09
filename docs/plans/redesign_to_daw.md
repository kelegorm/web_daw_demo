# Plan: Browser Synth DAW — Redesign

## Overview
Redesign the synth demo into a DAW-style interface inspired by Bitwig Studio.
Stack: React + TypeScript + Vite, Tone.js (synth), Web Audio API (panner effect).

Architecture ownership:
- JS/Tone.js: transport, sequencer, timing, synth engine, MIDI events
- Web Audio API: panner effect node
- React: all UI, dark DAW theme

Layout (top to bottom):
1. Toolbar
2. Track zone (full width)
3. Device panel
4. MIDI keyboard strip

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 0: Remove WASM and AudioWorklet
- [ ] Delete `src/worklets/` directory
- [ ] Delete `src/wasm/` directory
- [ ] Delete `public/synth.wasm` and `public/synth.js` if present
- [ ] Delete `src/hooks/useAudioEngine.ts` entirely
- [ ] Remove all imports referencing worklet, WASM, or useAudioEngine across codebase
- [ ] Delete all test files referencing AudioWorklet, WASM, or useAudioEngine
- [ ] Run `npm run test` — verify no failing tests remain (zero passing is acceptable)
- [ ] `npm run build` passes with no errors
- [ ] Mark completed

### Task 1: Design tokens and dark theme
- [ ] Create `src/styles/tokens.css` with CSS variables: background colors, surface colors, accent color, border radius, font sizes, spacing scale
- [ ] Dark theme: near-black background (#1a1a1f), dark surface (#26262e), accent orange/amber (#f5a623), text (#e0e0e0)
- [ ] Apply tokens globally in `src/index.css`
- [ ] Write Playwright test: open app, verify `body` background-color matches token value
- [ ] Mark completed

### Task 2: Toolbar component
- [ ] Create `src/components/Toolbar.tsx`
- [ ] Left: application name "SynthDemo" in accent color
- [ ] Center: Play/Pause toggle button, Stop button, Panic button (red)
- [ ] Right: BPM input (number field, 60–200, default 120), Loop toggle button
- [ ] Toolbar is fixed at top, full width, height 48px
- [ ] Transport controls call `useSequencer` start/stop — no direct AudioWorklet messages
- [ ] BPM change updates `Tone.Transport.bpm.value`
- [ ] Write Playwright test: click Play, verify button label changes to "Pause"
- [ ] Write Playwright test: change BPM input to 140, verify displayed value is 140
- [ ] Write Playwright test: click Panic, verify all active notes are released
- [ ] Mark completed

### Task 3: Track zone with timeline and MIDI clip block
- [ ] Create `src/components/TrackZone.tsx`
- [ ] Full-width zone below toolbar
- [ ] Track header on left (fixed width 180px): track name "synth1", horizontal volume slider, Mute toggle (default off), Rec toggle (default on)
- [ ] Timeline area on right: shows MIDI clip as a colored block, width proportional to clip duration at current BPM
- [ ] MIDI clip block displays mini piano-roll: render notes [60, 62, 64, 65, 67, 69, 71, 72] as small horizontal bars inside the block, vertically positioned by pitch
- [ ] Playhead line moves across timeline during playback using `requestAnimationFrame`
- [ ] Write Playwright test: verify track header contains text "synth1"
- [ ] Write Playwright test: verify Mute button has aria-pressed="false" by default
- [ ] Write Playwright test: verify Rec button has aria-pressed="true" by default
- [ ] Write Playwright test: click Play, wait 500ms, verify playhead has moved (check transform or left style changed)
- [ ] Mark completed

### Task 4: Tone.js polyphonic synth engine
- [ ] Install Tone.js: `npm install tone`
- [ ] Create `src/hooks/useToneSynth.ts`
- [ ] Instantiate `Tone.PolySynth` with `Tone.Synth` voice
- [ ] Expose: `noteOn(midi, velocity)`, `noteOff(midi)`, `panic()`, `setFilterCutoff(hz)`, `setVoiceSpread(value)`, `setVolume(db)`, `setEnabled(bool)`
- [ ] `setEnabled(false)` disconnects synth from output (mute via Tone.js graph)
- [ ] Synth output connects to panner node from Task 5, not directly to destination
- [ ] Write Vitest test: `noteOn(60, 100)` triggers active voice in PolySynth (mock or spy)
- [ ] Write Vitest test: `panic()` calls `releaseAll()` on PolySynth
- [ ] Write Vitest test: `setFilterCutoff(800)` updates filter frequency parameter
- [ ] Mark completed

### Task 5: Panner effect node
- [ ] Create `src/hooks/usePanner.ts`
- [ ] Instantiate `StereoPannerNode` via raw Web Audio API: `audioContext.createStereoPanner()`
- [ ] Connect: Tone.js synth output → StereoPannerNode → AudioContext.destination
- [ ] Expose: `setPan(value)` (-1 left, 0 center, +1 right), `setEnabled(bool)`, `isEnabled: boolean`
- [ ] `setEnabled(false)` bypasses panner (connect synth directly to destination)
- [ ] Write Vitest test: `setPan(-1)` sets `pannerNode.pan.value` to -1
- [ ] Write Vitest test: `setPan(0.5)` sets `pannerNode.pan.value` to 0.5
- [ ] Write Playwright test: open app, verify no AudioContext errors in console
- [ ] Mark completed

### Task 6: Device panel
- [ ] Create `src/components/DevicePanel.tsx`
- [ ] Horizontal strip below track zone, full width, height ~140px
- [ ] Two device sections side by side, separated by divider

- [ ] **Synth section** (`src/components/SynthDevice.tsx`):
    - [ ] Enable/disable toggle in top-left corner
    - [ ] Label "Polysynth"
    - [ ] Three knobs: Filter Cutoff (20–20000 Hz, log scale display), Voice Spread (0–1), Volume (-60–0 dB)
    - [ ] Knobs call `useToneSynth` setters on change
    - [ ] Disable toggle calls `useToneSynth.setEnabled(bool)`

- [ ] **Panner section** (`src/components/PannerDevice.tsx`):
    - [ ] Enable/disable toggle in top-left corner
    - [ ] Label "Panner"
    - [ ] One knob: Pan (-1 to +1, center detent at 0)
    - [ ] Knob calls `usePanner.setPan()` on change
    - [ ] Disable toggle calls `usePanner.setEnabled(bool)`

- [ ] Write Playwright test: verify "Polysynth" and "Panner" labels are visible
- [ ] Write Playwright test: click Synth section disable toggle, verify aria-pressed="false"
- [ ] Write Playwright test: drag Pan knob right, verify displayed pan value increases
- [ ] Mark completed

### Task 7: Update sequencer to use Tone.js
- [ ] Update `src/hooks/useSequencer.ts`
- [ ] Replace raw `audioContext.currentTime` scheduler with `Tone.Transport` and `Tone.Part`
- [ ] Sequence: notes [60, 62, 64, 65, 67, 69, 71, 72], one note per 8th note at current BPM
- [ ] Each step calls `useToneSynth.noteOn()` and schedules `noteOff()` after 80% of step duration
- [ ] Transport Play/Stop synced with `Tone.Transport.start()` / `Tone.Transport.stop()`
- [ ] Loop button toggles `Tone.Transport.loop`
- [ ] Current step index exposed for SequencerDisplay and playhead in TrackZone
- [ ] Write Vitest test: sequence fires exactly [60, 62, 64, 65, 67, 69, 71, 72] in order (mock Tone.Transport)
- [ ] Write Vitest test: stop mid-sequence, verify no further notes fired after stop
- [ ] Write Playwright test: click Play, wait 1000ms at 120 BPM, verify at least 2 different step indicators highlighted
- [ ] Mark completed

### Task 8: MIDI keyboard strip
- [ ] Create `src/components/MidiKeyboard.tsx`
- [ ] Horizontal strip at bottom, full width, height ~100px
- [ ] 2 octaves C3–B4 (MIDI 48–71), white and black keys
- [ ] Mouse down → `useToneSynth.noteOn(midi, 100)`, mouse up / mouse leave → `useToneSynth.noteOff(midi)`
- [ ] Visual pressed state per key
- [ ] Polyphonic: multiple keys can be pressed simultaneously
- [ ] Write Playwright test: mousedown on C3, verify key gets `pressed` CSS class
- [ ] Write Playwright test: mousedown on C3 and E3 simultaneously, verify both show pressed state
- [ ] Write Playwright test: mouseup on C3, verify C3 loses pressed class, E3 retains it
- [ ] Mark completed

### Task 9: VU meter on track header
- [ ] Create `src/components/VUMeter.tsx`
- [ ] Vertical bar, reads RMS from `AnalyserNode` connected after panner via `requestAnimationFrame`
- [ ] Green / yellow / red zones
- [ ] Embed in track header in `TrackZone.tsx`
- [ ] Mute button silences output and freezes meter at zero
- [ ] Write Playwright test: no notes playing → meter bar at minimum height
- [ ] Write Playwright test: press C3 key → meter exceeds minimum within 300ms
- [ ] Write Playwright test: click Mute → meter returns to minimum within 300ms
- [ ] Mark completed

### Task 10: Final integration and layout polish
- [ ] Compose all components in `src/App.tsx`: Toolbar → TrackZone → DevicePanel → MidiKeyboard
- [ ] Consistent spacing, colors, fonts using design tokens from Task 1
- [ ] All interactive elements have visible focus styles
- [ ] No horizontal scroll at 1280px width
- [ ] Write Playwright smoke test: open app, click Play, press C3, verify meter reacts, sequencer advances, no console errors
- [ ] Write Playwright test: viewport 1280px, verify no horizontal scrollbar
- [ ] Mark completed
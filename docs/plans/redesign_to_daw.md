# Plan: Browser Synth DAW — Redesign

## Overview
Redesign the synth demo into a DAW-style interface inspired by Bitwig Studio.
Stack: React + TypeScript + Vite, Tone.js (synth), Web Audio API (panner effect).
Documentation alignment:
- Update architecture docs (`AGENTS.md`, plan notes) to reflect Tone.js migration and new ownership boundaries.

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

### Task 1: Design tokens and dark theme
- [x] Create `src/styles/tokens.css` with CSS variables: background colors, surface colors, accent color, border radius, font sizes, spacing scale
- [x] Dark theme: near-black background (#1a1a1f), dark surface (#26262e), accent orange/amber (#f5a623), text (#e0e0e0)
- [x] Apply tokens globally in `src/index.css`
- [x] Write Playwright test: open app, verify `body` background-color matches token value
- [x] Mark completed

### Task 2: Toolbar component
- [x] Create `src/components/Toolbar.tsx`
- [x] Left: application name "SynthDemo" in accent color
- [x] Center: Play/Pause toggle button, Stop button, Panic button (red)
- [x] Right: BPM input (number field, 60–200, default 120), Loop toggle button
- [x] Toolbar is fixed at top, full width, height 48px
- [x] Transport controls call `useSequencer` start/stop — no direct AudioWorklet messages
- [x] BPM change updates `Tone.Transport.bpm.value`
- [x] Write Playwright test: click Play, verify button label changes to "Pause"
- [x] Write Playwright test: change BPM input to 140, verify displayed value is 140
- [x] Write Playwright test: click Panic, verify all active notes are released
- [x] Mark completed

### Task 3: Track zone with timeline and MIDI clip block
- [x] Create `src/components/TrackZone.tsx`
- [x] Full-width zone below toolbar
- [x] Track header on left (fixed width 180px): track name "synth1", horizontal volume slider, Mute toggle (default off), Rec toggle (default on)
- [x] Timeline area on right: shows MIDI clip as a colored block, width proportional to clip duration at current BPM
- [x] MIDI clip block displays mini piano-roll: render notes [60, 62, 64, 65, 67, 69, 71, 72] as small horizontal bars inside the block, vertically positioned by pitch
- [x] Playhead line moves across timeline during playback using `requestAnimationFrame`
- [x] Write Playwright test: verify track header contains text "synth1"
- [x] Write Playwright test: verify Mute button has aria-pressed="false" by default
- [x] Write Playwright test: verify Rec button has aria-pressed="true" by default
- [x] Write Playwright test: click Play, wait 500ms, verify playhead has moved (check transform or left style changed)
- [x] Mark completed

### Task 4: Tone.js polyphonic synth engine
- [x] Install Tone.js: `npm install tone`
- [x] Create `src/hooks/useToneSynth.ts`
- [x] Instantiate `Tone.PolySynth` with `Tone.Synth` voice
- [x] Expose: `noteOn(midi, velocity)`, `noteOff(midi)`, `panic()`, `setFilterCutoff(hz)`, `setVoiceSpread(value)`, `setVolume(db)`, `setEnabled(bool)`
- [x] `setEnabled(false)` disconnects synth from output (mute via Tone.js graph)
- [x] Synth output connects to panner node from Task 5, not directly to destination
- [x] Write Vitest test: `noteOn(60, 100)` triggers active voice in PolySynth (mock or spy)
- [x] Write Vitest test: `panic()` calls `releaseAll()` on PolySynth
- [x] Write Vitest test: `setFilterCutoff(800)` updates filter frequency parameter
- [x] Mark completed

### Task 5: Panner effect node
- [x] Create `src/hooks/usePanner.ts`
- [x] Instantiate `StereoPannerNode` via raw Web Audio API: `audioContext.createStereoPanner()`
- [x] Define and implement explicit graph: `Tone.PolySynth output -> StereoPannerNode -> GainNode (track mute) -> AnalyserNode -> AudioContext.destination`
- [x] Expose: `setPan(value)` (-1 left, 0 center, +1 right), `setEnabled(bool)`, `isEnabled: boolean`
- [x] `setEnabled(false)` bypasses panner while keeping `GainNode -> AnalyserNode` chain intact
- [x] Write Vitest test: `setPan(-1)` sets `pannerNode.pan.value` to -1
- [x] Write Vitest test: `setPan(0.5)` sets `pannerNode.pan.value` to 0.5
- [x] Write Playwright test: open app, verify no AudioContext errors in console
- [x] Mark completed

### Task 6: Device panel
- [x] Create `src/components/DevicePanel.tsx`
- [x] Horizontal strip below track zone, full width, height ~140px
- [x] Two device sections side by side, separated by divider

- [x] **Synth section** (`src/components/SynthDevice.tsx`):
    - [x] Enable/disable toggle in top-left corner
    - [x] Label "Polysynth"
    - [x] Three knobs: Filter Cutoff (20–20000 Hz, log scale display), Voice Spread (0–1), Volume (-60–0 dB)
    - [x] Knobs call `useToneSynth` setters on change
    - [x] Disable toggle calls `useToneSynth.setEnabled(bool)`

- [x] **Panner section** (`src/components/PannerDevice.tsx`):
    - [x] Enable/disable toggle in top-left corner
    - [x] Label "Panner"
    - [x] One knob: Pan (-1 to +1, center detent at 0)
    - [x] Knob calls `usePanner.setPan()` on change
    - [x] Disable toggle calls `usePanner.setEnabled(bool)`

- [x] Write Playwright test: verify "Polysynth" and "Panner" labels are visible
- [x] Write Playwright test: click Synth section disable toggle, verify aria-pressed="false"
- [x] Write Playwright test: drag Pan knob right, verify displayed pan value increases
- [x] Mark completed

### Task 7: Update sequencer to use Tone.js
- [x] Update `src/hooks/useSequencer.ts`
- [x] Replace raw `audioContext.currentTime` scheduler with `Tone.Transport` and `Tone.Part`
- [x] Sequence: notes [60, 62, 64, 65, 67, 69, 71, 72], one note per 8th note at current BPM
- [x] Each step calls `useToneSynth.noteOn()` and schedules `noteOff()` after 80% of step duration
- [x] Transport semantics:
  - [x] Pause = temporary transport halt without resetting current step
  - [x] Stop = transport stop + step reset to 0 + `panic()/releaseAll()` to avoid hanging notes
- [x] Loop button toggles `Tone.Transport.loop`
- [x] Current step index exposed for SequencerDisplay and playhead in TrackZone
- [x] Write Vitest test: sequence fires exactly [60, 62, 64, 65, 67, 69, 71, 72] in order (mock Tone.Transport)
- [x] Write Vitest test: stop mid-sequence, verify no further notes fired after stop
- [x] Write Playwright test: click Play, wait 1000ms at 120 BPM, verify at least 2 different step indicators highlighted
- [x] Mark completed

### Task 8: Transport and mute business logic
- [x] Create `src/hooks/useTransportController.ts` as the single owner of transport + mute transitions
- [x] Expose explicit actions: `play()`, `pause()`, `stop()`, `setBpm()`, `setLoop()`, `setTrackMute()`, `panic()`
- [x] Define state transition contract:
    - [x] `pause()` keeps current step and does not call `panic()`
    - [x] `stop()` resets current step to 0 and calls `panic()/releaseAll()` exactly once
    - [x] `setTrackMute(true)` silences output via `GainNode`, but sequencer timing/step progression continues
    - [x] `setTrackMute(false)` restores audible output and meter activity
- [x] Define mute priority rule: track mute overrides synth/panner enable states for final audible output
- [x] Wire Toolbar transport controls, Track mute button, and device enable toggles through this controller (no duplicated component-local transport logic)
- [x] Write Vitest test: play -> pause -> play resumes from paused step
- [x] Write Vitest test: stop triggers panic once and resets step
- [x] Write Vitest test: mute sets gain to 0, unmute restores gain > 0
- [x] Write Vitest test: while muted, sequencer current step still advances
- [x] Write Vitest test: track mute ON keeps output silent even if synth/panner are enabled
- [x] Mark completed

### Task 9: MIDI keyboard strip
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

### Task 10: VU meter on track header
- [ ] Create `src/components/VUMeter.tsx`
- [ ] Vertical bar, reads RMS from `AnalyserNode` in graph `PolySynth -> Panner -> Gain(Mute) -> Analyser -> destination` via `requestAnimationFrame`
- [ ] Green / yellow / red zones
- [ ] Embed in track header in `TrackZone.tsx`
- [ ] Mute button silences output and freezes meter at zero
- [ ] Write Playwright test: no notes playing → meter bar at minimum height
- [ ] Write Playwright test: press C3 key → meter exceeds minimum within 300ms
- [ ] Write Playwright test: click Mute → meter returns to minimum within 300ms
- [ ] Mark completed

### Task 11: Final integration and layout polish
- [ ] Compose all components in `src/App.tsx`: Toolbar → TrackZone → DevicePanel → MidiKeyboard
- [ ] Consistent spacing, colors, fonts using design tokens from Task 1
- [ ] All interactive elements have visible focus styles
- [ ] No horizontal scroll at 1280px width
- [ ] Write Playwright smoke test: open app, click Play, press C3, verify meter reacts, sequencer advances, no console errors
- [ ] Write Playwright test: viewport 1280px, verify no horizontal scrollbar
- [ ] Mark completed

### Task 12: Legacy cleanup (after Tone.js integration is green)
- [ ] Delete `src/worklets/` directory
- [ ] Delete `src/wasm/` directory
- [ ] Delete `public/synth.wasm` and `public/synth.js` if present
- [ ] Delete `src/hooks/useAudioEngine.ts` entirely
- [ ] Remove all imports referencing worklet, WASM, or useAudioEngine across codebase
- [ ] Delete all test files referencing AudioWorklet, WASM, or useAudioEngine
- [ ] Run `npm run test` — verify test suite passes
- [ ] `npm run build` passes with no errors
- [ ] Mark completed

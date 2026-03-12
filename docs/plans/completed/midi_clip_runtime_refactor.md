# Plan: MIDI Clip Runtime Refactor

## Overview

Current state:
- Clip note data is duplicated between playback (`useSequencer.ts`) and UI visuals (`TrackZone.tsx`).
- Sequencer loop window is fixed to `'1m'`, not clip-derived.
- Clip timeline placement is still effectively zero-based in the UI path.
- Tests are heavily coupled to hardcoded `8`-step behavior instead of clip-driven inputs.

Goal:
- Make `MidiClipStore` the single source of truth for clip content and clip timeline geometry.
- Drive both sequencer playback and clip visuals from resolved clip data.
- Preserve current audible behavior for default data.

Scope constraints:
- Keep sequencer grid fixed to `8n` for this refactor.
- Do not change transport/sequencer topology or `TransportService` public API.
- Do not introduce `ProjectDocument` / `DawEngine` in this plan.

## Data Model

- `MidiClipStore`
- Contains: map `clipId -> MidiClip`

- `MidiClip`
- Contains: `clipId`, `startBeat` (number, fractional beats, `>= 0`), `lengthSteps` (integer sequencer steps, `> 0`), list of steps

- `MidiStep`
- Contains: on/off flag, note, velocity, gate

## MidiClip Semantics

- Step grid unit: `8n` (`STEP_BEATS = 0.5`).
- Step index is local to clip and integer (`0..lengthSteps-1`).
- Absolute beat mapping: `startBeat + (localStep * STEP_BEATS)`.
- `lengthBeats` is derived at runtime from `lengthSteps * STEP_BEATS`.
- Fractional beat clip lengths are expected for odd step counts (example: `lengthSteps = 7` -> `lengthBeats = 3.5`).
- `MidiStep.gate` is normalized (`0..1`) and maps to note duration as `stepDuration * gate`.
- Default migrated clip must preserve current behavior (`lengthSteps = 8`, gate `0.8`, same note order/timing as current demo).
- Sequencer loop window must be clip-derived: both `Tone.Part.loopEnd` and `TransportService.setLoopConfig(..., loopEnd)` use clip-derived length (no fixed `'1m'` path).
- Track UI clip layout must be clip-derived: `startBeat` controls left coordinate, derived `lengthBeats` controls clip width.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Introduce `MidiClipStore` and default clip data
- [x] Create `src/project-runtime/midiClipStore.ts` with `MidiStep`, `MidiClip`, `MidiClipStore`.
- [x] Export `DEFAULT_MIDI_CLIP_STORE` and default clip id matching current demo sequence.
- [x] Extract `DEFAULT_MIDI_CLIP_ID` as a dedicated constant and add a comment that this default-id wiring is temporary.
- [x] Migrate the currently hardcoded sequencer note data (currently in `useSequencer.ts`) into `DEFAULT_MIDI_CLIP_STORE` as canonical default clip content.
- [x] Add comment for `DEFAULT_MIDI_CLIP_STORE` that it's temporary and should be removed in short future.
- [x] Add fail-fast lookup helpers for missing clip ids.
- [x] Document `startBeat`, `lengthSteps`, derived `lengthBeats`, and `gate` semantics in code comments/types.
- [x] Mark completed.

### Task 2: Make sequencer clip-driven
- [x] Introduce clip input contract for sequencer (resolve by `clipId`).
- [x] Remove hardcoded sequencer note constants from playback path.
- [x] Build sequencer events from resolved clip steps.
- [x] Derive loop-end from `lengthSteps` -> `lengthBeats` and route to both `Tone.Part.loopEnd` and `TransportService.setLoopConfig`.
- [x] Keep current runtime behavior identical for default clip (same notes/order/timing, loop behavior, panic/stop behavior).
- [x] Mark completed.

### Task 3: Make clip visuals clip-driven
- [x] Remove duplicated inline clip-note constants from `TrackZone` rendering path.
- [x] Derive clip left position from `startBeat` (including fractional offsets).
- [x] Derive clip width from `lengthSteps` via derived `lengthBeats`.
- [x] Derive loop-region position/width and playhead wrap window from the same clip start+length data.
- [x] Keep current visible behavior unchanged for default clip data.
- [x] Mark completed.

### Task 4: Regression coverage and test migration
- [x] Add/adjust unit tests for clip store lookup and fail-fast behavior.
- [x] Add/adjust unit tests for loop-end derivation, including odd `lengthSteps` that produce fractional `lengthBeats`.
- [x] Add/adjust unit tests for gate-based note-off scheduling driven by clip data.
- [x] Update tests that hardcode `8` steps/notes to use clip-driven expectations:
  - `src/hooks/useSequencer.test.ts`
  - `src/hooks/useTransportController.test.ts`
  - `e2e/sequencer.spec.ts`
  - `e2e/trackzone.spec.ts`
  - `e2e/playhead.spec.ts`
- [x] Add visual test matrix for clip-dependent rendering:
  - `startBeat=0,lengthSteps=8`
  - `startBeat=0.5,lengthSteps=8`
  - `startBeat=0,lengthSteps=7`
- [x] Add one end-to-end regression spec proving one-source clip chain: `MidiClipStore` drives sequencer delivery, loop window, clip width/position, and playhead wrap.
- [x] Mark completed.

## Acceptance Criteria
- `MidiClipStore` is the single source of clip content used by both playback and clip visuals; no duplicated inline note arrays remain in sequencer/UI rendering paths.
- Sequencer playback events are built from resolved clip data by `clipId`; hardcoded default note-sequence constants are removed from sequencer runtime logic.
- Loop window is clip-derived in both places: `Tone.Part.loopEnd` and `TransportService.setLoopConfig(..., loopEnd)` receive values computed from `lengthSteps`.
- Clip rendering geometry is clip-derived: `startBeat` controls left position, and `lengthSteps` (via derived `lengthBeats`) controls clip width and loop-region span.
- Automated coverage includes multiple clip-shape variants (`startBeat=0,lengthSteps=8`, `startBeat=0.5,lengthSteps=8`, `startBeat=0,lengthSteps=7`) and one end-to-end chain regression.
- `npm run test`, `npm run test:e2e`, and `npm run build` pass with default clip behavior unchanged.

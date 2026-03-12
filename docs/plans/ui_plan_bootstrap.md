# Plan: UI Plan Bootstrap

## Overview

Current state:
- UI composition is still hardcoded across `App.tsx`, `TrackZone.tsx`, and `DevicePanel.tsx`.
- Audio graph is already plan-driven, but UI is not.
- We keep current direct audio module interfaces for now (no DAW engine refactor in this plan).

Goal:
- Build UI from an explicit `UiPlan` model.
- Keep MIDI clip data outside `UiPlan` in a temporary `MidiClipStore`.
- Keep behavior unchanged.

Scope constraints:
- Do not introduce `ProjectDocument` / `DawEngine` yet.
- Do not implement diff/patch/reconcile.
- Do not change transport/audio scheduling architecture.
- Master track is not part of `UiPlan.tracks`; it is referenced by `masterTrackId`.

## Class Schema

- `UiPlan`
- Contains: list of regular tracks, `masterTrackId`

- `UiTrackPlan`
- Contains: `trackId`, `trackStripId`, `clipIds`, list of `UiDevicePlan`

- `UiDevicePlan`
- Contains: `uiDeviceId`, `moduleId`, `moduleKind` (kind from audio-graph module kinds)

- `MidiClipStore`
- Contains: map `clipId -> MidiClip`

- `MidiClip`
- Contains: `clipId`, `startStep`, `lengthSteps`, list of steps

- `MidiStep`
- Contains: on/off flag, note, velocity, gate

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- Manual smoke in `npm run dev`: app opens, play/pause works, keyboard note triggers sound, meters react, track/device selection works.

---

### Task 1: Add `MidiClipStore` and migrate current sequence to store
- [ ] Create `src/ui-plan/midiClipStore.ts` with `MidiStep`, `MidiClip`, `MidiClipStore` types from the schema.
- [ ] Export `DEFAULT_MIDI_CLIP_STORE` matching current sequence behavior.
- [ ] Add helper accessors for clip lookup with fail-fast errors on missing clip ids.
- [ ] Introduce a sequencer clip input contract (for example: resolve clip by `clipId`) so sequencer does not own hardcoded note constants.
- [ ] Wire current playback to pass a default `clipId` and resolve clip data from `DEFAULT_MIDI_CLIP_STORE`.
- [ ] Keep current runtime behavior identical (same notes/order/timing).
- [ ] Add/adjust unit tests for clip store lookup and playback using store data.
- [ ] Mark completed.

### Task 2: Add `UiPlan` model and default UI plan
- [ ] Create folder `src/ui-plan/` (separate from `src/engine/`).
- [ ] Create `src/ui-plan/uiPlan.ts`.
- [ ] Create `src/ui-plan/defaultUiPlan.ts` with `DEFAULT_UI_PLAN` that reflects current app layout.
- [ ] Add inline comment on every exported `DEFAULT_PLAN_*_ID` style constant: "Default-plan only, not a generic contract for custom plans".
- [ ] Add unit tests for `DEFAULT_UI_PLAN` shape and id consistency.
- [ ] Mark completed.

### Task 3: Add UI runtime constructor from plan
- [ ] Create `src/ui-plan/buildUiRuntime.ts`.
- [ ] Input: `uiPlan`, `midiClipStore`, `audioEngine`, `selectedTrackId`.
- [ ] Output two view-models: `trackZoneModel` and `devicePanelModel`.
- [ ] Resolve track clips by `clipIds` from `MidiClipStore` (fail-fast if a clip id is missing).
- [ ] Resolve device models by `UiDevicePlan.moduleId` and `moduleKind` (fail-fast on missing/mismatched ids).
- [ ] Add unit tests for success path and fail-fast path.
- [ ] Mark completed.

### Task 4: Refactor `DevicePanel` to model-driven rendering
- [ ] Replace hardcoded `synth/panner/limiter` branch rendering with iteration over `devicePanelModel.devices`.
- [ ] Keep existing device components (`SynthDevice`, `PannerDevice`, `LimiterDevice`).
- [ ] Choose component by `moduleKind` from `UiDevicePlan`.
- [ ] Preserve existing visible behavior and CSS selectors used by e2e tests.
- [ ] Add/adjust tests for selected-track device list rendering.
- [ ] Mark completed.

### Task 5: Refactor `TrackZone` to model-driven rendering
- [ ] Replace fat prop list with `model + actions` style props.
- [ ] Render normal track rows from `trackZoneModel.tracks` by iteration (no hardcoded `synth1` row).
- [ ] Keep master row internal to `TrackZone`, keyed by `model.masterTrackId`.
- [ ] Use clip data resolved from `MidiClipStore` through constructor output; do not store clip notes in `UiPlan`.
- [ ] Keep playhead/timeline/meter behavior unchanged.
- [ ] Add/adjust tests for plan-driven track rendering.
- [ ] Mark completed.

### Task 6: Wire `App.tsx` to build UI from plan
- [ ] In `App.tsx`, import `DEFAULT_UI_PLAN`, `DEFAULT_MIDI_CLIP_STORE`, and `buildUiRuntime`.
- [ ] Build UI runtime model in `AppWithEngine`.
- [ ] Pass only `trackZoneModel` and `devicePanelModel` (+ actions) to `TrackZone` and `DevicePanel`.
- [ ] Remove remaining hardcoded UI composition logic for track/device structure.
- [ ] Keep current transport/panic/keyboard behavior unchanged.
- [ ] Mark completed.

### Task 7: Regression pass and cleanup
- [ ] Remove dead code and obsolete hardcoded constants from UI components.
- [ ] Ensure no UI component directly hardcodes device layout or track list.
- [ ] Run full validation commands and fix regressions.
- [ ] Mark completed.

## Done Criteria
- [ ] `UiPlan` is the source of UI structure for track/device layout.
- [ ] `MidiClipStore` is a separate temporary source for clip data.
- [ ] `TrackZone` and `DevicePanel` are rendered from constructor output, not hardcoded branches.
- [ ] App behavior remains unchanged and all validation commands are green.

# Plan: UI Plan Bootstrap

## Overview

Current state:
- UI composition is still hardcoded across `App.tsx`, `TrackZone.tsx`, and `DevicePanel.tsx`.
- Audio graph is already plan-driven, but UI is not.
- We keep current direct audio module interfaces for now (no DAW engine refactor in this plan).
- `useTrackSelection` still hardcodes track ids as `'synth1' | 'master'`.
- Clip note source is duplicated between playback (`useSequencer.ts`) and visual track data (`TrackZone.tsx`).
- `App.tsx` still relies on a fixed hook/module wiring shape, so plan-driven device rendering must stay compatible with React Rules of Hooks.
- `src/App.test.tsx` still validates direct `audioEngine.get*` calls inside `App`, which conflicts with target architecture (UI structure from `buildUiRuntime`).

Goal:
- Build UI from an explicit `UiPlan` model.
- Keep MIDI clip data outside `UiPlan` in a temporary `MidiClipStore`.
- Use one clip source for both playback and UI rendering.
- Keep behavior unchanged.

Scope constraints:
- Do not introduce `ProjectDocument` / `DawEngine` yet.
- Do not implement diff/patch/reconcile.
- Do not change transport/sequencer topology or TransportService public API.
- Master track is not part of `UiPlan.tracks`; it is referenced by `masterTrackId`.
- Do not implement dynamic hook invocation from plan data; keep hook usage Rules-of-Hooks-safe.

## Class Schema

- `UiPlan`
- Contains: list of regular tracks, `masterTrackId`, optional `initialTrackId`

- `UiTrackPlan`
- Contains: `trackId`, `displayName`, `trackStripId`, `clipIds`, list of `UiDevicePlan`

- `UiDevicePlan`
- Contains: `uiDeviceId`, `displayName`, `moduleId`, `moduleKind` (kind from audio-graph module kinds)

- `MidiClipStore`
- Contains: map `clipId -> MidiClip`

- `MidiClip`
- Contains: `clipId`, `startBeat` (number, beats), `lengthBeats` (number, beats), list of steps

- `MidiStep`
- Contains: on/off flag, note, velocity, gate

- `DeviceRegistry`
- Contains: mapping from `moduleKind` to UI adapter/render contract for device components

## MidiClip Data Semantics
- Step grid unit for this plan: `8n` (same feel as current sequencer; no groove change in this refactor).
- `MidiClip.startBeat`: clip start offset on track timeline in metronome beats.
- `MidiClip.lengthBeats`: loop/playback window size in beats and visual clip width basis.
- Step index inside clip is local and is mapped to transport beat via `startBeat + (localStep * STEP_BEATS)` where `STEP_BEATS = 0.5` for the `8n` grid.
- `MidiStep.gate` is normalized (`0..1`) and defines note duration as `stepDuration * gate`.
- Default gate for migrated demo clip should preserve current behavior (`0.8`).
- Sequencer timing internals are out of scope for this plan (tracked in `docs/plans/sequencer_timing_hardening.md`).

## Responsibility Boundary
- `buildUiRuntime` is a pure runtime constructor: derives UI data from `UiPlan`, `MidiClipStore`, selected track id, and engine lookup results; no hooks, no side effects.
- `DeviceRegistry` is UI adapter glue: maps `moduleKind` + resolved module handles to concrete React device components/controllers.
- `buildUiRuntime` owns fail-fast validation for ids/contracts; `DeviceRegistry` owns rendering adapter selection only.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- Manual smoke in `npm run dev`: app opens, play/pause works, keyboard note triggers sound, meters react, track/device selection works.

## E2E Selector Contract (must stay stable)
- Keep layout/surface classes stable for coarse checks (`.track-zone`, `.device-panel`, `.toolbar`, `.midi-keyboard`, `.playhead`, `.timeline-ruler`).
- For entity selection use id-based attributes, not position: `data-track-id`, `data-clip-id`, `data-device-id`.
- Scope nested controls by entity id and role (example shape: `[data-device-id="..."] [data-control="..."]`).
- Avoid `first()`/`nth()` for core assertions when id-based selectors are available.
- If selector contracts change, update this section and Playwright tests in the same PR.

## Done Criteria
- `UiPlan` is the source of UI structure for track/device layout.
- `MidiClipStore` is a separate temporary source for clip data.
- `TrackZone` and `DevicePanel` are rendered from runtime output, not hardcoded branches.
- `App.tsx` has no direct `audioEngine.get*` usage for UI structure (temporary exception: `MidiKeyboard` direct synth wiring).
- React hook usage is Rules-of-Hooks-safe for plan-driven device rendering (no dynamic hook calls inside iterated device render branches).
- Track selection ids are plan-derived strings; no hardcoded `'synth1' | 'master'` track-id union remains.
- Initial selected track follows `UiPlan` policy (`initialTrackId` if provided, otherwise first regular track).
- Track/device labels are provided by plan `displayName`; UI does not infer labels from ids.
- `src/App.test.tsx` expectations are aligned with runtime wiring contract.
- Playback and clip visualization use one source of note truth (`MidiClipStore`), with no duplicated inline note constants.
- `MidiClip` playback semantics are preserved (beat-based clip placement/length, gate-derived duration, clip window behavior).
- App behavior remains unchanged and all validation commands are green.

---

### Task 1: Add `MidiClipStore` and migrate current sequence to store
- [ ] Create `src/project-runtime/midiClipStore.ts` with `MidiStep`, `MidiClip`, `MidiClipStore` types from the schema.
- [ ] Export `DEFAULT_MIDI_CLIP_STORE` matching current sequence behavior.
- [ ] Encode and document the clip data semantics from this plan (`8n` event grid, `startBeat/lengthBeats` timeline placement, `gate` value meaning).
- [ ] Add helper accessors for clip lookup with fail-fast errors on missing clip ids.
- [ ] Introduce a sequencer clip input contract (for example: resolve clip by `clipId`) so sequencer does not own hardcoded note constants.
- [ ] Wire current playback to pass a default `clipId` and resolve clip data from `DEFAULT_MIDI_CLIP_STORE`.
- [ ] Remove duplicated inline clip-note constants from UI track rendering path; `TrackZone` clip visuals must read the same clip data source as playback.
- [ ] Keep current runtime behavior identical (same notes/order/timing).
- [ ] Add/adjust unit tests for clip store lookup and playback using store data.
- [ ] Mark completed.

### Task 2: Add `UiPlan` model and default UI plan
- [x] Already completed: `DEFAULT_PLAN_*_ID` constants in `src/engine/audioGraphPlan.ts` already include "default-plan only" comments.
- [ ] Create folder `src/ui-plan/` (separate from `src/engine/`).
- [ ] Confirm shared `moduleKind` union exists in `src/engine/types.ts`; add/align it before using `UiDevicePlan.moduleKind`.
- [ ] Create `src/ui-plan/uiPlan.ts`.
- [ ] Create `src/ui-plan/defaultUiPlan.ts` with `DEFAULT_UI_PLAN` that reflects current app layout.
- [ ] Add `displayName` for tracks/devices in the default plan; UI labels must not depend on `trackId`/`moduleId` string formatting.
- [ ] Define `initialTrackId` policy in `UiPlan`: use explicit `initialTrackId` when present, otherwise fallback to first regular track id.
- [ ] Add unit tests for `DEFAULT_UI_PLAN` shape and id consistency.
- [ ] Mark completed.

### Task 3: Add UI runtime constructor from plan
- [ ] Create `src/ui-plan/buildUiRuntime.ts`.
- [ ] Create `src/ui-plan/deviceRegistry.ts` and keep device-kind to adapter mapping centralized.
- [ ] Keep it a pure function (safe for per-render/useMemo calls); do not treat `selectedTrackId` as constructor-time immutable input.
- [ ] Input: `uiPlan`, `midiClipStore` (from `project-runtime`), `audioEngine`, `selectedTrackId`.
- [ ] Output two runtime models: `trackZoneModel` and `devicePanelModel`.
- [ ] Keep responsibility boundary strict: runtime constructor returns runtime data/contracts; `DeviceRegistry` remains separate.
- [ ] Resolve track clips by `clipIds` from `MidiClipStore` (fail-fast if a clip id is missing).
- [ ] Resolve device models by `UiDevicePlan.moduleId` and `moduleKind` (fail-fast on missing/mismatched ids).
- [ ] Use `DeviceRegistry` in renderers, so plan-driven device iteration does not require dynamic hook creation.
- [ ] Explicit rule: no `use*` hook calls inside plan/device iteration paths in `DevicePanel` and related render helpers.
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
- [ ] Add explicit TODO in `TrackZone` that master-special-case is temporary and should move to plan when master unification is in scope.
- [ ] Use clip data resolved from `MidiClipStore` through runtime output; do not store clip notes in `UiPlan`.
- [ ] Keep playhead/timeline/meter behavior unchanged.
- [ ] Add/adjust tests for plan-driven track rendering.
- [ ] Mark completed.

### Task 6: Wire `App.tsx` to build UI from plan
- [ ] In `App.tsx`, import `DEFAULT_UI_PLAN`, `DEFAULT_MIDI_CLIP_STORE`, and `buildUiRuntime`.
- [ ] Migrate `useTrackSelection` from hardcoded union ids to plan-derived `string` ids.
- [ ] Update `src/hooks/useTrackSelection.ts` and all consumers so no `'synth1' | 'master'` union remains.
- [ ] Initial selection must come from `UiPlan` policy (`initialTrackId` or first regular track fallback), not hardcoded literals.
- [ ] Build UI runtime model in `AppWithEngine`.
- [ ] Pass only `trackZoneModel` and `devicePanelModel` (+ actions) to `TrackZone` and `DevicePanel`.
- [ ] Remove remaining hardcoded UI composition logic for track/device structure.
- [ ] Keep direct `toneSynth` wiring only for `MidiKeyboard` (explicit temporary exception outside UI-structure wiring).
- [ ] Update `src/App.test.tsx` in the same task so assertions match the new runtime wiring contract.
- [ ] Keep current transport/panic/keyboard behavior unchanged.
- [ ] Mark completed.

### Task 7: Regression pass and cleanup
- [ ] Remove dead code and obsolete hardcoded constants from UI components.
- [ ] Ensure no UI component directly hardcodes device layout or track list.
- [ ] Run full validation commands and fix regressions.
- [ ] Mark completed.

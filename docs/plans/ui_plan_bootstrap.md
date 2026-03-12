# Plan: UI Plan Bootstrap

## Overview

Current state:
- UI composition is still hardcoded across `App.tsx`, `TrackZone.tsx`, and `DevicePanel.tsx`.
- Audio graph is already plan-driven, but UI is not.
- We keep current direct audio module interfaces for now (no DAW engine refactor in this plan).
- `useTrackSelection` still hardcodes track ids as `'synth1' | 'master'`.
- UI runtime still depends on clip/store integration details that must remain clip-source-driven (`MidiClipStore`), without local hardcoded clip/note constants.
- `App.tsx` still relies on a fixed hook/module wiring shape, so plan-driven device rendering must stay compatible with React Rules of Hooks.
- `src/App.test.tsx` still validates direct `audioEngine.get*` calls inside `App`, which conflicts with target architecture (UI structure from `buildUiRuntime`).

Goal:
- Build UI from an explicit `UiPlan` model.
- Keep MIDI clip data outside `UiPlan` in a temporary `MidiClipStore`.
- Keep behavior unchanged.

Scope constraints:
- Do not introduce `ProjectDocument` / `DawEngine` yet.
- Do not implement diff/patch/reconcile.
- Do not change transport/sequencer topology or TransportService public API in this plan.
- Master track remains a fixed UI row in layout, but its data/devices must come from `UiPlan.masterTrack`.
- Do not implement dynamic hook invocation from plan data; keep hook usage Rules-of-Hooks-safe.

## Class Schema

- `UiPlan`
- Contains: list of regular tracks, `masterTrack` (`UiMasterTrackPlan`), optional `initialTrackId`

- `UiTrackPlan`
- Contains: `trackId`, `displayName`, `trackStripId`, `clipIds`, list of `UiDevicePlan`

- `UiMasterTrackPlan`
- Contains: `masterTrackId`, `displayName`, `trackStripId`, list of `UiDevicePlan`

- `UiDevicePlan`
- Contains: `uiDeviceId`, `displayName`, `moduleId`, `moduleKind` (kind from audio-graph module kinds)

- `MidiClipStore`
- Contains: map `clipId -> MidiClip`

- `DeviceRegistry`
- Contains: mapping from `moduleKind` to UI adapter/render contract for device components

## ID Namespace Rules
- UI ids (`trackId`, `masterTrack.masterTrackId`, `uiDeviceId`) belong to UI-plan structure and are never used for audio-module lookup.
- Audio ids (`moduleId`, `trackStripId`) belong to audio-graph structure and are never reused as UI identity.
- Cross-namespace mapping is explicit only via link fields (`UiDevicePlan.moduleId`, `UiTrackPlan.trackStripId`), never by accidental id-string equality.
- Runtime mapping must fail fast when link fields reference missing audio ids.

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

## Acceptance Criteria
- `UiPlan` is the source of UI structure for track/device layout.
- `MidiClipStore` is a separate temporary source for clip data.
- `TrackZone` and `DevicePanel` are rendered from runtime output, not hardcoded branches.
- `App.tsx` has no direct `audioEngine.get*` usage for UI structure (temporary exception: `MidiKeyboard` direct synth wiring).
- React hook usage is Rules-of-Hooks-safe for plan-driven device rendering (no dynamic hook calls inside iterated device render branches).
- Track selection ids are plan-derived strings; no hardcoded `'synth1' | 'master'` track-id union remains.
- Initial selected track follows `UiPlan` policy (`initialTrackId` if provided, otherwise first regular track).
- Track/device labels are provided by plan `displayName`; UI does not infer labels from ids.
- UI-id namespace and audio-id namespace stay separated; cross-namespace mapping uses only explicit link fields.
- Master-track device rendering is sourced from `UiPlan.masterTrack.devices`, not hardcoded in `DevicePanel`.
- `src/App.test.tsx` expectations are aligned with runtime wiring contract.
- UI runtime consumes `MidiClipStore` outputs without reintroducing local hardcoded clip/note constants.
- App behavior remains unchanged and all validation commands are green.

---

### Task 1: Stabilize MIDI Clip Store Integration
- [x] Treat `MidiClipStore` as the authoritative clip source for UI runtime inputs.
- [x] Keep clip semantics defined in code contracts/types and consume them consistently in this plan.
- [x] Keep `buildUiRuntime`/UI render paths clip-source-driven (via resolved clip ids/store data) and avoid reintroducing local hardcoded clip/note constants.
- [x] Keep current behavior unchanged when using the default clip runtime data.
- [x] Mark completed.

### Task 2: Add `UiPlan` model and default UI plan
- [x] Create folder `src/ui-plan/` (separate from `src/engine/`).
- [x] Confirm shared `moduleKind` union exists in `src/engine/types.ts`; add/align it before using `UiDevicePlan.moduleKind`.
- [x] Create `src/ui-plan/uiPlan.ts`.
- [x] Create `src/ui-plan/defaultUiPlan.ts` with `DEFAULT_UI_PLAN` that reflects current app layout.
- [x] Define id namespace contract in `UiPlan`: stable UI ids (`trackId`, `masterTrack.masterTrackId`, `uiDeviceId`) are separate from audio ids (`moduleId`, `trackStripId`).
- [x] `DEFAULT_UI_PLAN_*_ID` constants in `src/ui-plan/defaultUiPlan.ts` should include "default-ui-plan only" comments.
- [x] Model master devices explicitly in `UiPlan.masterTrack.devices` (same `UiDevicePlan[]` contract as regular tracks).
- [x] Add `displayName` for tracks/devices in the default plan; UI labels must not depend on `trackId`/`moduleId` string formatting.
- [x] Define `initialTrackId` policy in `UiPlan`: use explicit `initialTrackId` when present, otherwise fallback to first regular track id.
- [x] Add unit tests for `DEFAULT_UI_PLAN` shape, UI-id uniqueness, and referential consistency (`moduleId`/`trackStripId` links), including `masterTrack.devices`.
- [x] Mark completed.

### Task 3: Add UI runtime constructor from plan
- [x] Create `src/ui-plan/buildUiRuntime.ts`.
- [x] Create `src/ui-plan/deviceRegistry.ts` and keep device-kind to adapter mapping centralized.
- [x] Keep it a pure function (safe for per-render/useMemo calls); do not treat `selectedTrackId` as constructor-time immutable input.
- [x] Input: `uiPlan`, `midiClipStore` (from `project-runtime`), `audioEngine`, `selectedTrackId`.
- [x] Output two runtime models: `trackZoneModel` and `devicePanelModel`.
- [x] Keep responsibility boundary strict: runtime constructor returns runtime data/contracts; `DeviceRegistry` remains separate.
- [x] Resolve track clips by `clipIds` from `MidiClipStore` (fail-fast if a clip id is missing).
- [x] Resolve device models by `UiDevicePlan.moduleId` and `moduleKind` (fail-fast on missing/mismatched ids) for both regular tracks and `masterTrack`.
- [x] Enforce namespace safety in runtime mapping: resolve audio modules only via explicit audio link fields, never via UI ids.
- [x] Use `DeviceRegistry` in renderers, so plan-driven device iteration does not require dynamic hook creation.
- [x] Explicit rule: no `use*` hook calls inside plan/device iteration paths in `DevicePanel` and related render helpers.
- [x] Add unit tests for success path and fail-fast path.
- [x] Mark completed.

### Task 4: Refactor `DevicePanel` to model-driven rendering
- [ ] Replace hardcoded `synth/panner/limiter` branch rendering with iteration over `devicePanelModel.devices`.
- [ ] When master is selected, `devicePanelModel.devices` must come from `UiPlan.masterTrack.devices` (no master-device hardcoded branch).
- [ ] Keep existing device components (`SynthDevice`, `PannerDevice`, `LimiterDevice`).
- [ ] Choose component by `moduleKind` from `UiDevicePlan`.
- [ ] Preserve existing visible behavior and CSS selectors used by e2e tests.
- [ ] Add/adjust tests for selected-track device list rendering.
- [ ] Mark completed.

### Task 5: Refactor `TrackZone` to model-driven rendering
- [ ] Replace fat prop list with `model + actions` style props.
- [ ] Render normal track rows from `trackZoneModel.tracks` by iteration (no hardcoded `synth1` row).
- [ ] Keep master row internal to `TrackZone`, but source its id/label/strip refs from `model.masterTrack` (no hardcoded master identifiers).
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

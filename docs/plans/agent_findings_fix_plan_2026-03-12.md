# Agent Findings Fix Plan (2026-03-12)

## Scope
Consolidated and deduplicated plan based on 5 agent reports. Grouped by impact area and claim type.

## Priority 0: Runtime correctness

### R1. Remove hardcoded `APP_*` module assumptions in `App.tsx`
- Area: `src/App.tsx`
- Claims merged:
  - hardcoded module IDs from default/first track
  - repeated remapping (`engine -> buildUiRuntime -> App override`)
  - startup failures for non-default plan shapes
- Fix:
  - choose one boundary of truth:
    - either App resolves modules from IDs returned by runtime model, or
    - runtime returns final bound modules and App stops remapping.
  - remove `APP_SYNTH_MODULE_ID`, `APP_PANNER_MODULE_ID`, `APP_TRACK_STRIP_ID`, `APP_LIMITER_MODULE_ID`, `APP_MASTER_STRIP_ID`.

### R2. Track actions: remove runtime `.find(...)` dispatch and stale UI path
- Area: `src/App.tsx`, `src/components/TrackZone.tsx`
- Claims merged:
  - per-action `.find(...)` and branch by `trackStripId`
  - non-primary track mute/volume can mutate engine without guaranteed React rerender
- Fix:
  - build per-track action handlers once during runtime/model assembly.
  - ensure every mute/volume/rec-arm action updates React-visible state.

### R3. MIDI keyboard enablement must follow current policy, not boot-time track
- Area: `src/App.tsx`
- Claims merged:
  - `MidiKeyboard.enabled` tied to `INITIAL_TRACK_ID`
- Fix:
  - compute enablement from selected track or explicit policy (`any armed regular track`).

### R4. Transport should react to `sequencerClip` changes
- Area: `src/hooks/useTransportController.ts`
- Claims merged:
  - `sequencerClip` captured once at core creation
- Fix:
  - recreate/swap core clip input when `sequencerClip` changes.

### R5. Fail-fast validation hardening
- Area: `src/ui-plan/deviceRegistry.ts`, `src/ui-plan/uiPlan.ts`
- Claims merged:
  - `moduleKind in DEVICE_REGISTRY` should be own-property check
  - `resolveInitialTrackId` should validate membership in regular/master track IDs
- Fix:
  - use `Object.hasOwn(...)`/`hasOwnProperty.call(...)`.
  - throw specific config errors early for invalid `initialTrackId`.

## Priority 1: Architecture simplification

### A1. Reduce abstraction layers in UI runtime build path
- Area: `src/ui-plan/buildUiRuntime.ts`, `src/App.tsx`
- Claims merged:
  - duplicated shaping (`ResolvedTrackRuntime` + projection pass)
  - excessive runtime object adaptation
- Fix:
  - build `trackZoneModel` + selected-device data in one pass.
  - keep intermediate structs only if reused independently.

### A2. Lazy device resolution for selected scope
- Area: `src/ui-plan/buildUiRuntime.ts`
- Claims merged:
  - all regular/master devices resolved eagerly even when not selected
  - unrelated failures can block selected-track render
- Fix:
  - always resolve track list metadata.
  - resolve device modules only for selected track; master only when selected.

### A3. Simplify DevicePanel rendering contract
- Area: `src/ui-plan/deviceRegistry.ts`, `src/components/DevicePanel.tsx`
- Claims merged:
  - registry indirection + `as` casts for fixed known kinds
- Fix:
  - use discriminated union + direct `switch (moduleKind)` in panel rendering.

### A4. Track selection API cleanup
- Area: `src/hooks/useTrackSelection.ts`
- Claims merged:
  - duplicated APIs (`createTrackSelection`, hook, context), only hook used in runtime
- Fix:
  - keep one runtime API; remove unused context/non-React layer unless consumer exists.

### A5. Startup constants simplification
- Area: `src/App.tsx`
- Claims merged:
  - deriving multiple static `APP_*` constants from `DEFAULT_UI_PLAN` adds failure modes
- Fix:
  - replace with single focused selector (if needed once) or remove entirely with R1.

## Priority 2: Test coverage gaps

### T1. `App.test.tsx`
- Add interaction coverage for `TrackZone` callbacks:
  - `setTrackMute`, `setTrackVolume`, `setTrackRecEnabled`, `selectTrack`
  - assert routing for primary vs non-primary tracks and rerender behavior.

### T2. `TrackZone.test.tsx`
- Add control interaction tests:
  - `.track-mute`, `.track-rec`, `.track-volume`, `.master-volume`
  - verify propagation rules inside clickable rows (`selectTrack` called or suppressed correctly).

### T3. `useTransportController.test.ts`
- Add hook-level tests for:
  - default clip-source wiring
  - custom clip-source propagation
  - clip-source update behavior (post-fix for R4).

### T4. `buildUiRuntime.test.ts`
- Add fail-fast tests for unknown:
  - `track.trackStripId`
  - `masterTrack.trackStripId`.

### T5. `DevicePanel.test.tsx`
- Replace static component mocks with prop-aware mocks/spies.
- Assert expected module instances/prop keys are passed through render path.

### T6. `defaultUiPlan.test.ts`
- Add throw case for empty `tracks` with missing `initialTrackId`.

### T7. `midiClipStore.test.ts`
- Add throw case for `resolveMidiClipSourceOrThrow` when `clipId` is missing.

### T8. `useTrackSelection.test.ts`
- Add hook tests for:
  - initial value
  - update behavior
  - empty-default behavior.

## Priority 3: Documentation sync

### D1. Runtime plan docs
- Area: repository docs
- Claims merged:
  - no README section for plan-driven UI runtime behavior
  - `README.md` file currently absent
- Fix:
  - either create `README.md` (recommended) or document in existing canonical doc.
  - include: `DEFAULT_UI_PLAN` source, `buildUiRuntime` role, UI-visible mapping rules.

### D2. `CLAUDE.md` architecture/orchestration update
- Update sections:
  - architecture ID namespace rules (`trackId/masterTrackId/uiDeviceId` vs `moduleId/trackStripId`)
  - orchestration path (`buildUiRuntime(...)`, `TrackZone model+actions`, `DevicePanelModel`)
  - key files index (add ui-plan + midi clip runtime files)
  - implementation-plan pointer (active plans vs completed `ui_plan_bootstrap`).

## Execution order
1. R1-R5 (runtime correctness + fail-fast checks)
2. T1-T8 for changed behavior
3. A1-A5 simplifications (safe refactors after behavior lock)
4. D1-D2 docs alignment

## Done criteria
- All runtime fixes implemented and covered by unit tests.
- Existing E2E scenarios remain green.
- Docs reflect current runtime architecture and active plan pointers.

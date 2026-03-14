---
phase: 04-component-migration-track-crud
plan: 01
subsystem: ui
tags: [react, typescript, reducer, context, audio-engine, track-crud, rec-arm]

# Dependency graph
requires:
  - phase: 03-app-tsx-teardown
    provides: DawProvider + DawStore context stack wiring, Layout.tsx with module-level engine graphs
  - phase: 02-reducer-context
    provides: DawAction union, uiReducer, projectReducer, DawStore, DawProvider infrastructure

provides:
  - recArmByTrackId in UiState (per-track rec-arm state surviving add/remove)
  - SET_REC_ARM action in DawAction union with full lifecycle handling
  - DawStore.setRecArm + DawDispatch.setRecArm method
  - useTrackFacade hook for per-track engine facade with React state
  - Layout.tsx reads selectedTrackId from context (COMP-07 complete)
  - buildUiRuntime function removed — CRUD blocker eliminated
  - legacyEngineAdapter removed from Layout.tsx

affects:
  - 04-02-TrackZone migration (uses useTrackFacade)
  - 04-03-MidiKeyboard migration (uses recArmByTrackId from context)
  - future track CRUD features (buildUiRuntime blocker gone)

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react (devDep, unblocked pre-existing build type error)"
  patterns:
    - "useTrackFacade: per-track engine facade hook with local reactive state (get from singleton, sync on write)"
    - "Rec-arm lifecycle: ADD_TRACK auto-arms, REMOVE_TRACK cleans up, SET_REC_ARM sets"
    - "Inline model assembly in Layout.tsx instead of buildUiRuntime runtime resolution"

key-files:
  created:
    - src/hooks/useTrackFacade.ts
  modified:
    - src/state/types.ts (recArmByTrackId in UiState)
    - src/state/actions.ts (SET_REC_ARM action)
    - src/state/uiReducer.ts (ADD_TRACK auto-arm, REMOVE_TRACK cleanup, SET_REC_ARM handler)
    - src/state/projectReducer.ts (SET_REC_ARM passthrough)
    - src/state/defaultState.ts (recArmByTrackId default)
    - src/state/DawStore.ts (setRecArm method)
    - src/context/DawProvider.tsx (setRecArm in DawDispatch interface + useMemo)
    - src/components/Layout.tsx (COMP-07: context wiring, buildUiRuntime/legacyEngineAdapter removed)
    - src/ui-plan/buildUiRuntime.ts (stripped to types-only)
    - src/state/uiReducer.test.ts (fixture updated for recArmByTrackId)
    - src/state/dawReducer.test.ts (fixture updated for recArmByTrackId)

key-decisions:
  - "buildUiRuntime.test.ts deleted — tested function no longer exists (same precedent as useAudioEngine.test.tsx)"
  - "buildUiRuntime.ts kept as types-only — DevicePanelModel/UiRuntimeDeviceModel/UiRuntimeClipModel still consumed by TrackZone/DevicePanel until 04-03"
  - "REMOVE_TRACK always returns new object (recArmByTrackId cleanup) — previous same-reference optimization dropped"
  - "@testing-library/react installed as devDep to fix pre-existing build type error in DawProvider.test.tsx"
  - "setTrackMute/setTrackVolume in trackZoneActions remain single-track transitional — 04-02 will route per-track via useTrackFacade"

patterns-established:
  - "useTrackFacade: wraps engine singleton facade, seeds React state from getGain()/isMuted() at mount, syncs on write"
  - "Rec-arm in reducer: ADD_TRACK auto-arms new track, REMOVE_TRACK always cleans up entry for removed track"
  - "Layout.tsx model assembly: build TrackZoneModel/DevicePanelModel inline from hooks + context, not via runtime resolver"

# Metrics
duration: 6min
completed: 2026-03-13
---

# Phase 04 Plan 01: Pre-migration Cleanup Summary

**Removed buildUiRuntime/legacyEngineAdapter CRUD blocker, wired Layout.tsx selectedTrackId from context (COMP-07), added rec-arm reducer lifecycle, and created useTrackFacade hook**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-13T21:03:12Z
- **Completed:** 2026-03-13T21:09:00Z
- **Tasks:** 2
- **Files modified:** 12 (including 2 test files)

## Accomplishments
- buildUiRuntime() call and legacyEngineAdapter removed from Layout.tsx — CRUD operations no longer blocked by static UI plan
- Layout.tsx reads selectedTrackId and recArmByTrackId from useUiState() context, dispatches through useDawDispatch() (COMP-07)
- recArmByTrackId added to UiState with full ADD_TRACK/REMOVE_TRACK/SET_REC_ARM lifecycle in uiReducer
- useTrackFacade hook created — per-track engine facade wrapper for TrackZone migration (Plan 04-02)
- DawDispatch.setRecArm method added and wired through DawStore + DawProvider

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rec-arm to reducer and create useTrackFacade hook** - `d438a6c` (feat)
2. **Task 2: Remove buildUiRuntime + legacyEngineAdapter, wire selection from context** - `c51401a` (feat)

**Plan metadata:** (next commit — docs)

## Files Created/Modified
- `src/hooks/useTrackFacade.ts` - Created: per-track engine facade hook with reactive gain/muted state
- `src/state/types.ts` - Added recArmByTrackId field to UiState interface
- `src/state/actions.ts` - Added SetRecArmAction and added to DawAction union
- `src/state/uiReducer.ts` - ADD_TRACK auto-arms, REMOVE_TRACK cleans up, SET_REC_ARM handler
- `src/state/projectReducer.ts` - Added SET_REC_ARM passthrough case
- `src/state/defaultState.ts` - DEFAULT_UI_STATE includes recArmByTrackId
- `src/state/DawStore.ts` - setRecArm(trackId, armed) method
- `src/context/DawProvider.tsx` - setRecArm in DawDispatch interface and useMemo dispatch object
- `src/components/Layout.tsx` - COMP-07: useUiState/useDawDispatch, inline model assembly, no buildUiRuntime
- `src/ui-plan/buildUiRuntime.ts` - Stripped to types-only (DevicePanelModel, UiRuntimeDeviceModel, UiRuntimeClipModel)
- `src/state/uiReducer.test.ts` - Updated makeUi fixture for recArmByTrackId, updated same-reference test
- `src/state/dawReducer.test.ts` - Updated makeState fixture for recArmByTrackId
- `src/ui-plan/buildUiRuntime.test.ts` - Deleted (tested function removed)
- `package.json / package-lock.json` - @testing-library/react devDep added

## Decisions Made
- `buildUiRuntime.test.ts` deleted (not migrated) — same precedent as `useAudioEngine.test.tsx` and `App.test.tsx`; tests for a function that no longer exists
- `buildUiRuntime.ts` kept as types-only file — `DevicePanelModel`, `UiRuntimeDeviceModel`, `UiRuntimeClipModel` still consumed by TrackZone.tsx and DevicePanel.tsx; Plan 04-03 moves them and deletes the file
- `REMOVE_TRACK` no longer returns same object reference for non-selected removal — the recArmByTrackId cleanup always produces a new object; same-reference optimization dropped
- `@testing-library/react` installed as devDep to resolve pre-existing build type error (DawProvider.test.tsx was written with skipped tests expecting the package would be installed)
- `setTrackMute` and `setTrackVolume` in trackZoneActions remain single-track transitional wiring — Plan 04-02 will route per-track through useTrackFacade

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test fixtures for recArmByTrackId field**
- **Found during:** Task 1 (after running npm run test)
- **Issue:** uiReducer.test.ts and dawReducer.test.ts used hardcoded UiState fixtures without recArmByTrackId; 9 tests failed with "Cannot destructure 'state.recArmByTrackId' as it is undefined"
- **Fix:** Updated makeUi() to accept recArmByTrackId parameter, updated makeState() to include recArmByTrackId, updated same-reference test to reflect new behavior (cleanup always returns new object)
- **Files modified:** src/state/uiReducer.test.ts, src/state/dawReducer.test.ts
- **Verification:** All 244 tests pass
- **Committed in:** d438a6c (Task 1 commit)

**2. [Rule 3 - Blocking] Installed @testing-library/react to fix pre-existing build failure**
- **Found during:** Task 2 (npm run build)
- **Issue:** DawProvider.test.tsx imported @testing-library/react (not installed); tsc -b included test files; build was already failing before Task 2 changes
- **Fix:** npm install -D @testing-library/react
- **Files modified:** package.json, package-lock.json
- **Verification:** npm run build passes
- **Committed in:** c51401a (Task 2 commit)

**3. [Rule 1 - Bug] Deleted buildUiRuntime.test.ts**
- **Found during:** Task 2 (npm run build after stripping buildUiRuntime.ts to types-only)
- **Issue:** buildUiRuntime.test.ts imports { buildUiRuntime } which no longer exists; tsc reported TS2305
- **Fix:** Deleted file — same precedent as useAudioEngine.test.tsx and App.test.tsx deletions in prior phases
- **Files modified:** src/ui-plan/buildUiRuntime.test.ts (deleted)
- **Verification:** npm run build passes, test count decreased by 7 (all 244 remaining pass)
- **Committed in:** c51401a (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug — stale test fixtures, 1 blocking — missing devDep, 1 bug — deleted test for removed function)
**Impact on plan:** All auto-fixes necessary for correctness and build health. No scope creep.

## Issues Encountered
- Pre-existing build failure from DawProvider.test.tsx importing @testing-library/react (not installed). Resolved by installing devDep — unblocked the npm run build success criterion.

## Next Phase Readiness
- Plan 04-02 (TrackZone migration): useTrackFacade hook is ready; Layout.tsx selectedTrackId comes from context
- Plan 04-03 (MidiKeyboard + DevicePanel): recArmByTrackId in context is ready; DawDispatch.setRecArm is ready
- buildUiRuntime.ts types still referenced by TrackZone.tsx and DevicePanel.tsx — 04-03 cleans these up
- _legacy.getTrackStripGraph still used in Layout.tsx module scope — Phase 4 device CRUD will replace

---
*Phase: 04-component-migration-track-crud*
*Completed: 2026-03-13*

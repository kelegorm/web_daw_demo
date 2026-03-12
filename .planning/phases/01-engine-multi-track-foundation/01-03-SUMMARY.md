---
phase: 01-engine-multi-track-foundation
plan: "03"
subsystem: app-bootstrap
tags: [react, singleton, typescript, bridge-adapter, audio-wiring]

requires:
  - 01-engine-multi-track-foundation/01-01
  - 01-engine-multi-track-foundation/01-02

provides:
  - "App.tsx uses getAudioEngine() singleton, not useAudioEngine() hook"
  - "synthGraph/pannerGraph created at module level, wired into singleton's track-1 strip"
  - "legacyEngineAdapter implements AudioEngine interface from singleton internals"
  - "MasterFacade (setGain/getGain) wrapped into MasterStripHook (setMasterVolume/masterVolume)"
  - "useAudioEngine.ts and useAudioEngine.test.tsx deleted from codebase"
  - "buildUiRuntime.ts unchanged — receives AudioEngine adapter for device resolution"
  - "Pre-existing type error in engineSingleton.test.ts fixed (createGain mock cast)"

affects:
  - phase-2 (reducer/context state management will replace legacyEngineAdapter with clean facade-based access)
  - phase-3 (device CRUD will manage synthGraph/pannerGraph lifecycle)

tech-stack:
  added: []
  patterns:
    - "Adapter pattern: legacyEngineAdapter wraps singleton internals behind AudioEngine interface for backward-compat"
    - "MasterFacade -> MasterStripHook bridge via module-level adapter object"
    - "Module-level singleton wiring: createToneSynth/createPanner at module scope, never recreated"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/App.test.tsx
    - src/engine/engineSingleton.test.ts
  deleted:
    - src/hooks/useAudioEngine.ts
    - src/hooks/useAudioEngine.test.tsx

key-decisions:
  - "legacyEngineAdapter wraps singleton internals — buildUiRuntime.ts receives unchanged AudioEngine interface"
  - "MasterFacade bridge at module level rather than exposing masterStripGraph on _legacy — minimal interface expansion"
  - "App.tsx wires synth->panner->track1Strip at module level to match singleton's pre-built limiter->master chain"
  - "useAudioEngine.test.tsx deleted (not updated) — the disposal/recreation pattern no longer exists to test"

duration: 5min
completed: 2026-03-12
---

# Phase 1 Plan 3: App.tsx Singleton Migration Summary

**App.tsx migrated from useAudioEngine() + APP_* constants to getAudioEngine() singleton; synthGraph/pannerGraph wired into singleton's track-1 strip via legacyEngineAdapter; useAudioEngine.ts deleted**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T20:44:05Z
- **Completed:** 2026-03-12T20:49:09Z
- **Tasks:** 2
- **Files modified:** 3
- **Files deleted:** 2

## Accomplishments

- Replaced `useAudioEngine()` hook with direct `getAudioEngine()` singleton call in App.tsx
- Created `_synthGraph` and `_pannerGraph` at module level using `createToneSynth()` and `createPanner()` factory functions
- Wired the audio chain: synth output -> panner input (`_pannerGraph.connectSource(_synthGraph.getOutput())`), then panner output -> singleton track-1 strip input (`_pannerGraph.output.connect(_track1Strip.input)`)
- Built `legacyEngineAdapter` implementing the `AudioEngine` interface from singleton internals, passed to `buildUiRuntime` unchanged
- Wrapped `MasterFacade` (uses `setGain/getGain`) into a `MasterStripHook`-compatible object (uses `setMasterVolume/masterVolume`) to bridge API mismatch without modifying the singleton
- Replaced all five `APP_*` constants with `DEFAULT_PLAN_*_ID` imports from `audioGraphPlan.ts`
- Removed `findDeviceModuleIdByKindOrThrow` function and `INITIAL_TRACK_PLAN` lookup
- Flattened `AppWithEngine` component back into `App` (no null-engine loading guard — singleton is always available)
- Deleted `src/hooks/useAudioEngine.ts` and `src/hooks/useAudioEngine.test.tsx`
- Updated `App.test.tsx` to mock `engineSingleton` instead of `useAudioEngine`
- Fixed pre-existing type error in `engineSingleton.test.ts` (lines 179, 200): `vi.fn(() => mockPreLimiterBusGainNode)` cast to `unknown as typeof mockAudioContext.createGain` to satisfy strict `tsc -b` compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate App.tsx to getAudioEngine() singleton and legacyEngineAdapter** - `f516f7a` (feat)
2. **Task 2: Delete useAudioEngine.ts and verify zero APP_* constants remain** - `059826a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/App.tsx` — uses `getAudioEngine()` from singleton; module-level `_synthGraph`, `_pannerGraph`, `_track1Strip`, `_limiterGraph`, `_masterStripHook`, `legacyEngineAdapter`; flattened to single `App` component
- `src/App.test.tsx` — updated to mock `engineSingleton.getAudioEngine()`, `createToneSynth`, `createPanner` instead of `useAudioEngine`
- `src/engine/engineSingleton.test.ts` — fixed pre-existing type error in `createGain` mock assignment (lines 179, 200)
- `src/hooks/useAudioEngine.ts` — DELETED
- `src/hooks/useAudioEngine.test.tsx` — DELETED

## Decisions Made

- `legacyEngineAdapter` is built at module level as a plain object implementing `AudioEngine` — this keeps `buildUiRuntime.ts` entirely unchanged while providing a clean migration bridge
- `MasterFacade` interface (`setGain/getGain`) does not match `MasterStripHook` (`setMasterVolume/masterVolume`). Rather than adding `setMasterVolume` to `MasterFacade` (which would conflate domain naming conventions), a module-level `_masterStripHook` adapter wraps the facade
- `useAudioEngine.test.tsx` was deleted rather than updated — the test validated the React-lifecycle disposal/recreation pattern which no longer exists. Keeping it would require mocking the singleton to simulate a pattern that's intentionally gone

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing type error in engineSingleton.test.ts build compilation**

- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `mockAudioContext.createGain = vi.fn(() => mockPreLimiterBusGainNode)` on lines 179 and 200 caused `tsc -b` to fail with TS2322. The mock return type didn't match `GainNode`. This blocked production builds (existed since Plan 01-02).
- **Fix:** Added `as unknown as typeof mockAudioContext.createGain` cast on both lines
- **Files modified:** `src/engine/engineSingleton.test.ts`
- **Committed in:** `f516f7a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 pre-existing bug in test type annotations)
**Impact on plan:** Fix was necessary for `npm run build` to pass. No production code changes.

## Issues Encountered

- `MasterFacade.getGain()/setGain()` vs `MasterStripHook.masterVolume/setMasterVolume()` naming mismatch required an explicit bridge adapter. The interfaces serve different domains (facade vs hook) but represent the same underlying audio parameter — an intentional API design choice from Plan 01-01.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 2 (reducer/context state management) can now add track operations through `getAudioEngine().createTrackSubgraph()` and `removeTrackSubgraph()` without touching App.tsx's device wiring
- `legacyEngineAdapter` is explicitly labelled "legacy" — Phase 2 planning should lock down when it gets replaced with proper facade-based access in `buildUiRuntime`
- `_legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` usage in App.tsx is the last consumer of the `_legacy` API — Phase 3 device CRUD will replace this with proper device chain management

---
*Phase: 01-engine-multi-track-foundation*
*Completed: 2026-03-12*

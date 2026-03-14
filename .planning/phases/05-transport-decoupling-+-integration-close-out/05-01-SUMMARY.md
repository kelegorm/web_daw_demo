---
phase: 05-transport-decoupling-+-integration-close-out
plan: "01"
subsystem: ui
tags: [react, transport, sequencer, audio-engine, hooks, typescript]

# Dependency graph
requires:
  - phase: 04-component-migration-track-crud
    provides: TrackFacade with setMute(), Layout.tsx with Phase 5 seam props

provides:
  - useTransportController decoupled from TrackStripHook — accepts plain callback
  - Sequencer.dispose() for per-track Part cleanup (v2 infrastructure)
  - EngineApi.connectToTrackInput() for type-safe device chain wiring
  - Layout.tsx free of useTrackStrip import and _legacy.getTrackStripGraph call

affects:
  - 05-02-PLAN.md (Transport context integration — builds on decoupled controller)
  - 05-03-PLAN.md (Integration close-out)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain callback over hook reference — useTransportController accepts (muted: boolean) => void instead of TrackStripHook"
    - "Engine facade wiring API — connectToTrackInput() as type-safe bridge for device chain -> track strip connections"
    - "Sequencer.dispose() without global transport stop — per-track Part cleanup that doesn't halt global Tone.js transport"

key-files:
  created: []
  modified:
    - src/hooks/useTransportController.ts
    - src/hooks/useSequencer.ts
    - src/components/Layout.tsx
    - src/engine/engineSingleton.ts
    - src/state/DawStore.test.ts
    - src/context/DawProvider.test.tsx

key-decisions:
  - "connectToTrackInput() added to EngineApi to replace _legacy.getTrackStripGraph in panner wiring — keeps _legacy usage out of Layout.tsx while preserving audio graph correctness"
  - "Sequencer.dispose() deliberately does NOT call transport.stop() or panic() — caller decides whether to halt transport and send note-offs"
  - "setTrackMuted callback wired through getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute() in Layout.tsx — facade pattern, no direct strip access"

patterns-established:
  - "Test mock factories for EngineApi must include all EngineApi interface methods — connectToTrackInput added to both DawStore.test.ts and DawProvider.test.tsx mocks"

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 5 Plan 01: Transport Decoupling + Sequencer Infrastructure Summary

**Transport controller decoupled from TrackStripHook via plain callback; Sequencer gains dispose() for v2 multi-track; Layout.tsx eliminated _legacy.getTrackStripGraph via new EngineApi.connectToTrackInput()**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T22:24:39Z
- **Completed:** 2026-03-13T22:28:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `useTransportController` now accepts `setTrackMuted: (muted: boolean) => void` — no TrackStripHook import or dependency
- `Sequencer` interface has `dispose()` that stops the Part without touching global Tone.js transport (forward-looking infrastructure for v2 multi-track sequencing)
- `Layout.tsx` imports neither `useTrackStrip` nor calls `_legacy.getTrackStripGraph` — both concerns eliminated
- `EngineApi.connectToTrackInput(trackId, sourceNode)` added as type-safe bridge for device chain wiring
- All 244 Vitest tests pass; build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Decouple useTransportController from TrackStripHook + add Sequencer.dispose()** - `81f04ff` (refactor)
2. **Task 2: Remove _legacy usage and useTrackStrip from Layout.tsx** - `aba0231` (refactor)

**Plan metadata:** (to be committed with SUMMARY.md and STATE.md)

## Files Created/Modified

- `src/hooks/useTransportController.ts` — replaced `trackStrip: TrackStripHook` param with `setTrackMuted: (muted: boolean) => void`; removed TrackStripHook import
- `src/hooks/useSequencer.ts` — added `dispose()` to Sequencer interface and createSequencer factory
- `src/components/Layout.tsx` — removed useTrackStrip import and hook call; wired transport via engine facade callback; replaced panner wiring via connectToTrackInput()
- `src/engine/engineSingleton.ts` — added `connectToTrackInput(trackId, sourceNode)` to EngineApi interface and implementation
- `src/state/DawStore.test.ts` — updated createMockEngine() with connectToTrackInput mock
- `src/context/DawProvider.test.tsx` — updated createMockEngine() with connectToTrackInput mock

## Decisions Made

- **connectToTrackInput() added to EngineApi:** The plan required `getTrackStripGraph` to be absent from Layout.tsx, but the panner->track strip audio wiring still needed to happen. Rather than using `_legacy.getTrackStripGraph` inline (which would violate the success criterion), a new `connectToTrackInput(trackId, sourceNode)` method was added to `EngineApi`. This is a non-breaking, forward-compatible addition that moves device chain wiring behind the facade boundary.

- **Sequencer.dispose() scope:** dispose() deliberately does NOT call `transport.stop()` or `panic()`. Per plan spec, it is infrastructure for v2 multi-track sequencing. Caller retains control over whether to halt global transport and send note-offs.

- **setTrackMuted callback inline in Layout:** The callback `(muted) => getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute(muted)` is an arrow function created each render. This is acceptable because `useTransportController` stores it in a ref (`setTrackMutedRef`) and never uses it as a hook dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added connectToTrackInput() to EngineApi**

- **Found during:** Task 2 (Remove _legacy usage and useTrackStrip from Layout.tsx)
- **Issue:** Plan success criterion required "no _legacy.getTrackStripGraph call" in Layout.tsx, but panner output still needed to connect to the track strip input AudioNode. TrackFacade interface has no audio node accessor — correctly so by design. The only existing path was `_legacy.getTrackStripGraph().input`.
- **Fix:** Added `connectToTrackInput(trackId: string, sourceNode: AudioNode): void` to `EngineApi` interface and `createEngineInternal()` implementation. Layout.tsx uses `_singletonEngine.connectToTrackInput(DEFAULT_TRACK_ID, _pannerGraph.output)`.
- **Files modified:** `src/engine/engineSingleton.ts`, `src/components/Layout.tsx`, `src/state/DawStore.test.ts`, `src/context/DawProvider.test.tsx`
- **Verification:** Build passes, 244 tests pass, no `getTrackStripGraph` in Layout.tsx
- **Committed in:** `aba0231` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical API)
**Impact on plan:** Auto-fix necessary to satisfy "no _legacy.getTrackStripGraph call" success criterion while preserving audio graph wiring. Adds one well-scoped method to EngineApi; no scope creep.

## Issues Encountered

None — the connectToTrackInput deviation was the only surprise and was handled inline per deviation Rule 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useTransportController` is now fully decoupled from audio hook specifics — ready for Plan 05-02 to put transport state in context
- `Sequencer.dispose()` is in place — ready to wire to REMOVE_TRACK when per-track sequencer Parts exist (05-02 or 05-03)
- Layout.tsx has no useTrackStrip — the hook still exists in the codebase but is no longer called from the main layout
- Remaining blocker: `_legacy.limiterGraph` still used in Layout.tsx for useLimiter (out of scope for this plan, targeted in later Phase 5 plans)

---
*Phase: 05-transport-decoupling-+-integration-close-out*
*Completed: 2026-03-13*

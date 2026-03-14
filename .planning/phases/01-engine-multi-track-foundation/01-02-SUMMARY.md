---
phase: 01-engine-multi-track-foundation
plan: "02"
subsystem: audio-engine
tags: [web-audio-api, singleton, typescript, track-facade, vitest, dispose-guard]

requires:
  - 01-engine-multi-track-foundation/01-01

provides:
  - "TrackFacadeImpl class with private-field dispose guard (not exported)"
  - "createTrackSubgraph(trackId): creates TrackStripGraph, wraps in facade, connects to preLimiterBus"
  - "removeTrackSubgraph(trackId): disconnects from preLimiterBus before dispose, removes from registry"
  - "getTrackFacade(trackId): returns existing facade or throws [engine] unknown track"
  - "DEFAULT_TRACK_ID constant exported ('track-1')"
  - "Default track bootstrapped on engine init (track-1 always exists)"
  - "_legacy.getTrackStripGraph(trackId) for backward-compat migration in Plans 01-03 and Phase 2-3"
  - "31 unit tests covering all track lifecycle paths"

affects:
  - 01-engine-multi-track-foundation/01-03 (synth wiring into track-1 subgraph via _legacy.getTrackStripGraph)
  - phase-2 (reducer/context state management calls createTrackSubgraph/removeTrackSubgraph on engine)
  - phase-3 (device facade CRUD adds devices to track._stripInput chain)

tech-stack:
  added: []
  patterns:
    - "Private class fields (#field) for encapsulation and dispose guard without WeakRef overhead"
    - "Disconnect-before-dispose ordering on removeTrackSubgraph (prevents Web Audio API InvalidStateError)"
    - "Const array mutation pattern for vi.mock closure compatibility (createdStrips.length = 0)"

key-files:
  created: []
  modified:
    - src/engine/engineSingleton.ts
    - src/engine/engineSingleton.test.ts

key-decisions:
  - "TrackFacadeImpl uses private class fields (#disposed, #strip) — provides true encapsulation without exposing strip to interface consumers"
  - "tracks Map stores { facade, strip } pair — strip reference needed for _legacy.getTrackStripGraph without re-exposing it on TrackFacade interface"
  - "disconnect called on facade._stripOutput (not strip.output directly) to avoid accessing #strip after potential dispose"
  - "vi.mock closure requires const array mutated in place (createdStrips.length = 0) rather than reassignment — reassignment breaks closure reference"

patterns-established:
  - "Dispose guard pattern: #assertNotDisposed() at top of every public method"
  - "Track registry as Map<string, { facade, strip }> — facades for external API, strips for internal/legacy access"

duration: 5min
completed: 2026-03-12
---

# Phase 1 Plan 2: Track Subgraph Lifecycle Summary

**TrackFacadeImpl with private-field dispose guard, createTrackSubgraph/removeTrackSubgraph/getTrackFacade on engine singleton, default track-1 bootstrapped on init, 31 passing unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T20:35:15Z
- **Completed:** 2026-03-12T20:40:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `TrackFacadeImpl` class with private fields (`#disposed`, `#strip`) and a dispose guard that throws on all method calls after disposal
- `createTrackSubgraph(trackId)` creates a `TrackStripGraph`, wraps it in a `TrackFacadeImpl`, connects `strip.output` to `preLimiterBus`, and stores in a `Map<string, { facade, strip }>`
- `removeTrackSubgraph(trackId)` disconnects from `preLimiterBus` BEFORE disposing nodes (critical ordering per RESEARCH.md Pitfall 3), then removes from registry
- `getTrackFacade(trackId)` returns the facade or throws `[engine] unknown track: {trackId}`
- Default track (`track-1`) bootstrapped via an internal `createTrackSubgraphInternal` call at the end of `createEngineInternal` — track-1 always exists from the first `getAudioEngine()` call
- Exported `DEFAULT_TRACK_ID = 'track-1'` constant
- Added `_legacy.getTrackStripGraph(trackId)` for Plans 01-03 and Phase 2-3 migration — returns the raw `TrackStripGraph` without exposing it on the `TrackFacade` interface
- Added 22 new unit tests across 5 groups (default bootstrap, createTrackSubgraph, removeTrackSubgraph, dispose guard, multiple tracks); all 31 tests in the file pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement TrackFacadeImpl and track subgraph lifecycle** - `00dc030` (feat)
2. **Task 2: Unit tests for track subgraph lifecycle, facade disposal, and default track** - `5af930c` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/engine/engineSingleton.ts` — TrackFacadeImpl class; real createTrackSubgraph/removeTrackSubgraph/getTrackFacade; DEFAULT_TRACK_ID export; default track bootstrap; _legacy.getTrackStripGraph
- `src/engine/engineSingleton.test.ts` — Replaced stub "Track API stubs" group (3 tests) with 5 new test groups (22 tests): Default track bootstrap, createTrackSubgraph, removeTrackSubgraph, TrackFacade dispose guard, Multiple tracks; added createTrackStrip mock with ordered createdStrips array

## Decisions Made

- `TrackFacadeImpl` uses JavaScript private class fields (`#disposed`, `#strip`) rather than a closure or TypeScript `private` keyword. Private class fields are enforced by the runtime (not just the type checker), making the dispose guard robust even if the facade is cast to `any`.
- The `tracks` Map stores `{ facade: TrackFacadeImpl; strip: TrackStripGraph }` pairs rather than just facades. This allows `_legacy.getTrackStripGraph` to return the raw strip without exposing it on the `TrackFacade` interface or requiring a class cast.
- In `removeTrackSubgraph`, `facade._stripOutput.disconnect(preLimiterBus)` is called before `facade.dispose()` — this follows the critical ordering from RESEARCH.md Pitfall 3. The `_stripOutput` getter is on `TrackFacadeImpl` (not on `TrackFacade` interface), accessible only within the module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock closure requires const-array mutation pattern**

- **Found during:** Task 2 (running tests)
- **Issue:** The plan's test strategy used `let createdStrips = []` with `createdStrips = []` in `beforeEach`. But `vi.mock` factories are hoisted and capture the binding at declaration time — reassigning the variable breaks the closure reference, making `createdStrips.push()` in the mock factory push to the OLD array.
- **Fix:** Changed `let createdStrips` to `const createdStrips = []` and used `createdStrips.length = 0` in `beforeEach` to mutate in place rather than reassign. The closure always references the same array instance.
- **Files modified:** `src/engine/engineSingleton.test.ts`
- **Committed in:** `5af930c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test strategy)
**Impact on plan:** Fix was necessary for tests to correctly track which strip was created for which track. No changes to production code.

## Issues Encountered

- vi.mock closure reference trap: module-level const/let variables referenced in `vi.mock` factory closures must be MUTATED (not reassigned) across test resets. This is a Vitest-specific pattern that differs from standard Jest patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-03 can call `getAudioEngine()._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` to obtain the track-1 strip and wire the existing `useToneSynth` into it
- `createTrackSubgraph` / `removeTrackSubgraph` / `getTrackFacade` API is stable and ready for Phase 2 reducer/context integration
- The `_legacy` accessor pattern established in Plans 01-01 and 01-02 provides a clean migration path — Phase 2 can progressively replace `_legacy` calls with proper facade-based access

---
*Phase: 01-engine-multi-track-foundation*
*Completed: 2026-03-12*

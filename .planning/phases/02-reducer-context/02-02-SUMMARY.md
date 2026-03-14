---
phase: 02-reducer-context
plan: 02
subsystem: state
tags: [bloc, class, typescript, vitest, snapshot-caching, useSyncExternalStore, engine-coordination]

# Dependency graph
requires:
  - phase: 02-01
    provides: DawAction, DawState, dawReducer, createIdService, DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE — all imported by DawStore
  - phase: 01-engine-multi-track-foundation
    provides: EngineApi interface (exported from engineSingleton.ts), createTrackSubgraph/removeTrackSubgraph

provides:
  - DawStore class — BLoC application controller owning DawState
  - subscribe/getProjectSnapshot/getUiSnapshot for useSyncExternalStore wiring (Plan 03)
  - Engine-first-state-second coordination enforced in addTrack/removeTrack
  - Min-1 track business rule (not in reducer — in DawStore)
  - Snapshot caching with Object.freeze — same reference when state unchanged
  - 38 unit tests verifying all contracts with mock engine

affects:
  - 02-03 (DawProvider imports DawStore, calls subscribe/getProjectSnapshot/getUiSnapshot)
  - Phase 3+ (DawStore is the single source of truth for all track CRUD)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BLoC pattern — DawStore owns state, exposes subscribe/getSnapshot for external consumption
    - Private class fields (#state, #engine, #listeners, #idService, #projectSnapshot, #uiSnapshot) — runtime-enforced encapsulation
    - Arrow-method class fields for stable reference identity (subscribe/getProjectSnapshot/getUiSnapshot)
    - Snapshot caching — Object.freeze on each new snapshot slice; same reference returned when slice unchanged
    - Engine-first-state-second ordering — engine throws → state unchanged → listeners not notified

key-files:
  created:
    - src/state/DawStore.ts
    - src/state/DawStore.test.ts
  modified:
    - src/engine/engineSingleton.ts (exported EngineApi interface — was unexported, blocked DawStore import)

key-decisions:
  - "EngineApi exported from engineSingleton.ts — needed for DawStore type import; was previously an unexported interface"
  - "Snapshot caching with per-slice Object.is checks — projectSnapshot replaced only when project slice changes, uiSnapshot only when ui slice changes; selectTrack does not replace projectSnapshot"
  - "eslint-disable in mock engine _legacy.limiterGraph — avoids dynamic import type that confused vitest environment detection"
  - "Removed @vitest-environment mention from docblock — vitest scans for this annotation and misread it as an environment specifier"

patterns-established:
  - "DawStore public methods follow engine-first-state-second: engine call before #dispatch(); if engine throws, #dispatch is never reached"
  - "Mock engine pattern: vi.fn() stubs for createTrackSubgraph/removeTrackSubgraph; _legacy uses `as any` to avoid cross-module type coupling in tests"
  - "Snapshot stability tests use Object.is — the same check React uses in useSyncExternalStore"

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 2 Plan 2: DawStore Class Summary

**DawStore BLoC class with private class fields, engine-first-state-second coordination, Object.freeze snapshot caching, and 38 unit tests verifying all contracts with a mock engine**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T14:53:29Z
- **Completed:** 2026-03-13T14:58:01Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `DawStore` class with 6 private class fields — runtime-encapsulated, no TypeScript-only `private`
- Arrow-method class fields for `subscribe`, `getProjectSnapshot`, `getUiSnapshot` — stable references safe to pass directly to `useSyncExternalStore`
- Engine-first-state-second ordering: `addTrack` calls `engine.createTrackSubgraph` before `#dispatch`; if engine throws, state is never modified
- Min-1 track guard in `removeTrack` (not in reducer — reducers are pure data transforms)
- Snapshot caching: per-slice `Object.is` check prevents replacing `projectSnapshot` on `selectTrack` calls
- 38 tests covering construction, addTrack, removeTrack, selectTrack, snapshot stability, subscribe/unsubscribe, engine error safety, ID uniqueness

## Task Commits

Each task was committed atomically:

1. **Task 1: DawStore class implementation** — `a502424` (feat)
2. **Task 2: DawStore comprehensive unit tests** — `4861734` (feat)

**Plan metadata:** (to be committed as docs commit)

## Files Created/Modified

- `src/state/DawStore.ts` — DawStore class: BLoC controller with private class fields, subscribe/getSnapshot/dispatch, engine-first coordination
- `src/state/DawStore.test.ts` — 38 tests: construction, addTrack, removeTrack, selectTrack, snapshot stability, subscribe/unsubscribe, engine error safety, ID service integration
- `src/engine/engineSingleton.ts` — Added `export` to `EngineApi` interface (was unexported, blocked type import)

## Decisions Made

- **EngineApi export:** The `EngineApi` interface in `engineSingleton.ts` was not exported. DawStore imports it as a type (`import type { EngineApi }`), so it needed to be exported. Adding `export` to the interface is a non-breaking change — no runtime impact.

- **Per-slice snapshot replacement:** `#dispatch` checks `Object.is(newState.project, this.#state.project)` and `Object.is(newState.ui, this.#state.ui)` separately. This means `selectTrack` (which only changes ui) does not replace `#projectSnapshot`. `useSyncExternalStore(store.subscribe, store.getProjectSnapshot)` consumers will not re-render on selection changes.

- **Mock engine `_legacy.limiterGraph` type:** Using `as any` in test file rather than a dynamic import type. The dynamic `import('../hooks/useLimiter').createLimiter` type reference caused vitest to attempt to resolve `comment` as a module path (misparse of the inline import comment). The `as any` cast is localized to the test mock — no impact on production code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported EngineApi interface from engineSingleton.ts**

- **Found during:** Task 1 (DawStore class implementation)
- **Issue:** `EngineApi` interface was declared as `interface EngineApi` (no export keyword). `DawStore.ts` needed `import type { EngineApi }` which failed with a TypeScript error.
- **Fix:** Added `export` keyword: `export interface EngineApi`. Non-breaking — no runtime change, purely a type export.
- **Files modified:** `src/engine/engineSingleton.ts`
- **Verification:** `npx tsc --noEmit` returned zero errors.
- **Committed in:** `a502424` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The EngineApi export was a required prerequisite for DawStore's type import. No scope creep — one line change to an existing file.

## Issues Encountered

**Vitest misread `@vitest-environment` in JSDoc comment:** The test file initially included `NO @vitest-environment comment` in a JSDoc block. Vitest scans source files for `@vitest-environment` annotations and attempted to resolve `comment` as a module path (the next token after the annotation). Removing that phrase from the docblock resolved the unhandled error.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **02-03 (DawProvider/context):** `DawStore` is ready to be consumed. `DawProvider` can call `new DawStore(engine, initialState)` and pass `store.subscribe`, `store.getProjectSnapshot`, `store.getUiSnapshot` directly to `useSyncExternalStore`. All three are arrow-method class fields — stable references, no `useCallback` needed.
- **No blockers** — 78 state tests pass, TypeScript clean, no React imports in state layer.

---
*Phase: 02-reducer-context*
*Completed: 2026-03-13*

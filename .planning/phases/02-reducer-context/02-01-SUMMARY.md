---
phase: 02-reducer-context
plan: 01
subsystem: state
tags: [reducer, typescript, vitest, discriminated-union, normalized-map, pure-functions]

# Dependency graph
requires:
  - phase: 01-engine-multi-track-foundation
    provides: DEFAULT_TRACK_ID constant and engine singleton structure this defaultState mirrors

provides:
  - Pure domain model layer (Layer 1) for DAW state architecture
  - ProjectDocument type with normalized NormalizedMap<Track> tracks slice
  - UiState type with selectedTrackId selection
  - DawState combined type for DawStore
  - DawAction discriminated union (ADD_TRACK, REMOVE_TRACK, SELECT_TRACK)
  - projectReducer, uiReducer, dawReducer — zero engine/React imports
  - createIdService() factory with seed/generate uniqueness guarantee
  - DEFAULT_PROJECT_DOCUMENT and DEFAULT_UI_STATE constants

affects:
  - 02-02 (DawStore class imports all types, reducers, idService, defaultState)
  - 02-03 (DawProvider/context layer imports types for useSyncExternalStore)
  - Phase 3+ (all feature plans import from src/state/ for actions and types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Normalized map pattern (byId + ids) for O(1) track lookup
    - Discriminated union actions with exhaustive switch checking (never default)
    - Pure reducer functions — no side effects, no engine imports, no React
    - uiReducer receives ProjectDocument as third argument for adjacency computation
    - dawReducer passes OLD project to uiReducer so REMOVE_TRACK adjacency works before removal

key-files:
  created:
    - src/state/types.ts
    - src/state/actions.ts
    - src/state/idService.ts
    - src/state/idService.test.ts
    - src/state/projectReducer.ts
    - src/state/uiReducer.ts
    - src/state/dawReducer.ts
    - src/state/defaultState.ts
    - src/state/projectReducer.test.ts
    - src/state/uiReducer.test.ts
    - src/state/dawReducer.test.ts
  modified: []

key-decisions:
  - "uiReducer receives ProjectDocument as third argument (not derived from new state) so REMOVE_TRACK can compute adjacency from the pre-removal track list"
  - "dawReducer passes state.project (OLD) to uiReducer — ordering matters: project updated first, ui gets old project for adjacency"
  - "idService uses incrementing counter with track- prefix — simple and sufficient for demo app per CONTEXT.md discretion"
  - "MidiClip/MidiStep re-exported from types.ts — consumers never import from project-runtime directly"
  - "projectReducer REMOVE_TRACK does NOT enforce min-1 track — that is DawStore's responsibility (pure data transform vs. business rule)"

patterns-established:
  - "Reducer purity: never import from ../engine/ in projectReducer, uiReducer, or dawReducer"
  - "Exhaustive switch: all reducers use `const _exhaustive: never = action; return _exhaustive;` default"
  - "Normalized map: all ordered collections use { byId: Record<string, T>, ids: string[] } shape"
  - "Test fixtures as plain objects: no audio setup, no React, no mocks needed in state tests"

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 2 Plan 1: Domain Model Layer Summary

**Pure DAW domain model layer with normalized ProjectDocument, discriminated union actions, three pure reducers (zero engine imports), and createIdService factory — 40 unit tests, all green**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T14:47:13Z
- **Completed:** 2026-03-13T14:50:05Z
- **Tasks:** 2
- **Files modified:** 11 (all created)

## Accomplishments

- `src/state/` directory established with 7 source files + 4 test files
- Three pure reducers covering ADD_TRACK/REMOVE_TRACK/SELECT_TRACK with exhaustive TypeScript checking
- `createIdService()` with seed/generate guarantees IDs are never reused after removal
- `DEFAULT_PROJECT_DOCUMENT` replaces `DEFAULT_UI_PLAN` — matches current engine bootstrap state
- 40 unit tests across 4 test files; all pass in node environment with plain object fixtures

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain types, actions, and ID service** - `20c58c8` (feat)
2. **Task 2: Pure reducers, default state, and comprehensive tests** - `7e2ad4a` (feat)

**Plan metadata:** (to be committed as docs commit)

## Files Created/Modified

- `src/state/types.ts` — ProjectDocument, UiState, DawState, Track, Device, MasterTrack, NormalizedMap interfaces; re-exports MidiClip/MidiStep
- `src/state/actions.ts` — DawAction discriminated union with AddTrackAction, RemoveTrackAction, SelectTrackAction
- `src/state/idService.ts` — createIdService() factory with seed/generate, counter-based uniqueness
- `src/state/idService.test.ts` — 11 tests: uniqueness, seeding, additive seed, independence
- `src/state/projectReducer.ts` — Pure ADD_TRACK/REMOVE_TRACK/SELECT_TRACK transforms on NormalizedMap
- `src/state/uiReducer.ts` — Auto-select on ADD_TRACK, adjacent-track fallback on REMOVE_TRACK
- `src/state/dawReducer.ts` — Delegates to both reducers; passes OLD project to uiReducer
- `src/state/defaultState.ts` — DEFAULT_PROJECT_DOCUMENT and DEFAULT_UI_STATE constants
- `src/state/projectReducer.test.ts` — 10 tests: all action types + immutability
- `src/state/uiReducer.test.ts` — 9 tests: selection changes across all scenarios
- `src/state/dawReducer.test.ts` — 10 tests: atomic updates, purity, immutability

## Decisions Made

- **uiReducer third argument pattern:** uiReducer(state, action, project) receives the ProjectDocument before the action is applied. This allows REMOVE_TRACK to see the full track list (including the track being removed) to compute the adjacent track for selection. dawReducer passes `state.project` (old) not `newProject` (post-removal) to uiReducer.

- **Reducer purity over convenience:** projectReducer does NOT enforce the min-1 track business rule. That constraint lives in DawStore. The reducer is a pure data transform only — DawStore decides whether to dispatch.

- **Counter-based ID generation:** `createIdService()` uses a simple incrementing counter with `track-` prefix. UUIDs or nanoid were considered but are unnecessary for a demo app (per CONTEXT.md "Claude's Discretion"). The `seed()` method handles pre-existing IDs from loaded projects.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **02-02 (DawStore class):** All imports ready. DawStore can `import { dawReducer, projectReducer, uiReducer }`, `import { createIdService }`, `import { DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE }`, and `import type { DawState, DawAction }` from `src/state/`.
- **02-03 (DawProvider/context):** Types `ProjectDocument`, `UiState`, `DawState` are ready for `useSyncExternalStore` wiring.
- **No blockers** — all 40 tests pass, TypeScript is clean.

---
*Phase: 02-reducer-context*
*Completed: 2026-03-13*

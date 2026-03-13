# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components
**Current focus:** Phase 3: App.tsx Teardown

## Current Position

Phase: 3 of 5 (App.tsx Teardown) — In progress
Plan: 1 of N in phase 3 — completed
Status: In progress — 03-01 complete, awaiting further phase 3 plans
Last activity: 2026-03-13 — Completed 03-01-PLAN.md (App.tsx shell reduction, Layout.tsx creation)

Progress: [███████░░░] 47% (7/15 plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 3.6 min
- Total execution time: 26 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-multi-track-foundation | 3 completed / 3 total | 14 min | 4.7 min |
| 02-reducer-context | 3 completed / 3 total | 9.5 min | 3.2 min |
| 03-app-tsx-teardown | 1 completed / N total | 2.5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 3 min, 4 min, 3 min, 2.5 min, 2.5 min
- Trend: stable/improving

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Engine as standalone singleton (module-level, not React lifecycle)
- Reducer + context over Zustand/Redux (React built-ins only — STATE-08 hard constraint)
- Empty tracks on add (device CRUD is v2)
- Track strip wired immediately on add (meters and gain work from creation)
- Min 1 track enforced (remove button disabled, not hidden)
- AudioContext owned by Tone.js — all engine nodes use `Tone.getContext().rawContext` (cross-context connect() throws InvalidAccessError)
- MasterFacade uses setGain/getGain naming — domain-appropriate, not implementation names
- Engine has no dispose() — app-lifetime singleton avoids React lifecycle disposal/recreation bugs
- TrackFacadeImpl uses private class fields (#disposed, #strip) — runtime-enforced encapsulation, not just TypeScript private
- tracks Map stores { facade, strip } pairs — strip accessible via _legacy.getTrackStripGraph for migration without leaking onto TrackFacade interface
- disconnect-before-dispose ordering in removeTrackSubgraph — prevents Web Audio API InvalidStateError (RESEARCH.md Pitfall 3)
- legacyEngineAdapter wraps singleton internals — buildUiRuntime.ts receives unchanged AudioEngine interface
- MasterFacade -> MasterStripHook bridge via module-level adapter (avoids conflating domain naming conventions on MasterFacade interface)
- useAudioEngine.test.tsx deleted (not updated) — the disposal/recreation pattern no longer exists to test
- uiReducer receives ProjectDocument as third argument so REMOVE_TRACK can compute adjacent track from pre-removal list; dawReducer passes OLD project (state.project, not newProject) to uiReducer
- projectReducer does NOT enforce min-1 track — that business rule belongs in DawStore (reducer is pure data transform only)
- createIdService() uses incrementing counter with track- prefix (not UUID/nanoid) — sufficient for demo app, seed() handles pre-existing IDs
- MidiClip/MidiStep re-exported from src/state/types.ts — consumers never import from project-runtime directly
- EngineApi exported from engineSingleton.ts — DawStore imports it as a type; adding export keyword is non-breaking
- DawStore snapshot caching uses per-slice Object.is checks — selectTrack does not replace #projectSnapshot (only ui slice changes)
- DawStore arrow-method class fields for subscribe/getProjectSnapshot/getUiSnapshot — stable references, safe to pass directly to useSyncExternalStore without useCallback
- DawDispatch interface defined in DawProvider.tsx (co-located with the contexts it wraps)
- ProjectContext/UiContext/DispatchContext exported from DawProvider.tsx for sibling hook files; hooks are the public API
- Null initial context values + null-check in hooks — fail-fast over silent bugs from missing provider
- useMemo([store]) for dispatch object — stable reference for component lifetime
- React 19 `<Context value=...>` syntax used (`.Provider` deprecated in React 19)
- useTrackSelection inlined in Layout.tsx (useState + useCallback) — hook had no reuse consumers; inlining reduces file count (03-01)
- DawStore created at App.tsx module level (not inside App function) — StrictMode double-mount safety (03-01)
- App.test.tsx deleted (not migrated) — consistent with useAudioEngine.test.tsx deletion precedent; 336 lines tested wiring that no longer exists (03-01)

### Pending Todos

- ~~Plan 01-02 needs to expose `preLimiterBus` on EngineApi~~ — RESOLVED
- ~~Plan 01-03 needs to wire the existing Tone.js synth into track-1 via _legacy.getTrackStripGraph(DEFAULT_TRACK_ID)~~ — RESOLVED: synthGraph/pannerGraph wired at module level in Layout.tsx (moved from App.tsx in 03-01)
- `legacyEngineAdapter` and `buildUiRuntime` replacement scope needs to be locked down during Phase 3 remaining plans

### Blockers/Concerns

- `buildUiRuntime` replacement scope not locked down — evaluate during remaining Phase 3 plans (affects DawState shape and DevicePanel props)
- jsdom@28 + Node 20 CJS/ESM incompatibility prevents 6 DOM test files from running — requires jsdom downgrade or alternative (happy-dom) to restore React component tests (was 5 files; DawProvider.test.tsx adds a 6th)
- `_legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` still used in Layout.tsx module scope — Phase 4 device CRUD will replace this with proper device chain management
- `legacyEngineAdapter` still lives in Layout.tsx module scope — Phase 4 may relocate to engineSingleton or a dedicated adapter file

## Session Continuity

Last session: 2026-03-13T15:45:30Z
Stopped at: Completed 03-01-PLAN.md — App.tsx teardown (Layout.tsx creation, App.tsx shell reduction, 3 files deleted)
Resume file: None

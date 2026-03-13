# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components
**Current focus:** Phase 2: State Management (Reducer + Context)

## Current Position

Phase: 2 of 5 (Reducer + Context) — In progress
Plan: 1 of 3 in phase 2 (plan 4/15 overall)
Status: In progress — 02-01 complete, ready for 02-02 (DawStore class)
Last activity: 2026-03-13 — Completed 02-01-PLAN.md (domain model layer: types, actions, reducers, idService, defaultState)

Progress: [████░░░░░░] 27% (4/15 plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 4.3 min
- Total execution time: 17 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-multi-track-foundation | 3 completed / 3 total | 14 min | 4.7 min |
| 02-reducer-context | 1 completed / 3 total | 3 min | 3 min |

**Recent Trend:**
- Last 5 plans: 4 min, 5 min, 5 min, 3 min
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

### Pending Todos

- ~~Plan 01-02 needs to expose `preLimiterBus` on EngineApi~~ — RESOLVED
- ~~Plan 01-03 needs to wire the existing Tone.js synth into track-1 via _legacy.getTrackStripGraph(DEFAULT_TRACK_ID)~~ — RESOLVED: synthGraph/pannerGraph wired at module level in App.tsx
- `legacyEngineAdapter` and `buildUiRuntime` replacement scope needs to be locked down during Phase 2 planning (affects DawState shape and DevicePanel props)

### Blockers/Concerns

- `buildUiRuntime` replacement scope not locked down — decide during Phase 2 planning (affects DawState shape and DevicePanel props)
- jsdom@28 + Node 20 CJS/ESM incompatibility prevents 5 DOM test files from running — requires jsdom downgrade or alternative (happy-dom) to restore React component tests (was 6 files; reduced to 5 after useAudioEngine.test.tsx deletion)
- `_legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` is still used in App.tsx — Phase 3 device CRUD will replace this with proper device chain management

## Session Continuity

Last session: 2026-03-13T14:50:05Z
Stopped at: Completed 02-01-PLAN.md — domain model layer (types, actions, reducers, idService, defaultState)
Resume file: None

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components
**Current focus:** Phase 1: Engine Multi-Track Foundation

## Current Position

Phase: 1 of 5 (Engine Multi-Track Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-12 — Completed 01-02-PLAN.md (track subgraph lifecycle + facade disposal)

Progress: [██░░░░░░░░] 13% (2/15 plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4.5 min
- Total execution time: 9 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-multi-track-foundation | 2 completed / 3 total | 9 min | 4.5 min |

**Recent Trend:**
- Last 5 plans: 4 min, 5 min
- Trend: stable

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

### Pending Todos

- ~~Plan 01-02 needs to expose `preLimiterBus` on EngineApi~~ — RESOLVED: preLimiterBus is internal to createEngineInternal; track subgraphs connect to it directly via strip.output.connect(preLimiterBus) inside createTrackSubgraph
- Plan 01-03 needs to wire the existing Tone.js synth into track-1 via _legacy.getTrackStripGraph(DEFAULT_TRACK_ID)

### Blockers/Concerns

- `buildUiRuntime` replacement scope not locked down — decide during Phase 2 planning (affects DawState shape and DevicePanel props)
- `createTrackSubgraph` vs `addTrackStrip` naming conflict between ARCHITECTURE.md and STACK.md — RESOLVED in 01-02: `createTrackSubgraph` is the canonical name (used in EngineApi, exported interface, and tests)
- jsdom@28 + Node 20 CJS/ESM incompatibility prevents 6 DOM test files from running — requires jsdom downgrade or alternative (happy-dom) to restore React component tests

## Session Continuity

Last session: 2026-03-12T20:40:02Z
Stopped at: Completed 01-02-PLAN.md — track subgraph lifecycle with dispose guard
Resume file: None

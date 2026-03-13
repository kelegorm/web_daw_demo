# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components
**Current focus:** Phase 5: Transport Decoupling + Integration Close-out

## Current Position

Phase: 5 of 5 (Transport Decoupling + Integration Close-out) — In progress
Plan: 2 of 3 in phase 5 — Plan 05-02 complete
Status: In progress
Last activity: 2026-03-13 — Completed 05-02-PLAN.md (TransportContext + TransportProvider created, Toolbar/TrackZone migrated to context consumers, Layout stripped of transport orchestration)

Progress: [████████████░] 80% (12/15 plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 3.6 min
- Total execution time: 30 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-multi-track-foundation | 3 completed / 3 total | 14 min | 4.7 min |
| 02-reducer-context | 3 completed / 3 total | 9.5 min | 3.2 min |
| 03-app-tsx-teardown | 1 completed / 1 total | 2.5 min | 2.5 min |
| 04-component-migration-track-crud | 3 completed / 3 total | 13 min | 4.3 min |
| 05-transport-decoupling-+-integration-close-out | 2 completed / 3 total | 8 min | 4 min |

**Recent Trend:**
- Last 5 plans: 2.5 min, 6 min, 4 min, 4 min, 4 min
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
- buildUiRuntime.test.ts deleted — same precedent as useAudioEngine.test.tsx; tested function removed (04-01)
- buildUiRuntime.ts deleted in 04-03 — UiRuntimeDeviceModel inlined to DevicePanel.tsx, UiRuntimeClipModel inlined to TrackZone.tsx
- DevicePanel receives narrow deviceModules prop (Phase 5 seam) — device hook instances are React hook return values owned by Layout; full decoupling requires Phase 5 device lifecycle context
- MidiKeyboard.test.tsx deleted (04-03) — same jsdom@28 + removed-prop precedent as App.test.tsx and DevicePanel.test.tsx
- TrackRow sub-component: per-track useTrackFacade calls require sub-component (React hook rules prohibit hooks in .map()) (04-02)
- ~~Phase 5 seam props on TrackZone: transport/masterStrip/onTrackMuteSync are thin props from Layout~~ — RESOLVED: transport/onTrackMuteSync removed in 05-02; masterStrip remains (master context is v2 scope)
- ~~onTrackMuteSync callback: routes track-1 mute to transport.setTrackMute to preserve sequencer sync — Phase 5 debt~~ — RESOLVED in 05-02
- REMOVE_TRACK no longer returns same object reference — recArmByTrackId cleanup always produces new object (04-01)
- useTransportController accepts plain setTrackMuted callback (not TrackStripHook) — TrackStripHook fully removed from transport layer (05-01)
- EngineApi.connectToTrackInput(trackId, sourceNode) added for type-safe device chain -> track strip wiring without _legacy.getTrackStripGraph (05-01)
- Sequencer.dispose() does NOT call transport.stop() or panic() — caller controls global transport and note-offs (05-01)
- TransportProvider accepts toneSynth as prop from Layout — Layout owns useToneSynth hook call; toneSynth also needed by DevicePanel and MidiKeyboard (05-02)
- TransportActionsCtx actions memoized with useMemo — useCallback-wrapped functions from useTransportController have stable refs; memo rarely recomputes (05-02)
- __panicCount increment kept in Toolbar, __panicCount init + __activeSteps tracking in TransportProvider — each global co-located with its owner (05-02)
- onMuteChanged in TrackRow calls transportActions.setTrackMute only for DEFAULT_TRACK_ID — replaces onTrackMuteSync seam prop (05-02)
- @testing-library/react installed as devDep — unblocked pre-existing DawProvider.test.tsx build type error (04-01)
- useTrackFacade: seeds React state from getGain()/isMuted() at mount, syncs on write — per-track engine facade hook pattern (04-01)
- recArmByTrackId lifecycle: ADD_TRACK auto-arms, REMOVE_TRACK always cleans up entry, SET_REC_ARM sets (04-01)

### Pending Todos

- ~~Plan 01-02 needs to expose `preLimiterBus` on EngineApi~~ — RESOLVED
- ~~Plan 01-03 needs to wire the existing Tone.js synth into track-1 via _legacy.getTrackStripGraph(DEFAULT_TRACK_ID)~~ — RESOLVED: synthGraph/pannerGraph wired at module level in Layout.tsx (moved from App.tsx in 03-01)
- ~~`legacyEngineAdapter` and `buildUiRuntime` replacement scope needs to be locked down during Phase 4 planning~~ — RESOLVED in 04-01

### Blockers/Concerns

- jsdom@28 + Node 20 CJS/ESM incompatibility prevents DOM test files from running — requires jsdom downgrade or alternative (happy-dom) to restore React component tests (DawProvider.test.tsx remains)
- `_legacy.limiterGraph` still used in Layout.tsx — needed by useLimiter, targeted in later Phase 5 plans
- Phase 5 device seam: Layout passes `deviceModules: Record<string, AnyDeviceModule>` to DevicePanel — fully eliminated when device lifecycle moves to context
- `_legacy.getTrackStripGraph` RESOLVED — no longer called from Layout.tsx (05-01)

## Session Continuity

Last session: 2026-03-13T22:41:27Z
Stopped at: Completed 05-02-PLAN.md — TransportContext + TransportProvider created, Toolbar/TrackZone context consumers, Layout transport-free
Resume file: None

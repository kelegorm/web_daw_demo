---
phase: 01-engine-multi-track-foundation
plan: "01"
subsystem: audio-engine
tags: [tone.js, web-audio-api, singleton, typescript, facades, vitest]

requires: []
provides:
  - "TrackFacade, MasterFacade, DeviceFacade interfaces in src/engine/types.ts"
  - "getAudioEngine() module-level singleton with idempotent initialization"
  - "preLimiterBus -> limiter -> master strip -> destination master chain"
  - "MasterFacade wrapping masterStripGraph (setGain/getGain/meterSource)"
  - "Limiter input meter and gain reduction dB accessors"
  - "_resetEngineForTesting() for unit test isolation"
  - "_legacy accessor for backward-compat migration (Plans 02-03 and Phase 2-3)"
affects:
  - 01-engine-multi-track-foundation/01-02 (createTrackSubgraph implementation)
  - 01-engine-multi-track-foundation/01-03 (synth wiring into track subgraph)
  - phase-2 (reducer/context state management over engine API)

tech-stack:
  added: []
  patterns:
    - "Module-level singleton with lazy initialization guard (let _engine = null)"
    - "Facade objects wrapping internal graph objects with domain-appropriate method names"
    - "Tone.js AudioContext ownership — all nodes share Tone.getContext().rawContext"
    - "Per-file @vitest-environment annotation for jsdom vs node test environments"

key-files:
  created:
    - src/engine/engineSingleton.ts
    - src/engine/engineSingleton.test.ts
  modified:
    - src/engine/types.ts
    - vitest.config.ts
    - src/App.test.tsx
    - src/components/DevicePanel.test.tsx
    - src/components/MidiKeyboard.test.tsx
    - src/components/TrackZone.test.tsx
    - src/hooks/useAudioEngine.test.tsx
    - src/hooks/useToneSynth.test.ts

key-decisions:
  - "AudioContext obtained from Tone.getContext().rawContext — sharing Tone.js context prevents InvalidAccessError on cross-context connect()"
  - "Engine is app-lifetime — no dispose() method, preLimiterBus and master chain created once on first call"
  - "MasterFacade uses setGain/getGain naming (not setMasterVolume) — domain-appropriate facade names"
  - "Track API stubs throw explicitly until Plan 01-02 — keeps type contract honest, surfaces incomplete usage fast"

patterns-established:
  - "Singleton pattern: module-level null variable + lazy createEngineInternal() call + _resetEngineForTesting() for tests"
  - "Facade pattern: domain-named methods (setGain vs setMasterVolume) wrapping implementation graph objects"

duration: 4min
completed: 2026-03-12
---

# Phase 1 Plan 1: Engine Singleton with Facade Interfaces Summary

**Module-level audio engine singleton with preLimiterBus summing node, master chain (limiter -> master strip -> destination), TrackFacade/MasterFacade/DeviceFacade interfaces, and 12 passing unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T20:27:38Z
- **Completed:** 2026-03-12T20:31:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Defined TrackFacade, MasterFacade, DeviceFacade interfaces in types.ts alongside all existing exports
- Created engineSingleton.ts with getAudioEngine() singleton — idempotent, StrictMode-safe, shares Tone.js AudioContext
- Wired preLimiterBus (unity gain) -> createLimiter() -> createMasterStrip() -> audioContext.destination
- MasterFacade exposes setGain/getGain/meterSource without raw AudioNode or Tone.* leakage
- Track API stubs throw a clear message directing to Plan 01-02
- Fixed pre-existing test environment blocker: all 18 non-DOM test files now run (157 tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define facade interfaces and create engine singleton** - `31528c4` (feat)
2. **Task 2: Unit tests for singleton idempotency, StrictMode guard, and master chain wiring** - `6ddf8e8` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/engine/types.ts` - Added TrackFacade, MasterFacade, DeviceFacade interfaces (kept all existing exports)
- `src/engine/engineSingleton.ts` - New singleton module with getAudioEngine(), _resetEngineForTesting(), EngineApi interface
- `src/engine/engineSingleton.test.ts` - 12 unit tests across 5 groups (idempotency, StrictMode, master chain, limiter, track stubs)
- `vitest.config.ts` - Changed default environment from jsdom to node (blocking fix)
- `src/App.test.tsx`, `src/components/DevicePanel.test.tsx`, `src/components/MidiKeyboard.test.tsx`, `src/components/TrackZone.test.tsx`, `src/hooks/useAudioEngine.test.tsx`, `src/hooks/useToneSynth.test.ts` - Added `@vitest-environment jsdom` annotation

## Decisions Made
- AudioContext is obtained from `Tone.getContext().rawContext` rather than `new AudioContext()`. Web Audio API prohibits `connect()` calls across different AudioContext instances (throws InvalidAccessError). Since the existing synth and transport use Tone's context, all engine nodes must share it.
- No `dispose()` method on the engine — per CONTEXT.md, engine is app-lifetime. Avoids the React lifecycle disposal/recreation bugs the singleton is designed to prevent.
- Track methods are explicit stubs throwing `[engine] track API not yet implemented — see Plan 01-02` — this makes the type contract honest and surfaces any premature usage immediately during Plan 01-02 development.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing test environment incompatibility**
- **Found during:** Task 2 (running engineSingleton tests)
- **Issue:** vitest.config.ts used `environment: 'jsdom'` globally. jsdom@28 has a CJS/ESM incompatibility with `@exodus/bytes` on Node 20 (`require()` of ESM module fails). This caused all 24 test files to error at environment setup — 0 tests were running before this fix.
- **Fix:** Changed vitest.config.ts default to `environment: 'node'`. Added `// @vitest-environment jsdom` docblock annotation to the 6 test files that require DOM (React component tests using `createRoot`). The 6 jsdom files remain broken due to the underlying jsdom@28/Node 20 incompatibility, but they were already broken and are correctly annotated for when the issue is resolved.
- **Files modified:** vitest.config.ts, src/App.test.tsx, src/components/DevicePanel.test.tsx, src/components/MidiKeyboard.test.tsx, src/components/TrackZone.test.tsx, src/hooks/useAudioEngine.test.tsx, src/hooks/useToneSynth.test.ts
- **Verification:** `npm run test` → 18/24 files pass (157 tests). The 6 jsdom files had 0 tests before and still have 0 tests (pre-existing incompatibility, not introduced by this plan).
- **Committed in:** `6ddf8e8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to run any tests at all. The 6 DOM test files remain in their pre-existing broken state — resolving jsdom@28/Node 20 incompatibility is out of scope for this plan.

## Issues Encountered
- jsdom@28 + Node 20 CJS/ESM incompatibility was a pre-existing environment blocker. Resolved by using `node` as the default vitest environment with per-file jsdom opt-in for DOM tests.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01-02 can immediately import `getAudioEngine()` and implement `createTrackSubgraph()`, `getTrackFacade()`, `removeTrackSubgraph()` — the singleton infrastructure is in place
- The `preLimiterBus` is accessible via `getAudioEngine()._legacy.audioContext` context (Plan 01-02 will need to connect track output to preLimiterBus)
- All facade interfaces (TrackFacade, MasterFacade, DeviceFacade) are defined and ready to implement
- Concern: `preLimiterBus` is not currently exposed on EngineApi — Plan 01-02 will need to add it or use `_legacy` for internal wiring

---
*Phase: 01-engine-multi-track-foundation*
*Completed: 2026-03-12*

# Plan: Audio Graph Refactor

## Overview

Target architecture for this refactor:
- Audio graph is assembled in one composition root: `createAudioEngine`
- Public UI contracts are intent-level and do not expose `AudioNode` / `Tone.*`
- Long-lived audio resources use explicit lifecycle (`init/start/stop/dispose`) and are not created in render paths
- Transport policy and UI consume service contracts, not `Tone.getTransport()` internals
- Sequencer note lifecycle is fully audio-time scheduled (no wall-clock `setTimeout`)
- Documentation is a single source of truth for the active runtime

Validation:
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

## Architecture Invariants (acceptance criteria)

These are not separate tasks. They are architecture-level acceptance criteria.
Invariant status is updated in **Task 6** only, when there is linked automated proof.

- [ ] `[INV-1]` Single graph composition point: `createAudioEngine`
- [ ] `[INV-2]` No module connects to `destination` on its own
- [ ] `[INV-3]` All `AudioNode` instances used by engine modules live in one shared `AudioContext`
- [ ] `[INV-4]` Modules do not know neighboring modules directly (only `input/output/params` contracts)
- [ ] `[INV-5]` UI/feature hooks do not accept or return `AudioNode` / `Tone.*`
- [ ] `[INV-6]` `AudioNode`-level contracts are engine-internal only; UI-facing contracts are intent-level only
- [ ] `[INV-7]` Sequencer and transport share one time domain (audio-time), no `setTimeout` for note lifecycle
- [ ] `[INV-8]` All long-lived audio resources have an explicit lifecycle: `init/start/stop/dispose`
- [ ] `[INV-9]` If a module fails to initialize, engine degrades to bypass/pass-through instead of breaking the graph
- [ ] Mark completed (only after Task 6 traceability matrix is fully green)

### Task 1: Single composition root — `createAudioEngine` (completed)

- [x] Create `src/engine/audioEngine.ts` with `createAudioEngine(): AudioEngine`
- [x] Declare `AudioModule` in `src/engine/types.ts`: `{ input?: AudioNode; output?: AudioNode; init?(): void|Promise<void>; dispose(): void }` (declaration only at this stage)
- [x] `AudioEngine` now owns graph modules and links: synth, panner, track-strip, limiter, master-strip, meter taps, destination
- [x] Build the graph only inside `createAudioEngine` using: `synth -> panner -> track-strip -> limiter -> master-strip -> destination`
- [x] Narrow `panner` responsibility to pan/bypass only
- [x] Extract track volume/mute/meter responsibility into `createTrackStrip`
- [x] Extract master volume/meter responsibility into `createMasterStrip`
- [x] Remove module self-connection to destination from synth/panner/limiter creation paths
- [x] Remove manual graph rewiring from `App.tsx`
- [x] Add Vitest test: `createAudioEngine()` builds expected graph links (using connect/disconnect mocks)
- [x] Add Vitest test: repeated `createAudioEngine()` is not order-dependent
- [x] Add lightweight graph validation in engine assembly (Task 1 scope): missing module id, missing port (`from.output` / `to.input`), duplicate module id, self-loop edge
- [x] For current linear graph spec, prevent cycles by rule: edge order must move forward in module list (no backward edges)
- [x] Add Vitest tests for validation errors: missing module, missing port, duplicate id, self-loop, backward edge
- [x] Leave generic cycle detection (DFS over arbitrary graph) out of Task 1 scope; add only when non-linear graph routing is introduced
- [x] Mark completed

### Task 2: Explicit lifecycle — `useAudioEngine` + `dispose`

- [x] Create `useAudioEngine` in `src/hooks/useAudioEngine.ts`; initialize `createAudioEngine()` in `useEffect`, dispose in cleanup
- [x] Move engine creation out of `App.tsx` render path; `App` must consume `useAudioEngine`
- [x] Remove fallback creation (`existing ?? create*`) from UI hooks (`useToneSynth`, `usePanner`, `useTrackStrip`, `useMasterStrip`, `useLimiter`); these hooks become adapters over injected engine modules only
- [x] Make `AudioEngine.dispose()` idempotent and responsible for full teardown of graph links and module resources
- [x] Verify StrictMode behavior: double mount/unmount does not create duplicate graphs
- [x] Add Vitest test: after `dispose()`, public engine methods are safe no-ops (no throws)
- [x] Add Playwright test: app remount does not produce duplicated audio activity/duplicated sequencer steps
- [x] Mark completed

### Task 3: Intent-level contracts (after engine/lifecycle)

- [x] Adopt the `AudioModule` declared in Task 1 as the only engine-internal module shape across all `create*` modules
- [x] Define `MeterFrame` in `src/engine/types.ts`: `{ leftRms: number; rightRms: number; leftPeak: number; rightPeak: number }`
- [x] Define `MeterSource` in `src/engine/types.ts`: `{ subscribe(cb: (frame: MeterFrame) => void): () => void }`
- [x] Expose meter data from engine modules via `MeterSource` instead of leaking `AnalyserNode`
- [x] Hide `get*Node()` / `Tone.*` from public UI contracts (`useToneSynth`, `usePanner`, `useTrackStrip`, `useMasterStrip`, `useLimiter`)
- [x] Switch `VUMeter` and `TrackZone` to intent-level meter contracts directly (no temporary adapters)
- [x] Add type-level tests (`expectTypeOf`): public UI-hook types must not include `AudioNode` / `Tone.*`
- [x] Add Vitest test: `MeterSource` emits valid frames (`0..1` for RMS/Peak)
- [x] Mark completed

### Task 4: Transport service — remove direct Tone calls from UI

- [ ] Create `src/engine/transportService.ts` with contract:
  - `getSnapshot(): { isPlaying: boolean; positionSeconds: number; currentStep: number; bpm: number }`
  - `subscribe(listener: () => void): () => void`
  - `play()`, `pause()`, `stop()`, `setBpm(bpm: number)`, `setLoop(loop: boolean)`
- [ ] Move `useTransportController` to `TransportService` (no direct `Tone.getTransport()` in UI-facing flow)
- [ ] Make `useSequencer` consume `TransportService` instead of calling `Tone.getTransport()` directly
- [ ] Make `TrackZone` consume `positionSeconds` / `playheadPos` from controller/service snapshot, not Tone directly
- [ ] Add Vitest test: `play/pause/stop` update snapshot correctly
- [ ] Add Vitest test: `stop()` resets `positionSeconds` and `currentStep`
- [ ] Add Playwright test: playhead moves from controller state, not direct Tone reads in component
- [ ] Mark completed

### Task 5: Single timing model — remove `setTimeout` from note lifecycle

- [ ] In `useSequencer.ts`, replace `setTimeout` for `noteOff` with transport/audio-time scheduling (for example `scheduleOnce`)
- [ ] Ensure `noteOn` and `noteOff` are scheduled in the same time domain
- [ ] Ensure `stop()`/`pause()` cancels or suppresses pending note-off events deterministically
- [ ] Verify behavior during BPM changes while playing: note duration is recalculated correctly
- [ ] Verify behavior during pause/resume: no hanging notes
- [ ] Add Vitest test: at BPM 120, step duration follows audio-time (no wall-clock `setTimeout`)
- [ ] Add Vitest test: `noteOff` is not called after `stop()`
- [ ] Mark completed

### Task 6: Regression Gate (how we prove refactor did not break behavior)

- [ ] Create `docs/architecture/regression_gate.md` with table: "scenario -> automated test -> status"
- [ ] Lock required scenarios:
  - Transport: play/pause/stop, loop
  - Sequencer: step progression and note order
  - Panic: releases all active notes
  - Track mute: steps keep advancing while track audio/meter stay at zero
  - Master chain: limiter enable/bypass, GR meter
  - UI meters: track/master L/R activity and peak hold
  - Engine fail-safe: module init failure falls back to bypass/pass-through and app remains playable
- [ ] For each scenario, link exact test file (`vitest` / `playwright`) and expected result
- [ ] Add `Invariant Traceability` section in `regression_gate.md`: map each invariant `[INV-1..INV-9]` -> validating test(s) -> status
- [ ] Update the checklist in `Architecture Invariants` based only on this traceability map
- [ ] Add explicit sign-off line: all `[INV-*]` have at least one passing automated proof
- [ ] Optional: add aggregate command `npm run test:arch` (runs critical regression suite)
- [ ] Definition of Done for refactor:
  - `npm run build` is green
  - `npm run test` is green
  - `npm run test:e2e` is green
  - If `npm run test:arch` is introduced, it is green
  - No direct `Tone.getTransport()` usage in UI components
  - No `AudioNode` / `Tone.*` in public UI contracts
  - Invariant traceability is complete and all `[INV-*]` are green
- [ ] Mark completed

### Task 7: Documentation alignment — one source of truth

- [x] Update `AGENTS.md`: remove claim that AudioWorklet/WASM is the active runtime, document current runtime and boundaries
- [x] Update `CLAUDE.md`: align Architecture section with `createAudioEngine` + current transport/sequencer reality
- [ ] Fix `scripts/build-wasm.js` and `package.json` (`build:wasm`):
  - either remove non-working script,
  - or keep as `experimental` and explicitly document that it is not part of active runtime
- [ ] Create `docs/architecture/audio_engine.md`: graph, modules, lifecycle, transport, meter contracts
- [ ] Mark completed

# Plan: Audio Graph Refactor

## Overview

Fix the architectural issues identified in the system map report:
- The audio graph is assembled in multiple places at once (no single composition root)
- Public hook contracts leak platform objects (`AudioNode`, `Tone.*`)
- Resources are created during render without an explicit dispose lifecycle
- Transport policy and UI depend directly on `Tone.getTransport()` internals
- `noteOff` uses `setTimeout` instead of audio-time scheduling
- Conflicting sources of truth in documentation (WASM/AudioWorklet vs Tone.js)

Validation:
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

## Architecture Invariants (lock these before implementation)

- [ ] Single graph composition point: `createAudioEngine`
- [ ] No module connects to `destination` on its own
- [ ] UI/feature hooks do not accept or return `AudioNode` / `Tone.*`
- [ ] Sequencer and transport share one time domain (audio-time), no `setTimeout` for note lifecycle
- [ ] All long-lived audio resources have an explicit lifecycle: `init/start/stop/dispose`
- [ ] Mark completed

### Task 1: Single composition root — `createAudioEngine` (first)

- [ ] Create `src/engine/audioEngine.ts` with `createAudioEngine(): AudioEngine`
- [ ] Declare `AudioModule` in `src/engine/types.ts`: `{ input?: AudioNode; output?: AudioNode; init?(): void|Promise<void>; dispose(): void }` (declaration only at this stage)
- [ ] `AudioEngine` owns the graph and nodes: synth, panner, limiter, meter taps, destination
- [ ] Build the graph only inside `createAudioEngine` using: `synth -> panner -> limiter -> master -> destination`
- [ ] Remove self-connection to destination from `createToneSynth` (`useToneSynth.ts#L40`)
- [ ] Remove self-connection to destination from `createPanner` (`usePanner.ts#L67`)
- [ ] Remove disconnect/reconnect insertion from `useLimiter` (`useLimiter.ts#L40`) — limiter is wired only via engine
- [ ] Remove manual disconnect/reconnect from `App.tsx#L29`
- [ ] Add Vitest test: `createAudioEngine()` builds expected graph links (using connect/disconnect mocks)
- [ ] Add Vitest test: repeated `createAudioEngine()` is not order-dependent
- [ ] Mark completed

### Task 2: Explicit lifecycle — `useAudioEngine` + `dispose`

- [ ] Create `useAudioEngine` in `src/hooks/useAudioEngine.ts`, initializing `createAudioEngine()` in `useEffect`
- [ ] Implement `AudioEngine.dispose()`: disconnect external links and release module resources
- [ ] Remove long-lived audio resource creation from render path (`useToneSynth.ts#L126`, `usePanner.ts#L182`, `useLimiter.ts#L100`)
- [ ] Verify StrictMode behavior: double mount/unmount does not create duplicate graphs
- [ ] Add Vitest test: after `dispose()`, public engine methods are safe no-ops (no throws)
- [ ] Add Playwright test: app remount does not produce duplicated audio activity/duplicated sequencer steps
- [ ] Mark completed

### Task 3: Intent-level contracts (after engine/lifecycle)

- [ ] Adopt the `AudioModule` declared in Task 1 as the only internal module shape across engine modules
- [ ] Define `MeterFrame` in `src/engine/types.ts`: `{ leftRms: number; rightRms: number; leftPeak: number; rightPeak: number }`
- [ ] Define `MeterSource` in `src/engine/types.ts`: `{ subscribe(cb: (frame: MeterFrame) => void): () => void }`
- [ ] Hide `get*Node()`/`Tone.*` from public UI contracts (`useToneSynth`, `usePanner`, `useLimiter`)
- [ ] Switch `VUMeter` to `MeterSource.subscribe` instead of `AnalyserNode` (`VUMeter.tsx#L10`)
- [ ] Remove direct `AnalyserNode`/Tone type dependency from `TrackZone` (`TrackZone.tsx#L48`)
- [ ] Add type-level tests (`expectTypeOf` or `tsd`): public UI-hook types must not include `AudioNode`/`Tone.*`
- [ ] Add Vitest test: `MeterSource` emits valid frames (`0..1` for RMS/Peak)
- [ ] Mark completed

### Task 4: Transport service — remove direct Tone calls from UI

- [ ] Create `src/engine/transportService.ts` with contract:
  - `getSnapshot(): { isPlaying: boolean; positionSeconds: number; currentStep: number; bpm: number }`
  - `subscribe(listener: () => void): () => void`
  - `play()`, `pause()`, `stop()`, `setBpm(bpm: number)`, `setLoop(loop: boolean)`
- [ ] Move `useTransportController` to `TransportService` (no direct `Tone.getTransport()` in public flow)
- [ ] Make `useSequencer` consume `TransportService` instead of direct `Tone.getTransport()`
- [ ] Make `TrackZone` consume `positionSeconds`/`playheadPos` from `useTransportController`, not Tone directly
- [ ] Add Vitest test: `play/pause/stop` update snapshot correctly
- [ ] Add Vitest test: `stop()` resets `positionSeconds` and `currentStep`
- [ ] Add Playwright test: playhead moves from controller state, not direct Tone reads in component
- [ ] Mark completed

### Task 5: Single timing model — remove `setTimeout` from note lifecycle

- [ ] In `useSequencer.ts#L43`, replace `setTimeout` for `noteOff` with transport/audio-time scheduling (for example `scheduleOnce`)
- [ ] Ensure `noteOn` and `noteOff` are scheduled in the same time domain
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
- [ ] For each scenario, link exact test file (`vitest`/`playwright`) and expected result
- [ ] Add aggregate command `npm run test:arch` (runs critical regression suite)
- [ ] Definition of Done for refactor:
  - `npm run build` is green
  - `npm run test` is green
  - `npm run test:e2e` is green
  - `npm run test:arch` is green
  - No direct `Tone.getTransport()` usage in UI components
  - No `AudioNode`/`Tone.*` in public UI contracts
- [ ] Mark completed

### Task 7: Documentation alignment — one source of truth

- [ ] Update `AGENTS.md#L7`: remove claim that AudioWorklet/WASM is the active runtime, document current runtime and boundaries
- [ ] Update `CLAUDE.md`: align Architecture section with `createAudioEngine` / `TransportService`
- [ ] Fix `scripts/build-wasm.js#L15` and `package.json#L12` (`build:wasm`):
  - either remove non-working script,
  - or keep as `experimental` and explicitly document that it is not part of active runtime
- [ ] Create `docs/architecture/audio_engine.md`: graph, modules, lifecycle, transport, meter contracts
- [ ] Mark completed

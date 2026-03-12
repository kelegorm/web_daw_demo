# Plan: AudioGraphPlan Bootstrap (for Ralphex)

## Overview

Current status:
- `AudioGraphPlan` + `AudioModuleKind` are implemented.
- `AudioEngine` already materializes runtime from `plan + moduleFactoryMap`.
- Default plan and default factory map are wired in runtime bootstrap.

Next goal:
- Reduce coupling in upper layers (`App.tsx` / UI hooks) to concrete engine fields.
- Introduce id-based public accessors (`getSynth(id)`, `getLimiter(id)`, etc.) based on plan ids.

Scope constraints:
- Keep current audio behavior unchanged.
- No `ProjectDocument -> AudioGraphPlan` compiler yet.
- No diff/patch/reconcile yet.
- No schema-driven UI build in this step.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- Manual smoke in `npm run dev`: app opens, play/pause works, MIDI keyboard triggers sound, meters react

---

### Task 1: Introduce `AudioGraphPlan` model + default plan
- [x] Create `src/engine/audioGraphPlan.ts` with plan-level types (module nodes, edges, sink role)
- [x] Introduce `AudioModuleKind` enum for plan nodes (`SYNTH`, `PANNER`, `TRACK_STRIP`, `LIMITER`, `MASTER_STRIP`, `DESTINATION`)
- [x] Keep plan module kinds at engine-domain level, not `AudioNode`-level
- [x] Export `DEFAULT_AUDIO_GRAPH_PLAN` that exactly matches the current runtime chain
- [x] Port existing graph validation checks to plan data as-is (duplicate id, missing module reference, missing port, self-loop, backward edge)
- [x] Add/adjust unit tests for plan validity and default topology shape
- [x] Mark completed

### Task 2: Make `AudioEngine` consume `AudioGraphPlan`
- [x] Change engine constructor signature to `createAudioEngine(plan, moduleFactoryMap)` (both parameters required)
- [x] Introduce `AudioModuleFactoryMap` keyed by `AudioModuleKind` (single factory registry object, not separate optional factory args)
- [x] Add explicit `AudioModuleKind -> runtime module` mapping logic and fail-fast behavior for missing factory entries
- [x] Materialize runtime modules from plan nodes, then connect by plan edges
- [x] Provide and use `DEFAULT_AUDIO_MODULE_FACTORY_MAP`; update call sites to pass both `DEFAULT_AUDIO_GRAPH_PLAN` and `DEFAULT_AUDIO_MODULE_FACTORY_MAP`
- [x] Preserve current `AudioEngine` object contract (returned facades/fields), while accepting constructor-level breaking change
- [x] Update engine tests to assert behavior is unchanged with the default-plan path
- [x] Mark completed

### Task 3: Add id-based public module access API
- [x] Add exported default plan id constants (for example `DEFAULT_PLAN_SYNTH_ID`, `DEFAULT_PLAN_LIMITER_ID`, etc.)
- [x] Document scope note: `DEFAULT_PLAN_*_ID` constants are tied to `DEFAULT_AUDIO_GRAPH_PLAN` only and are not a generic contract for custom plans
- [x] Add an inline/JSDoc comment on each `DEFAULT_PLAN_*_ID` constant with the same scope note (default-plan only, not for custom plans)
- [x] Extend `AudioEngine` public contract with id-based accessors: `getSynth(id)`, `getPanner(id)`, `getTrackStrip(id)`, `getLimiter(id)`, `getMasterStrip(id)`
- [x] Build internal `id -> module` index from materialized plan nodes
- [x] Make getters fail-fast with explicit errors when id is missing or kind does not match
- [x] Add unit tests for successful lookup and failure cases (unknown id, wrong kind)
- [x] Mark completed

### Task 4: Migrate app wiring to id-based API
- [x] Update `useAudioEngine`/`App.tsx` flow to request modules by id from engine getters
- [x] Replace direct field usage (`audioEngine.synth`, etc.) in app composition paths
- [x] Keep existing UI hooks (`useToneSynth`, `usePanner`, etc.) as adapters over returned module APIs
- [x] Keep behavior unchanged in transport, meters, panic, and sequencer playback
- [x] Add/adjust tests to ensure app boot and playback behavior are unchanged after migration
- [x] Mark completed

### Task 5: Remove legacy module fields from `AudioEngine` contract
- [x] Remove legacy public fields from `AudioEngine` interface: `synth`, `panner`, `trackStrip`, `limiter`, `masterStrip`
- [x] Keep only id-based module accessors (`getSynth`, `getPanner`, `getTrackStrip`, `getLimiter`, `getMasterStrip`) + `dispose`
- [x] Update remaining call sites and tests that still read legacy fields
- [x] Add/adjust tests to assert the id-based API is the only public module access path
- [x] Mark completed

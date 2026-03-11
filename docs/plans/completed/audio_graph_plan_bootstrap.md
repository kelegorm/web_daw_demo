# Plan: AudioGraphPlan Bootstrap (for Ralphex)

## Overview

Current state:
- Audio graph topology is hardcoded inside `createAudioEngine` (`modules` + `edges` inline).
- UI and transport logic assume this fixed chain.
- There is no `ProjectDocument`/`DawEngine` yet.

Goal:
- Introduce an explicit `AudioGraphPlan` model as a separate data structure.
- Make `AudioEngine` materialize runtime modules from that plan.

Scope constraints:
- Keep a single default graph matching today's chain.
- No `ProjectDocument -> AudioGraphPlan` compiler yet.
- No plan diff/patch/reconcile yet.
- Breaking change is allowed in this step: `createAudioEngine` must require a plan argument.
- No backward-compat wrapper (`createAudioEngine()` without plan) in this plan.
- Graph validation scope is limited: port existing checks to plan data, no new validation algorithms in this step.

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

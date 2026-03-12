# Kelegorm DAW

## What This Is

A browser-based DAW demo built with React, TypeScript, Vite, and Tone.js + native Web Audio. Currently a single-track prototype with synth, panner, limiter, transport, sequencer, and MIDI keyboard. The UI is driven by a `UiPlan` data structure but the orchestration layer in `App.tsx` still hardcodes module lookups and mixes UI state with audio wiring.

## Core Value

Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components.

## Current Milestone: v1.0 State Architecture & Dynamic Tracks

**Goal:** Refactor the app into a proper reducer/context architecture with the engine as a standalone singleton, and make the track list dynamic (add/remove).

**Target features:**
- Reducer + context for all UI state (selections, transport, rec-arm, track list)
- Audio engine as a standalone singleton storage, isolated from React lifecycle
- Dynamic track CRUD: add empty track (with track strip wired immediately), remove any track (min 1)
- Separate concerns into utils directory with models matching audio entities
- All audio ↔ UI interaction goes through the engine, never direct node access

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Audio engine graph: synth → panner → track-strip → limiter → master-strip → destination
- ✓ Transport controller with play/pause/stop, BPM, loop
- ✓ 8-step sequencer with MIDI clip playback
- ✓ Track selection with device panel switching
- ✓ VU meters (track + master stereo)
- ✓ MIDI keyboard input
- ✓ Limiter with gain reduction metering
- ✓ UI plan system (UiPlan → buildUiRuntime)
- ✓ Panner with bypass toggle
- ✓ Timeline ruler with playhead

### Active

<!-- Current scope. Building toward these. -->

- [ ] Reducer + context replacing App.tsx mixed state
- [ ] Engine singleton pattern (not React-managed lifecycle)
- [ ] Dynamic track add (empty track + track strip wired to engine)
- [ ] Dynamic track remove (any regular track, min 1 enforced)
- [ ] Utils directory with typed models for audio entities
- [ ] All files under 500 lines, no `any`/`unknown` in new code
- [ ] Audio ↔ UI isolation (always through engine, never direct)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Device CRUD on tracks — deferred, tracks start empty; device add is a separate milestone
- Multi-track sequencing — current sequencer is single-track; expanding is future work
- Spatial reverb WASM — separate plan exists, not in this milestone
- Sequencer timing hardening — separate plan exists, not in this milestone
- Agent findings fix plan — overlaps with this refactor but scoped separately

## Context

- `App.tsx` currently hardcodes `APP_SYNTH_MODULE_ID`, `APP_PANNER_MODULE_ID`, etc. from `DEFAULT_UI_PLAN`
- `buildUiRuntime` resolves the full plan into runtime models but App.tsx re-maps them with `.find()` per action
- Track rec-arm is a loose `useState` in App; transport mute dispatch branches on `trackStripId === APP_TRACK_STRIP_ID`
- The `agent_findings_fix_plan_2026-03-12.md` identifies many of the same pain points (R1-R5, A1-A5)
- Engine currently creates facades per module kind but only supports one instance per kind
- No linter configured — code discipline enforced by convention

## Constraints

- **No `any`/`unknown`**: All new code must be fully typed
- **File size**: Components and utils must stay under 500 lines
- **Audio isolation**: UI components must never hold references to AudioNode or Tone.* objects
- **Backwards compatibility**: Interface must work identically to current state (existing tests pass)
- **Engine singleton**: Engine must not be managed by React render lifecycle

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Engine as standalone singleton | Decouples audio lifecycle from React re-renders, prevents disposal bugs | — Pending |
| Reducer + context over Zustand/Redux | Keep dependencies minimal for a demo; useReducer is sufficient | — Pending |
| Empty tracks (no devices) on add | Simpler first step; device CRUD is separate milestone | — Pending |
| Track strip wired immediately on add | Meters and gain work from creation; no silent placeholder state | — Pending |
| Min 1 track enforced | Prevents empty state complexity; always something to select | — Pending |

---
*Last updated: 2026-03-12 after milestone v1.0 initialization*

# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Browser-based DAW demo. Active stack: React + TypeScript + Vite + Tone.js + native Web Audio nodes.

Important: AudioWorklet/WASM is not the active runtime path right now. `build:wasm` remains as an experimental legacy script and is not wired into the app runtime.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run build:wasm   # Experimental legacy script (not part of active runtime)
```

## Architecture

### Composition root
- `src/engine/audioEngine.ts` is the graph composition root.
- `createAudioEngine()` assembles and validates the module graph.
- Current chain: `synth -> panner -> track-strip -> limiter -> master-strip -> destination`.
- Engine exposes meter taps for track/master strips and limiter input.

### Module responsibilities
- `src/hooks/useToneSynth.ts`
  - `createToneSynth()` builds the instrument (`Tone.PolySynth` + `Tone.Filter`).
  - Owns note triggering (`noteOn`, `noteOff`, `panic`) and synth params.
- `src/hooks/usePanner.ts`
  - Pan stage only (`StereoPannerNode` + bypass toggle).
- `src/hooks/useTrackStrip.ts`
  - Track gain + track mute + stereo analyser taps.
- `src/hooks/useLimiter.ts`
  - Limiter stage (`DynamicsCompressorNode`) + gain-reduction meter + input analyser taps.
- `src/hooks/useMasterStrip.ts`
  - Master gain + stereo analyser taps.

### Orchestration / UI integration
- `src/App.tsx`
  - Creates one engine instance via `useRef` and passes modules into UI hooks.
- `src/hooks/useTransportController.ts`
  - Owns playback UI state (`playing/paused/stopped`, bpm, loop, mute, currentStep).
  - Uses `createTransportCore(...)` and delegates sequencing to `createSequencer(...)`.
- `src/hooks/useSequencer.ts`
  - Schedules the 8-note sequence via `Tone.Part` + `Tone.getTransport()`.

### Current refactor debt (intentional target)
- Engine lifecycle is still render-managed in `App.tsx` (no dedicated `useAudioEngine` + explicit dispose flow).
- Public UI-facing hooks still expose `AudioNode` / `Tone.*` details.
- `noteOff` timing in sequencer still uses wall-clock `setTimeout`.
- `TrackZone` playhead still reads `Tone.getTransport().seconds` directly.
- `VUMeter` still consumes raw `AnalyserNode` getters.

### Key files
- `src/engine/audioEngine.ts` — graph assembly, validation, module wiring
- `src/engine/types.ts` — shared engine-level contracts (`AudioModule`)
- `src/hooks/useTransportController.ts` — transport orchestration policy
- `src/hooks/useSequencer.ts` — step sequencing and transport scheduling
- `src/components/TrackZone.tsx` — timeline/playhead + track/master strip UI
- `src/components/VUMeter.tsx` — stereo meter visualization

## Testing Strategy

Unit tests (Vitest): graph assembly/validation, hook behavior, transport/sequencer control transitions.

E2E tests (Playwright): transport flow, track/mixer controls, device panel controls, and meter activity.

## Implementation Plan

Primary active plan: `docs/plans/audio_graph_refactor.md`.

Completed historical plans are stored in `docs/plans/completed/`.
